import { Inject, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Logger } from 'nestjs-pino';

import {
    IGeoserverRepository,
    GeoserverStationData,
    GeoserverSubcuencaData,
    GeoserverThresholdData,
} from '@domain/ports/geoserver-repository.port';
import { RepositoryError } from '@domain/errors/repository.error';

@Injectable()
export class GeoserverRepository implements IGeoserverRepository {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        @InjectDataSource('geoserver') private readonly dataSource: DataSource,
    ) {}

    async findAllStationsWithSubcuenca(): Promise<GeoserverStationData[]> {
        this.logger.log('Reading all stations with subcuenca mapping from GeoServer');
        try {
            const rows = await this.dataSource.query(`
                SELECT
                    p.codigo,
                    p.nombre,
                    p.tipo_cod AS "tipoCod",
                    p.tipo,
                    p.zona,
                    p.municipio,
                    p.provincia,
                    p.ccaa,
                    ST_Y(p.geom) AS latitude,
                    ST_X(p.geom) AS longitude,
                    s.code AS "subcuencaCode",
                    s.name AS "subcuencaName",
                    ca.ds_comarca AS "comarcaName",
                    s10.sistema AS "sistemaName",
                    ze.ogc_fid AS "zonaExplOgcFid",
                    ze.nombre AS "zonaExplNombre",
                    zm.cod_z AS "meteoalertaZonaCode",
                    zm.nom_z AS "meteoalertaZonaNombre",
                    -- Read via to_jsonb so a GeoServer DB without these (recently added) columns
                    -- yields false instead of failing the whole sync.
                    COALESCE((to_jsonb(p) ->> 'hascaudalnam')::boolean, false) AS "hasCaudalNam",
                    COALESCE((to_jsonb(p) ->> 'hascaudalmike')::boolean, false) AS "hasCaudalMike"
                FROM cht_puntos_saih p
                LEFT JOIN cht_subcuencas s ON ST_Contains(s.geom, p.geom)
                LEFT JOIN cht_comarcasagrarias ca ON ST_Intersects(p.geom, ca.wkb_geometry)
                LEFT JOIN cht_sistemas10 s10 ON ST_Intersects(p.geom, s10.geom)
                LEFT JOIN cht_zonas_expl ze ON ST_Intersects(p.geom, ze.geom)
                LEFT JOIN cht_meteoalerta zm ON ST_Contains(ST_Transform(zm.geom, 4326), p.geom)
                ORDER BY p.codigo
            `);
            this.logger.log(`Found ${rows.length} stations in GeoServer`);
            return rows;
        } catch (error) {
            this.logger.error({
                msg: 'Error reading stations from GeoServer',
                entity: 'GeoServer',
                error: String(error),
            });
            throw new RepositoryError('Failed to read stations from GeoServer', error as Error);
        }
    }

    async findAllSubcuencas(): Promise<GeoserverSubcuencaData[]> {
        this.logger.log('Reading all subcuencas from GeoServer');
        try {
            const rows = await this.dataSource.query(`
                SELECT
                    code,
                    name,
                    area,
                    perimetro,
                    centroid_x AS "centroidX",
                    centroid_y AS "centroidY"
                FROM cht_subcuencas
                ORDER BY code
            `);
            this.logger.log(`Found ${rows.length} subcuencas in GeoServer`);
            return rows;
        } catch (error) {
            this.logger.error({
                msg: 'Error reading subcuencas from GeoServer',
                entity: 'GeoServer',
                error: String(error),
            });
            throw new RepositoryError('Failed to read subcuencas from GeoServer', error as Error);
        }
    }

    async findAllSubcuencaZonaMappings(): Promise<Map<string, string>> {
        this.logger.log('Reading subcuenca-to-zona mappings from GeoServer');
        try {
            const rows: { subcuencaCode: string; zona: string }[] = await this.dataSource.query(`
                SELECT
                    s.code AS "subcuencaCode",
                    p.zona,
                    COUNT(*) AS cnt
                FROM cht_subcuencas s
                JOIN cht_puntos_saih p ON ST_Contains(s.geom, p.geom)
                GROUP BY s.code, p.zona
                ORDER BY s.code, cnt DESC
            `);

            // Take the first (most frequent) zona per subcuenca
            const mappings = new Map<string, string>();
            for (const row of rows) {
                if (!mappings.has(row.subcuencaCode)) {
                    mappings.set(row.subcuencaCode, row.zona);
                }
            }

            this.logger.log(`Mapped ${mappings.size} subcuencas to zonas`);
            return mappings;
        } catch (error) {
            this.logger.error({
                msg: 'Error reading zona mappings from GeoServer',
                entity: 'GeoServer',
                error: String(error),
            });
            throw new RepositoryError('Failed to read zona mappings from GeoServer', error as Error);
        }
    }

    async findAllThresholds(): Promise<GeoserverThresholdData[]> {
        this.logger.log('Reading all thresholds from GeoServer');
        try {
            // Precipitation columns are read through to_jsonb so the sync keeps working
            // against GeoServer databases that do not have them yet (they come back NULL).
            const rows = await this.dataSource.query(`
                SELECT *
                FROM (
                    SELECT
                        u.codigo,
                        u.parametro,
                        u.senal,
                        u.umbral_nivel_1  AS "umbralNivel1",
                        u.umbral_caudal_1 AS "umbralCaudal1",
                        u.umbral_nivel_2  AS "umbralNivel2",
                        u.umbral_caudal_2 AS "umbralCaudal2",
                        u.umbral_nivel_3  AS "umbralNivel3",
                        u.umbral_caudal_3 AS "umbralCaudal3",
                        u.max_nivel_muro  AS "maxNivelMuro",
                        u.max_nivel_caseta AS "maxNivelCaseta",
                        u.umbral_1_volumen AS "umbralVolumen1",
                        u.umbral_2_volumen AS "umbralVolumen2",
                        u.umbral_3_volumen AS "umbralVolumen3",
                        u.caudal_entrada  AS "caudalEntrada",
                        u.caudal_salida   AS "caudalSalida",
                        u.capacidad,
                        (to_jsonb(u) ->> 'umbral1_precip1h')::double precision  AS "umbral1Precip1h",
                        (to_jsonb(u) ->> 'umbral2_precip1h')::double precision  AS "umbral2Precip1h",
                        (to_jsonb(u) ->> 'umbral3_precip1h')::double precision  AS "umbral3Precip1h",
                        (to_jsonb(u) ->> 'umbral1_precip12h')::double precision AS "umbral1Precip12h",
                        (to_jsonb(u) ->> 'umbral2_precip12h')::double precision AS "umbral2Precip12h",
                        (to_jsonb(u) ->> 'umbral3_precip12h')::double precision AS "umbral3Precip12h"
                    FROM cht_puntos_saih_umbrales u
                ) t
                WHERE "umbralNivel1" IS NOT NULL
                   OR "umbralCaudal1" IS NOT NULL
                   OR "umbralCaudal2" IS NOT NULL
                   OR "umbralCaudal3" IS NOT NULL
                   OR "umbralVolumen1" IS NOT NULL
                   OR COALESCE(
                        "umbral1Precip1h", "umbral2Precip1h", "umbral3Precip1h",
                        "umbral1Precip12h", "umbral2Precip12h", "umbral3Precip12h"
                      ) IS NOT NULL
                ORDER BY codigo
            `);
            this.logger.log(`Found ${rows.length} stations with thresholds in GeoServer`);
            return rows;
        } catch (error) {
            this.logger.error({
                msg: 'Error reading thresholds from GeoServer',
                entity: 'GeoServer',
                error: String(error),
            });
            throw new RepositoryError('Failed to read thresholds from GeoServer', error as Error);
        }
    }
}
