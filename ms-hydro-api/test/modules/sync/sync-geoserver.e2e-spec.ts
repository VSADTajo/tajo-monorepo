import { INestApplication, HttpStatus } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoggerModule } from 'nestjs-pino';
import { CqrsModule } from '@nestjs/cqrs';

// Domain
import { Basin } from '../../../src/app/domain/entities/basin.entity';
import { SubBasin } from '../../../src/app/domain/entities/sub-basin.entity';
import { Station } from '../../../src/app/domain/entities/station.entity';
import { StationThreshold } from '../../../src/app/domain/entities/station-threshold.entity';
import { GeoPuntoSaih } from '../../../src/app/domain/entities/geo-punto-saih.entity';
import { GeoSubcuenca } from '../../../src/app/domain/entities/geo-subcuenca.entity';
import { IBasinRepository } from '../../../src/app/domain/ports/basin-repository.port';
import { ISubBasinRepository } from '../../../src/app/domain/ports/sub-basin-repository.port';
import { IStationRepository } from '../../../src/app/domain/ports/station-repository.port';
import { IStationThresholdRepository } from '../../../src/app/domain/ports/station-threshold-repository.port';
import { IGeoserverRepository } from '../../../src/app/domain/ports/geoserver-repository.port';
import { ICacheService } from '../../../src/app/domain/ports/cache-service.port';

// Infrastructure
import { BasinRepository } from '../../../src/app/infrastructure/persistence/basin.repository';
import { SubBasinRepository } from '../../../src/app/infrastructure/persistence/sub-basin.repository';
import { StationRepository } from '../../../src/app/infrastructure/persistence/station.repository';
import { StationThresholdRepository } from '../../../src/app/infrastructure/persistence/station-threshold.repository';
import { GeoserverRepository } from '../../../src/app/infrastructure/persistence/geoserver.repository';
import { CachingQueryBus } from '../../../src/app/infrastructure/cache/caching-query-bus.service';

// Application
import { SyncGeoserverHandler } from '../../../src/app/application/commands/sync.commands';
import { ListBasinsHandler } from '../../../src/app/application/queries/basin.queries';
import { ListSubBasinsHandler } from '../../../src/app/application/queries/sub-basin.queries';
import { ListStationsHandler } from '../../../src/app/application/queries/station.queries';
import { SyncController } from '../../../src/app/api/controllers/sync.controller';
import { BasinController } from '../../../src/app/api/controllers/basin.controller';
import { SubBasinController } from '../../../src/app/api/controllers/sub-basin.controller';
import { StationController } from '../../../src/app/api/controllers/station.controller';

// Test helpers
import { cleanDatabase } from '../../helpers/db.helper';
import { createGeoserverTestDb, GeoserverTestContext } from '../../helpers/geoserver-test.helper';

// Common
import { CustomValidationPipe } from '../../../src/common/pipes/custom-validation.pipe';
import { HttpExceptionFilter } from '../../../src/common/exceptions/http.exception';

describe('Sync GeoServer (e2e)', () => {
    let app: INestApplication;
    let dataSource: DataSource;
    let pgContainer: StartedPostgreSqlContainer;
    let geoCtx: GeoserverTestContext;

    const mockCacheService = {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue(undefined),
        del: jest.fn().mockResolvedValue(undefined),
        delByPattern: jest.fn().mockResolvedValue(undefined),
    };

    beforeAll(async () => {
        // 1. Start PostGIS GeoServer test container
        geoCtx = await createGeoserverTestDb();

        // 2. Start primary Postgres container
        pgContainer = await new PostgreSqlContainer('postgres:16-alpine').withDatabase('hydro_test').start();

        // 3. Build NestJS module with both DB connections
        const module: TestingModule = await Test.createTestingModule({
            imports: [
                // Primary DB (hydro-api)
                TypeOrmModule.forRoot({
                    type: 'postgres',
                    host: pgContainer.getHost(),
                    port: pgContainer.getMappedPort(5432),
                    username: pgContainer.getUsername(),
                    password: pgContainer.getPassword(),
                    database: pgContainer.getDatabase(),
                    entities: [Basin, SubBasin, Station, StationThreshold],
                    synchronize: true,
                }),
                TypeOrmModule.forFeature([Basin, SubBasin, Station, StationThreshold]),
                // GeoServer DB (read-only)
                TypeOrmModule.forRoot({
                    name: 'geoserver',
                    type: 'postgres',
                    host: geoCtx.geoContainer.getHost(),
                    port: geoCtx.geoContainer.getMappedPort(5432),
                    username: geoCtx.geoContainer.getUsername(),
                    password: geoCtx.geoContainer.getPassword(),
                    database: geoCtx.geoContainer.getDatabase(),
                    entities: [GeoPuntoSaih, GeoSubcuenca],
                    synchronize: false,
                }),
                TypeOrmModule.forFeature([GeoPuntoSaih, GeoSubcuenca], 'geoserver'),
                CqrsModule,
                LoggerModule.forRoot({ pinoHttp: { level: 'silent' } }),
            ],
            controllers: [SyncController, BasinController, SubBasinController, StationController],
            providers: [
                SyncGeoserverHandler,
                ListBasinsHandler,
                ListSubBasinsHandler,
                ListStationsHandler,
                CachingQueryBus,
                { provide: IBasinRepository, useClass: BasinRepository },
                { provide: ISubBasinRepository, useClass: SubBasinRepository },
                { provide: IStationRepository, useClass: StationRepository },
                { provide: IStationThresholdRepository, useClass: StationThresholdRepository },
                { provide: IGeoserverRepository, useClass: GeoserverRepository },
                { provide: ICacheService, useValue: mockCacheService },
                HttpExceptionFilter,
            ],
        }).compile();

        app = module.createNestApplication();
        app.useGlobalPipes(new CustomValidationPipe());
        app.useGlobalFilters(app.get(HttpExceptionFilter));
        await app.init();

        dataSource = app.get(DataSource);
    }, 120_000);

    afterEach(async () => {
        await cleanDatabase(dataSource);
        jest.clearAllMocks();
    });

    afterAll(async () => {
        await app.close();
        await geoCtx.geoDataSource.destroy();
        await geoCtx.geoContainer.stop();
        await pgContainer.stop();
    });

    function syncGeoserver() {
        return request(app.getHttpServer()).post('/sync/geoserver');
    }

    function listBasins() {
        return request(app.getHttpServer()).get('/basins');
    }

    function listSubBasins() {
        return request(app.getHttpServer()).get('/sub-basins');
    }

    function listStations(query: Record<string, string> = {}) {
        return request(app.getHttpServer()).get('/stations').query(query);
    }

    // ─────────────────────────────────────────────────────────────
    // US1: Sync endpoint
    // ─────────────────────────────────────────────────────────────

    it('should sync GeoServer data on first run (creates all records)', async () => {
        const { body } = await syncGeoserver().expect(HttpStatus.CREATED);

        expect(body.basinsCreated).toBe(2); // CABECERA + MADRID
        expect(body.basinsUpdated).toBe(0);
        expect(body.subBasinsCreated).toBe(2); // E_01 + E_02
        expect(body.subBasinsUpdated).toBe(0);
        expect(body.stationsCreated).toBe(3); // AR01 + E_01 + P01
        expect(body.stationsUpdated).toBe(0);
        expect(body.errors).toEqual([]);
    });

    it('should be idempotent — re-sync updates all records', async () => {
        // First sync
        await syncGeoserver().expect(HttpStatus.CREATED);

        // Second sync
        const { body } = await syncGeoserver().expect(HttpStatus.CREATED);

        expect(body.basinsCreated).toBe(0);
        expect(body.basinsUpdated).toBe(2);
        expect(body.subBasinsCreated).toBe(0);
        expect(body.subBasinsUpdated).toBe(2);
        expect(body.stationsCreated).toBe(0);
        expect(body.stationsUpdated).toBe(3);
        expect(body.errors).toEqual([]);
    });

    it('should sync threshold values from GeoServer', async () => {
        await syncGeoserver().expect(HttpStatus.CREATED);

        const [threshold] = await dataSource.query(
            `SELECT t."umbralNivel1", t."umbralCaudal1"
             FROM "station_thresholds" t
             JOIN "stations" s ON s.id = t."stationId"
             WHERE s."stationCode" = 'AR01'`,
        );
        expect(threshold).toBeDefined();
        expect(Number(threshold.umbralNivel1)).toBe(0.95);
        expect(Number(threshold.umbralCaudal1)).toBe(6.06);
    });

    it('should be idempotent for thresholds on re-sync', async () => {
        await syncGeoserver().expect(HttpStatus.CREATED);
        await syncGeoserver().expect(HttpStatus.CREATED);

        const rows = await dataSource.query(
            `SELECT COUNT(*)::int AS count
             FROM "station_thresholds" t
             JOIN "stations" s ON s.id = t."stationId"
             WHERE s."stationCode" = 'AR01'`,
        );
        expect(rows[0].count).toBe(1);
    });

    it('should sync caudal-only thresholds (no nivel / volumen) from GeoServer', async () => {
        const geo = geoCtx.geoDataSource;
        await geo.query(
            `INSERT INTO cht_puntos_saih_umbrales (codigo, parametro, senal, umbral_caudal_1, umbral_caudal_2, umbral_caudal_3)
             VALUES ('P01', 'CAUDAL', 'P01FICT98', 24.988, 36.89, 48.392)`,
        );

        try {
            await syncGeoserver().expect(HttpStatus.CREATED);

            const { body } = await listStations({ stationCode: 'P01' }).expect(HttpStatus.OK);
            expect(body.items[0].threshold).toMatchObject({
                parametro: 'CAUDAL',
                senal: 'P01FICT98',
                umbralNivel1: null,
                umbralCaudal1: 24.988,
                umbralCaudal2: 36.89,
                umbralCaudal3: 48.392,
            });
        } finally {
            await geo.query('DELETE FROM cht_puntos_saih_umbrales WHERE codigo = $1', ['P01']);
        }
    });

    it('should sync precipitation thresholds (1h and 12h) from GeoServer', async () => {
        await syncGeoserver().expect(HttpStatus.CREATED);

        const { body } = await listStations({ stationCode: 'AR01' }).expect(HttpStatus.OK);
        expect(body.items[0].threshold).toMatchObject({
            umbral1Precip1h: 15,
            umbral2Precip1h: 30,
            umbral3Precip1h: 60,
            umbral1Precip12h: 40,
            umbral2Precip12h: 80,
            umbral3Precip12h: 120,
        });
    });

    it('should return null precipitation thresholds for stations without them', async () => {
        await syncGeoserver().expect(HttpStatus.CREATED);

        const { body } = await listStations({ stationCode: 'E_01' }).expect(HttpStatus.OK);
        expect(body.items[0].threshold).toMatchObject({
            umbralVolumen1: 10.5,
            umbral1Precip1h: null,
            umbral2Precip1h: null,
            umbral3Precip1h: null,
            umbral1Precip12h: null,
            umbral2Precip12h: null,
            umbral3Precip12h: null,
        });
    });

    it('should sync precipitation-only thresholds (no nivel / caudal / volumen) from GeoServer', async () => {
        const geo = geoCtx.geoDataSource;
        await geo.query(
            `INSERT INTO cht_puntos_saih_umbrales (codigo, parametro, umbral1_precip1h, umbral2_precip1h, umbral3_precip1h, umbral1_precip12h, umbral2_precip12h, umbral3_precip12h)
             VALUES ('P01', 'PRECIPITACION', 10, 20, 40, 30, 60, 90)`,
        );

        try {
            await syncGeoserver().expect(HttpStatus.CREATED);

            const { body } = await listStations({ stationCode: 'P01' }).expect(HttpStatus.OK);
            expect(body.items[0].threshold).toMatchObject({
                umbralNivel1: null,
                umbralCaudal1: null,
                umbralVolumen1: null,
                umbral1Precip1h: 10,
                umbral2Precip1h: 20,
                umbral3Precip1h: 40,
                umbral1Precip12h: 30,
                umbral2Precip12h: 60,
                umbral3Precip12h: 90,
            });
        } finally {
            await geo.query('DELETE FROM cht_puntos_saih_umbrales WHERE codigo = $1', ['P01']);
        }
    });

    it('should clear precipitation thresholds on re-sync when GeoServer removes them', async () => {
        const geo = geoCtx.geoDataSource;
        await syncGeoserver().expect(HttpStatus.CREATED);
        await geo.query('UPDATE cht_puntos_saih_umbrales SET umbral1_precip1h = $1 WHERE codigo = $2', [null, 'AR01']);

        try {
            await syncGeoserver().expect(HttpStatus.CREATED);

            const { body } = await listStations({ stationCode: 'AR01' }).expect(HttpStatus.OK);
            expect(body.items[0].threshold).toMatchObject({ umbral1Precip1h: null, umbral2Precip1h: 30 });
        } finally {
            await geo.query('UPDATE cht_puntos_saih_umbrales SET umbral1_precip1h = $1 WHERE codigo = $2', [
                15,
                'AR01',
            ]);
        }
    });

    it('should still sync thresholds (precip null) when GeoServer lacks the precipitation columns', async () => {
        const geo = geoCtx.geoDataSource;
        await geo.query(`
            ALTER TABLE cht_puntos_saih_umbrales
                DROP COLUMN umbral1_precip12h, DROP COLUMN umbral2_precip12h, DROP COLUMN umbral3_precip12h,
                DROP COLUMN umbral1_precip1h, DROP COLUMN umbral2_precip1h, DROP COLUMN umbral3_precip1h
        `);

        try {
            const { body: sync } = await syncGeoserver().expect(HttpStatus.CREATED);
            expect(sync.errors).toEqual([]);

            const { body } = await listStations({ stationCode: 'AR01' }).expect(HttpStatus.OK);
            expect(body.items[0].threshold).toMatchObject({
                umbralNivel1: 0.95,
                umbral1Precip1h: null,
                umbral1Precip12h: null,
            });
        } finally {
            await geo.query(`
                ALTER TABLE cht_puntos_saih_umbrales
                    ADD COLUMN umbral1_precip12h numeric(3), ADD COLUMN umbral2_precip12h numeric(3), ADD COLUMN umbral3_precip12h numeric(10),
                    ADD COLUMN umbral1_precip1h numeric(3), ADD COLUMN umbral2_precip1h numeric(3), ADD COLUMN umbral3_precip1h numeric(10)
            `);
            await geo.query(`
                UPDATE cht_puntos_saih_umbrales
                SET umbral1_precip12h = 40, umbral2_precip12h = 80, umbral3_precip12h = 120,
                    umbral1_precip1h = 15, umbral2_precip1h = 30, umbral3_precip1h = 60
                WHERE codigo = 'AR01'
            `);
        }
    });

    // ─────────────────────────────────────────────────────────────
    // US2: Enriched station responses
    // ─────────────────────────────────────────────────────────────

    it('should return enriched station data after sync', async () => {
        await syncGeoserver().expect(HttpStatus.CREATED);

        const { body } = await listStations().expect(HttpStatus.OK);

        expect(body.total).toBe(3);

        const ar01 = body.items.find((s: { stationCode: string }) => s.stationCode === 'AR01');
        expect(ar01).toBeDefined();
        expect(ar01.municipio).toBe('Sacedón');
        expect(ar01.provincia).toBe('Guadalajara');
        expect(ar01.ccaa).toBe('Castilla La Mancha');
        expect(ar01.tipoCod).toBe('AR');
        expect(ar01.stationType).toBe('AFORO_EN_RIO');
        expect(ar01.latitude).toBeCloseTo(40.5, 1);
        expect(ar01.longitude).toBeCloseTo(-2.5, 1);
    });

    // ─────────────────────────────────────────────────────────────
    // US4: Enriched sub-basin responses
    // ─────────────────────────────────────────────────────────────

    it('should return enriched sub-basin data after sync', async () => {
        await syncGeoserver().expect(HttpStatus.CREATED);

        const { body } = await listSubBasins().expect(HttpStatus.OK);

        expect(body.total).toBe(2);

        const e01 = body.items.find((sb: { code: string }) => sb.code === 'E_01');
        expect(e01).toBeDefined();
        expect(e01.area).toBe(1234.56);
        expect(e01.perimetro).toBe(234.78);
        expect(e01.centroidX).toBe(-2.5);
        expect(e01.centroidY).toBe(40.5);
    });

    it('should create basins from distinct zonas', async () => {
        await syncGeoserver().expect(HttpStatus.CREATED);

        const { body } = await listBasins().expect(HttpStatus.OK);

        expect(body.total).toBe(2);

        const codes = body.items.map((b: { code: string }) => b.code).sort();
        expect(codes).toEqual(['CABECERA', 'MADRID']);
    });

    it('should populate meteoalerta zone fields from the cht_meteoalerta spatial join', async () => {
        await syncGeoserver().expect(HttpStatus.CREATED);

        const { body } = await listStations().expect(HttpStatus.OK);
        const byCode: Record<string, { meteoalertaZonaCode: string | null; meteoalertaZonaNombre: string | null }> =
            Object.fromEntries(body.items.map((s: { stationCode: string }) => [s.stationCode, s]));

        // AR01 (-2.5, 40.5) + E_01 (-2.3, 40.7) fall inside zone 670502
        expect(byCode['AR01'].meteoalertaZonaCode).toBe('670502');
        expect(byCode['AR01'].meteoalertaZonaNombre).toBe('Sistema Central de Ávila');
        expect(byCode['E_01'].meteoalertaZonaCode).toBe('670502');

        // P01 (-3.5, 39.5) falls inside zone 673701
        expect(byCode['P01'].meteoalertaZonaCode).toBe('673701');
        expect(byCode['P01'].meteoalertaZonaNombre).toBe('Meseta de Salamanca');
    });

    it('should populate hasCaudalNam / hasCaudalMike from cht_puntos_saih, defaulting NULL to false', async () => {
        await syncGeoserver().expect(HttpStatus.CREATED);

        const { body } = await listStations().expect(HttpStatus.OK);
        const byCode: Record<string, { hasCaudalNam: boolean; hasCaudalMike: boolean }> = Object.fromEntries(
            body.items.map((s: { stationCode: string }) => [s.stationCode, s]),
        );

        expect(byCode.AR01).toMatchObject({ hasCaudalNam: true, hasCaudalMike: false });
        expect(byCode.E_01).toMatchObject({ hasCaudalNam: false, hasCaudalMike: true });
        expect(byCode.P01).toMatchObject({ hasCaudalNam: false, hasCaudalMike: false });
    });

    it('should update caudal flags on re-sync when they change in GeoServer', async () => {
        await syncGeoserver().expect(HttpStatus.CREATED);
        await geoCtx.geoDataSource.query('UPDATE cht_puntos_saih SET hascaudalmike = $1 WHERE codigo = $2', [
            true,
            'AR01',
        ]);

        try {
            await syncGeoserver().expect(HttpStatus.CREATED);

            const { body } = await listStations({ stationCode: 'AR01' }).expect(HttpStatus.OK);
            expect(body.items[0]).toMatchObject({ hasCaudalNam: true, hasCaudalMike: true });
        } finally {
            await geoCtx.geoDataSource.query('UPDATE cht_puntos_saih SET hascaudalmike = $1 WHERE codigo = $2', [
                false,
                'AR01',
            ]);
        }
    });

    it('should still sync stations (flags false) when GeoServer lacks the caudal columns', async () => {
        const geo = geoCtx.geoDataSource;
        await geo.query('ALTER TABLE cht_puntos_saih DROP COLUMN hascaudalnam, DROP COLUMN hascaudalmike');

        try {
            const { body: sync } = await syncGeoserver().expect(HttpStatus.CREATED);
            expect(sync.stationsCreated).toBe(3);

            const { body } = await listStations().expect(HttpStatus.OK);
            for (const station of body.items) {
                expect(station).toMatchObject({ hasCaudalNam: false, hasCaudalMike: false });
            }
        } finally {
            await geo.query(
                'ALTER TABLE cht_puntos_saih ADD COLUMN hascaudalnam boolean, ADD COLUMN hascaudalmike boolean',
            );
            await geo.query(`
                UPDATE cht_puntos_saih
                SET hascaudalnam = (codigo = 'AR01'), hascaudalmike = (codigo = 'E_01')
                WHERE codigo IN ('AR01', 'E_01')
            `);
        }
    });
});
