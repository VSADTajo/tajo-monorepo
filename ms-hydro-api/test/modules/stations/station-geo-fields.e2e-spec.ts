import { INestApplication, HttpStatus } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { StartedPostgreSqlContainer } from '@testcontainers/postgresql';

// Domain
import { Basin } from '../../../src/app/domain/entities/basin.entity';
import { SubBasin } from '../../../src/app/domain/entities/sub-basin.entity';
import { Station } from '../../../src/app/domain/entities/station.entity';
import { StationThreshold } from '../../../src/app/domain/entities/station-threshold.entity';
import { IBasinRepository } from '../../../src/app/domain/ports/basin-repository.port';
import { ISubBasinRepository } from '../../../src/app/domain/ports/sub-basin-repository.port';
import { IStationRepository } from '../../../src/app/domain/ports/station-repository.port';
import { IStationThresholdRepository } from '../../../src/app/domain/ports/station-threshold-repository.port';
import { ICacheService } from '../../../src/app/domain/ports/cache-service.port';

// Infrastructure
import { BasinRepository } from '../../../src/app/infrastructure/persistence/basin.repository';
import { SubBasinRepository } from '../../../src/app/infrastructure/persistence/sub-basin.repository';
import { StationRepository } from '../../../src/app/infrastructure/persistence/station.repository';
import { StationThresholdRepository } from '../../../src/app/infrastructure/persistence/station-threshold.repository';
import { CachingQueryBus } from '../../../src/app/infrastructure/cache/caching-query-bus.service';

// Application
import { CreateBasinHandler } from '../../../src/app/application/commands/basin.commands';
import { CreateSubBasinHandler } from '../../../src/app/application/commands/sub-basin.commands';
import { CreateStationHandler } from '../../../src/app/application/commands/station.commands';
import { GetStationByIdHandler, ListStationsHandler } from '../../../src/app/application/queries/station.queries';
import { BasinController } from '../../../src/app/api/controllers/basin.controller';
import { SubBasinController } from '../../../src/app/api/controllers/sub-basin.controller';
import { StationController } from '../../../src/app/api/controllers/station.controller';

// Test helpers
import { createTestApp, TestContext } from '../../helpers/test-app.helper';
import { cleanDatabase } from '../../helpers/db.helper';
import { buildCreateBasinDto } from '../../factories/basin.factory';
import { buildCreateSubBasinDto } from '../../factories/sub-basin.factory';

describe('Station geographic fields - zona, comarcaName, sistemaName (e2e)', () => {
    let app: INestApplication;
    let dataSource: DataSource;
    let pgContainer: StartedPostgreSqlContainer;

    const mockCacheService = {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue(undefined),
        del: jest.fn().mockResolvedValue(undefined),
        delByPattern: jest.fn().mockResolvedValue(undefined),
    };

    beforeAll(async () => {
        const ctx: TestContext = await createTestApp({
            entities: [Basin, SubBasin, Station, StationThreshold],
            controllers: [BasinController, SubBasinController, StationController],
            providers: [
                CreateBasinHandler,
                CreateSubBasinHandler,
                CreateStationHandler,
                GetStationByIdHandler,
                ListStationsHandler,
                CachingQueryBus,
                { provide: IBasinRepository, useClass: BasinRepository },
                { provide: ISubBasinRepository, useClass: SubBasinRepository },
                { provide: IStationRepository, useClass: StationRepository },
                { provide: IStationThresholdRepository, useClass: StationThresholdRepository },
                { provide: ICacheService, useValue: mockCacheService },
            ],
        });
        app = ctx.app;
        dataSource = ctx.dataSource;
        pgContainer = ctx.pgContainer;
    }, 60_000);

    afterEach(async () => {
        await cleanDatabase(dataSource);
        jest.clearAllMocks();
    });

    afterAll(async () => {
        await app.close();
        await pgContainer.stop();
    });

    // ─── Helpers ──────────────────────────────────────────────
    function createBasin(dto: Record<string, unknown>) {
        return request(app.getHttpServer()).post('/basins').send(dto);
    }

    function createSubBasin(dto: Record<string, unknown>) {
        return request(app.getHttpServer()).post('/sub-basins').send(dto);
    }

    function getStation(id: string) {
        return request(app.getHttpServer()).get(`/stations/${id}`);
    }

    function listStations(query?: Record<string, unknown>) {
        return request(app.getHttpServer())
            .get('/stations')
            .query(query ?? {});
    }

    async function setupBasinAndSubBasin() {
        const basinDto = buildCreateBasinDto();
        const { body: basin } = await createBasin(basinDto).expect(HttpStatus.CREATED);
        const subBasinDto = buildCreateSubBasinDto(basin.id);
        const { body: subBasin } = await createSubBasin(subBasinDto).expect(HttpStatus.CREATED);
        return { basin, subBasin };
    }

    async function insertStationDirectly(subBasinId: string, overrides?: Partial<Station>): Promise<Station> {
        const unique = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        const repo = dataSource.getRepository(Station);
        const station = repo.create({
            name: `Station ${unique}`,
            subBasinName: `sub-basin-${unique}`,
            stationCode: `EST-${unique.toUpperCase()}`,
            stationType: 'AFORO_EN_RIO' as any,
            subBasinId,
            isActive: true,
            ...overrides,
        });
        return repo.save(station);
    }

    // ─── GET /stations/:id returns geo fields ──────────────────
    describe('GET /stations/:id - geographic fields', () => {
        it('should return zona, comarcaName, sistemaName as null when not set', async () => {
            const { subBasin } = await setupBasinAndSubBasin();
            const station = await insertStationDirectly(subBasin.id);

            const { body } = await getStation(station.id).expect(HttpStatus.OK);

            expect(body).toHaveProperty('zona', null);
            expect(body).toHaveProperty('comarcaName', null);
            expect(body).toHaveProperty('sistemaName', null);
        });

        it('should return zona, comarcaName, sistemaName when populated', async () => {
            const { subBasin } = await setupBasinAndSubBasin();
            const station = await insertStationDirectly(subBasin.id, {
                zona: 'CABECERA',
                comarcaName: 'TALAVERA DE LA REINA',
                sistemaName: 'CABECERA',
            });

            const { body } = await getStation(station.id).expect(HttpStatus.OK);

            expect(body.zona).toBe('CABECERA');
            expect(body.comarcaName).toBe('TALAVERA DE LA REINA');
            expect(body.sistemaName).toBe('CABECERA');
        });
    });

    // ─── GET /stations - list includes geo fields ──────────────
    describe('GET /stations - list includes geographic fields', () => {
        it('should include zona, comarcaName, sistemaName in list items', async () => {
            const { subBasin } = await setupBasinAndSubBasin();
            await insertStationDirectly(subBasin.id, {
                zona: 'MADRID',
                comarcaName: 'MADRID',
                sistemaName: 'MADRID',
            });
            await insertStationDirectly(subBasin.id, {
                zona: 'HENARES',
                comarcaName: 'GUADALAJARA',
                sistemaName: 'HENARES',
            });

            const { body } = await listStations().expect(HttpStatus.OK);

            expect(body.items).toHaveLength(2);
            const zonas = body.items.map((s: { zona: string }) => s.zona).sort();
            expect(zonas).toEqual(['HENARES', 'MADRID']);
            expect(body.items.every((s: { comarcaName: string }) => s.comarcaName !== undefined)).toBe(true);
            expect(body.items.every((s: { sistemaName: string }) => s.sistemaName !== undefined)).toBe(true);
        });
    });
});
