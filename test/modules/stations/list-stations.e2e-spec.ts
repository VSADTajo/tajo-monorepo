import { INestApplication, HttpStatus } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { StartedPostgreSqlContainer } from '@testcontainers/postgresql';

// Domain
import { Basin } from '../../../src/app/domain/entities/basin.entity';
import { SubBasin } from '../../../src/app/domain/entities/sub-basin.entity';
import { Station } from '../../../src/app/domain/entities/station.entity';
import { IBasinRepository } from '../../../src/app/domain/ports/basin-repository.port';
import { ISubBasinRepository } from '../../../src/app/domain/ports/sub-basin-repository.port';
import { IStationRepository } from '../../../src/app/domain/ports/station-repository.port';
import { ICacheService } from '../../../src/app/domain/ports/cache-service.port';

// Infrastructure
import { BasinRepository } from '../../../src/app/infrastructure/persistence/basin.repository';
import { SubBasinRepository } from '../../../src/app/infrastructure/persistence/sub-basin.repository';
import { StationRepository } from '../../../src/app/infrastructure/persistence/station.repository';
import { CachingQueryBus } from '../../../src/app/infrastructure/cache/caching-query-bus.service';

// Application
import { CreateBasinHandler } from '../../../src/app/application/commands/basin.commands';
import { CreateSubBasinHandler } from '../../../src/app/application/commands/sub-basin.commands';
import { CreateStationHandler } from '../../../src/app/application/commands/station.commands';
import { ListStationsHandler } from '../../../src/app/application/queries/station.queries';
import { BasinController } from '../../../src/app/api/controllers/basin.controller';
import { SubBasinController } from '../../../src/app/api/controllers/sub-basin.controller';
import { StationController } from '../../../src/app/api/controllers/station.controller';

// Test helpers
import { createTestApp, TestContext } from '../../helpers/test-app.helper';
import { cleanDatabase } from '../../helpers/db.helper';
import { buildCreateBasinDto } from '../../factories/basin.factory';
import { buildCreateSubBasinDto } from '../../factories/sub-basin.factory';
import { buildCreateStationDto } from '../../factories/station.factory';

describe('List Stations (e2e)', () => {
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
            entities: [Basin, SubBasin, Station],
            controllers: [BasinController, SubBasinController, StationController],
            providers: [
                CreateBasinHandler,
                CreateSubBasinHandler,
                CreateStationHandler,
                ListStationsHandler,
                CachingQueryBus,
                { provide: IBasinRepository, useClass: BasinRepository },
                { provide: ISubBasinRepository, useClass: SubBasinRepository },
                { provide: IStationRepository, useClass: StationRepository },
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

    function createStation(dto: Record<string, unknown>) {
        return request(app.getHttpServer()).post('/stations').send(dto);
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

    // ─── List all ───────────────────────────────────────────────
    describe('GET /stations - list all', () => {
        it('should return empty list when no stations exist', async () => {
            const { body } = await listStations().expect(HttpStatus.OK);

            expect(body.items).toEqual([]);
            expect(body.total).toBe(0);
        });

        it('should return all stations with total count', async () => {
            const { subBasin } = await setupBasinAndSubBasin();
            await createStation(buildCreateStationDto(subBasin.id)).expect(HttpStatus.CREATED);
            await createStation(buildCreateStationDto(subBasin.id)).expect(HttpStatus.CREATED);
            await createStation(buildCreateStationDto(subBasin.id)).expect(HttpStatus.CREATED);

            const { body } = await listStations().expect(HttpStatus.OK);

            expect(body.items).toHaveLength(3);
            expect(body.total).toBe(3);
        });
    });

    // ─── Pagination ─────────────────────────────────────────────
    describe('GET /stations - pagination', () => {
        it('should paginate results', async () => {
            const { subBasin } = await setupBasinAndSubBasin();
            for (let i = 0; i < 5; i++) {
                await createStation(buildCreateStationDto(subBasin.id)).expect(HttpStatus.CREATED);
            }

            const { body: page1 } = await listStations({ page: 1, limit: 2 }).expect(HttpStatus.OK);
            expect(page1.items).toHaveLength(2);
            expect(page1.total).toBe(5);

            const { body: page2 } = await listStations({ page: 2, limit: 2 }).expect(HttpStatus.OK);
            expect(page2.items).toHaveLength(2);
            expect(page2.total).toBe(5);

            const { body: page3 } = await listStations({ page: 3, limit: 2 }).expect(HttpStatus.OK);
            expect(page3.items).toHaveLength(1);
            expect(page3.total).toBe(5);
        });
    });

    // ─── Filter by subBasinId ───────────────────────────────────
    describe('GET /stations - filter by subBasinId', () => {
        it('should filter stations by subBasinId', async () => {
            const { basin, subBasin: subBasin1 } = await setupBasinAndSubBasin();
            const subBasinDto2 = buildCreateSubBasinDto(basin.id);
            const { body: subBasin2 } = await createSubBasin(subBasinDto2).expect(HttpStatus.CREATED);

            await createStation(buildCreateStationDto(subBasin1.id)).expect(HttpStatus.CREATED);
            await createStation(buildCreateStationDto(subBasin1.id)).expect(HttpStatus.CREATED);
            await createStation(buildCreateStationDto(subBasin2.id)).expect(HttpStatus.CREATED);

            const { body } = await listStations({ subBasinId: subBasin1.id }).expect(HttpStatus.OK);

            expect(body.items).toHaveLength(2);
            expect(body.total).toBe(2);
            expect(body.items.every((s: { subBasinId: string }) => s.subBasinId === subBasin1.id)).toBe(true);
        });
    });

    // ─── Filter by stationType ──────────────────────────────────
    describe('GET /stations - filter by stationType', () => {
        it('should filter stations by stationType', async () => {
            const { subBasin } = await setupBasinAndSubBasin();

            await createStation(buildCreateStationDto(subBasin.id, { stationType: 'HYDROLOGICAL' })).expect(
                HttpStatus.CREATED,
            );
            await createStation(buildCreateStationDto(subBasin.id, { stationType: 'METEOROLOGICAL' })).expect(
                HttpStatus.CREATED,
            );
            await createStation(buildCreateStationDto(subBasin.id, { stationType: 'PLUVIOMETRIC' })).expect(
                HttpStatus.CREATED,
            );

            const { body } = await listStations({ stationType: 'METEOROLOGICAL' }).expect(HttpStatus.OK);

            expect(body.items).toHaveLength(1);
            expect(body.total).toBe(1);
            expect(body.items[0].stationType).toBe('METEOROLOGICAL');
        });
    });

    // ─── Filter by isActive ─────────────────────────────────────
    describe('GET /stations - filter by isActive', () => {
        it('should filter stations by isActive', async () => {
            const { subBasin } = await setupBasinAndSubBasin();

            await createStation(buildCreateStationDto(subBasin.id)).expect(HttpStatus.CREATED);
            await createStation(buildCreateStationDto(subBasin.id)).expect(HttpStatus.CREATED);

            // All stations are active by default
            const { body: activeOnly } = await listStations({ isActive: true }).expect(HttpStatus.OK);
            expect(activeOnly.items).toHaveLength(2);
            expect(activeOnly.total).toBe(2);

            const { body: inactiveOnly } = await listStations({ isActive: false }).expect(HttpStatus.OK);
            expect(inactiveOnly.items).toHaveLength(0);
            expect(inactiveOnly.total).toBe(0);
        });
    });
});
