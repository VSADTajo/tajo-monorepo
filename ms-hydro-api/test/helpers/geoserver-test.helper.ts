import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';

export interface GeoserverTestContext {
    geoDataSource: DataSource;
    geoContainer: StartedPostgreSqlContainer;
}

/**
 * Spins up a PostGIS container simulating the GeoServer database.
 * Creates cht_puntos_saih and cht_subcuencas tables with test seed data.
 */
export async function createGeoserverTestDb(): Promise<GeoserverTestContext> {
    const geoContainer = await new PostgreSqlContainer('postgis/postgis:17-3.5-alpine')
        .withDatabase('geoserver_test')
        .start();

    const geoDataSource = new DataSource({
        type: 'postgres',
        host: geoContainer.getHost(),
        port: geoContainer.getMappedPort(5432),
        username: geoContainer.getUsername(),
        password: geoContainer.getPassword(),
        database: geoContainer.getDatabase(),
    });

    await geoDataSource.initialize();

    // Enable PostGIS extension
    await geoDataSource.query('CREATE EXTENSION IF NOT EXISTS postgis');

    // Create cht_subcuencas table
    await geoDataSource.query(`
        CREATE TABLE cht_subcuencas (
            ogc_fid SERIAL PRIMARY KEY,
            geom geometry(Polygon, 4326),
            fid double precision,
            id double precision,
            cuencasnam varchar,
            area double precision,
            perimetro double precision,
            code varchar,
            name varchar,
            centroid_x double precision,
            centroid_y double precision
        )
    `);

    // Create cht_puntos_saih table
    await geoDataSource.query(`
        CREATE TABLE cht_puntos_saih (
            ogc_fid SERIAL PRIMARY KEY,
            geom geometry(Point, 4326),
            codigo varchar(254),
            nombre varchar(254),
            tipo_cod varchar(254),
            tipo varchar(254),
            zona varchar(254),
            municipio varchar(254),
            provincia varchar(254),
            ccaa varchar(254),
            xetrs89h30 numeric(23,15),
            yetrs89h30 numeric(23,15)
        )
    `);

    // Seed subcuencas — 2 sub-basins as polygons
    await geoDataSource.query(`
        INSERT INTO cht_subcuencas (geom, code, name, area, perimetro, centroid_x, centroid_y)
        VALUES
            (ST_GeomFromText('POLYGON((-3 40, -2 40, -2 41, -3 41, -3 40))', 4326), 'E_01', 'SUBCUENCA NORTE', 1234.56, 234.78, -2.5, 40.5),
            (ST_GeomFromText('POLYGON((-4 39, -3 39, -3 40, -4 40, -4 39))', 4326), 'E_02', 'SUBCUENCA SUR', 567.89, 123.45, -3.5, 39.5)
    `);

    // Seed stations — 3 stations, 2 in subcuenca E_01, 1 in E_02
    await geoDataSource.query(`
        INSERT INTO cht_puntos_saih (geom, codigo, nombre, tipo_cod, tipo, zona, municipio, provincia, ccaa)
        VALUES
            (ST_SetSRID(ST_MakePoint(-2.5, 40.5), 4326), 'AR01', 'ESTACION RIO NORTE', 'AR', 'AFORO EN RIO', 'CABECERA', 'Sacedón', 'Guadalajara', 'Castilla La Mancha'),
            (ST_SetSRID(ST_MakePoint(-2.3, 40.7), 4326), 'E_01', 'EMBALSE NORTE', 'E', 'EMBALSE SAIH', 'CABECERA', 'Brihuega', 'Guadalajara', 'Castilla La Mancha'),
            (ST_SetSRID(ST_MakePoint(-3.5, 39.5), 4326), 'P01', 'PLUVIOMETRO SUR', 'P', 'PLUVIOMETRO/PLUVIONIVOMETRO', 'MADRID', 'Aranjuez', 'Madrid', 'Comunidad de Madrid')
    `);

    // Create enrichment tables joined by the sync station query (kept empty — LEFT JOINs)
    await geoDataSource.query(`
        CREATE TABLE cht_comarcasagrarias (
            ogc_fid SERIAL PRIMARY KEY,
            wkb_geometry geometry(MultiPolygon, 4326),
            ds_comarca varchar
        )
    `);

    await geoDataSource.query(`
        CREATE TABLE cht_sistemas10 (
            ogc_fid SERIAL PRIMARY KEY,
            geom geometry(MultiPolygon, 4326),
            sistema varchar
        )
    `);

    await geoDataSource.query(`
        CREATE TABLE cht_zonas_expl (
            ogc_fid SERIAL PRIMARY KEY,
            geom geometry(MultiPolygon, 4326),
            nombre varchar
        )
    `);

    // Create cht_puntos_saih_umbrales table (threshold source for sync)
    await geoDataSource.query(`
        CREATE TABLE cht_puntos_saih_umbrales (
            ogc_fid SERIAL PRIMARY KEY,
            codigo varchar(254),
            parametro varchar(20),
            senal varchar(20),
            umbral_nivel_1 double precision,
            umbral_caudal_1 double precision,
            umbral_nivel_2 double precision,
            umbral_caudal_2 double precision,
            umbral_nivel_3 double precision,
            umbral_caudal_3 double precision,
            max_nivel_muro double precision,
            max_nivel_caseta double precision,
            umbral_1_volumen double precision,
            umbral_2_volumen double precision,
            umbral_3_volumen double precision,
            caudal_entrada varchar(20),
            caudal_salida varchar(20),
            capacidad double precision
        )
    `);

    // Seed thresholds — AR01 (aforo: nivel + caudal), E_01 (embalse: volumen)
    await geoDataSource.query(`
        INSERT INTO cht_puntos_saih_umbrales
            (codigo, parametro, senal, umbral_nivel_1, umbral_caudal_1, umbral_nivel_2, umbral_caudal_2, umbral_nivel_3, umbral_caudal_3, umbral_1_volumen, umbral_2_volumen, umbral_3_volumen, caudal_entrada, caudal_salida, capacidad)
        VALUES
            ('AR01', 'NIVEL', 'AR01LI__01', 0.95, 6.06, 1.2, 11.53, 1.4, 17.65, NULL, NULL, NULL, NULL, NULL, NULL),
            ('E_01', 'VOLUMEN', 'E_01VE__01', NULL, NULL, NULL, NULL, NULL, NULL, 10.5, 20.5, 30.5, 'E_01QE__01', 'E_01QS__01', 50.0)
    `);

    return { geoDataSource, geoContainer };
}
