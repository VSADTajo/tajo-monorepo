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

    function listStations() {
        return request(app.getHttpServer()).get('/stations');
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
});
