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
import { ICacheService } from '../../../src/app/domain/ports/cache-service.port';

// Infrastructure
import { BasinRepository } from '../../../src/app/infrastructure/persistence/basin.repository';
import { SubBasinRepository } from '../../../src/app/infrastructure/persistence/sub-basin.repository';
import { CachingQueryBus } from '../../../src/app/infrastructure/cache/caching-query-bus.service';

// Application
import { CreateBasinHandler } from '../../../src/app/application/commands/basin.commands';
import { CreateSubBasinHandler } from '../../../src/app/application/commands/sub-basin.commands';
import { ListSubBasinsHandler } from '../../../src/app/application/queries/sub-basin.queries';
import { BasinController } from '../../../src/app/api/controllers/basin.controller';
import { SubBasinController } from '../../../src/app/api/controllers/sub-basin.controller';

// Test helpers
import { createTestApp, TestContext } from '../../helpers/test-app.helper';
import { cleanDatabase } from '../../helpers/db.helper';
import { buildCreateBasinDto } from '../../factories/basin.factory';
import { buildCreateSubBasinDto } from '../../factories/sub-basin.factory';

describe('List SubBasins (e2e)', () => {
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
            controllers: [BasinController, SubBasinController],
            providers: [
                CreateBasinHandler,
                CreateSubBasinHandler,
                ListSubBasinsHandler,
                CachingQueryBus,
                { provide: IBasinRepository, useClass: BasinRepository },
                { provide: ISubBasinRepository, useClass: SubBasinRepository },
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

    function listSubBasins(query?: Record<string, unknown>) {
        return request(app.getHttpServer())
            .get('/sub-basins')
            .query(query ?? {});
    }

    async function setupBasin() {
        const basinDto = buildCreateBasinDto();
        const { body: basin } = await createBasin(basinDto).expect(HttpStatus.CREATED);
        return basin;
    }

    // ─── List all ───────────────────────────────────────────────
    describe('GET /sub-basins - list all', () => {
        it('should return empty list when no sub-basins exist', async () => {
            const { body } = await listSubBasins().expect(HttpStatus.OK);

            expect(body.items).toEqual([]);
            expect(body.total).toBe(0);
        });

        it('should return all sub-basins with total count', async () => {
            const basin = await setupBasin();
            await createSubBasin(buildCreateSubBasinDto(basin.id)).expect(HttpStatus.CREATED);
            await createSubBasin(buildCreateSubBasinDto(basin.id)).expect(HttpStatus.CREATED);

            const { body } = await listSubBasins().expect(HttpStatus.OK);

            expect(body.items).toHaveLength(2);
            expect(body.total).toBe(2);
        });
    });

    // ─── Pagination ─────────────────────────────────────────────
    describe('GET /sub-basins - pagination', () => {
        it('should paginate results', async () => {
            const basin = await setupBasin();
            for (let i = 0; i < 5; i++) {
                await createSubBasin(buildCreateSubBasinDto(basin.id)).expect(HttpStatus.CREATED);
            }

            const { body: page1 } = await listSubBasins({ page: 1, limit: 2 }).expect(HttpStatus.OK);
            expect(page1.items).toHaveLength(2);
            expect(page1.total).toBe(5);
        });
    });

    // ─── Filter by basinId ──────────────────────────────────────
    describe('GET /sub-basins - filter by basinId', () => {
        it('should filter sub-basins by basinId', async () => {
            const basin1 = await setupBasin();
            const basin2 = await setupBasin();

            await createSubBasin(buildCreateSubBasinDto(basin1.id)).expect(HttpStatus.CREATED);
            await createSubBasin(buildCreateSubBasinDto(basin1.id)).expect(HttpStatus.CREATED);
            await createSubBasin(buildCreateSubBasinDto(basin2.id)).expect(HttpStatus.CREATED);

            const { body } = await listSubBasins({ basinId: basin1.id }).expect(HttpStatus.OK);

            expect(body.items).toHaveLength(2);
            expect(body.total).toBe(2);
            expect(body.items.every((sb: { basinId: string }) => sb.basinId === basin1.id)).toBe(true);
        });
    });

    // ─── Filter by isActive ─────────────────────────────────────
    describe('GET /sub-basins - filter by isActive', () => {
        it('should filter sub-basins by isActive', async () => {
            const basin = await setupBasin();
            await createSubBasin(buildCreateSubBasinDto(basin.id)).expect(HttpStatus.CREATED);

            const { body: activeOnly } = await listSubBasins({ isActive: true }).expect(HttpStatus.OK);
            expect(activeOnly.items).toHaveLength(1);

            const { body: inactiveOnly } = await listSubBasins({ isActive: false }).expect(HttpStatus.OK);
            expect(inactiveOnly.items).toHaveLength(0);
        });
    });
});
