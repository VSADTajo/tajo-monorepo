import { INestApplication, HttpStatus } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { StartedPostgreSqlContainer } from '@testcontainers/postgresql';

// Domain
import { Basin } from '../../../src/app/domain/entities/basin.entity';
import { SubBasin } from '../../../src/app/domain/entities/sub-basin.entity';
import { Station } from '../../../src/app/domain/entities/station.entity';
import { IBasinRepository } from '../../../src/app/domain/ports/basin-repository.port';
import { ICacheService } from '../../../src/app/domain/ports/cache-service.port';

// Infrastructure
import { BasinRepository } from '../../../src/app/infrastructure/persistence/basin.repository';
import { CachingQueryBus } from '../../../src/app/infrastructure/cache/caching-query-bus.service';

// Application
import { CreateBasinHandler } from '../../../src/app/application/commands/basin.commands';
import { ListBasinsHandler } from '../../../src/app/application/queries/basin.queries';
import { BasinController } from '../../../src/app/api/controllers/basin.controller';

// Test helpers
import { createTestApp, TestContext } from '../../helpers/test-app.helper';
import { cleanDatabase } from '../../helpers/db.helper';
import { buildCreateBasinDto } from '../../factories/basin.factory';

describe('List Basins (e2e)', () => {
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
            controllers: [BasinController],
            providers: [
                CreateBasinHandler,
                ListBasinsHandler,
                CachingQueryBus,
                { provide: IBasinRepository, useClass: BasinRepository },
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

    function listBasins(query?: Record<string, unknown>) {
        return request(app.getHttpServer())
            .get('/basins')
            .query(query ?? {});
    }

    // ─── List all ───────────────────────────────────────────────
    describe('GET /basins - list all', () => {
        it('should return empty list when no basins exist', async () => {
            const { body } = await listBasins().expect(HttpStatus.OK);

            expect(body.items).toEqual([]);
            expect(body.total).toBe(0);
        });

        it('should return all basins with total count', async () => {
            await createBasin(buildCreateBasinDto()).expect(HttpStatus.CREATED);
            await createBasin(buildCreateBasinDto()).expect(HttpStatus.CREATED);
            await createBasin(buildCreateBasinDto()).expect(HttpStatus.CREATED);

            const { body } = await listBasins().expect(HttpStatus.OK);

            expect(body.items).toHaveLength(3);
            expect(body.total).toBe(3);
        });
    });

    // ─── Pagination ─────────────────────────────────────────────
    describe('GET /basins - pagination', () => {
        it('should paginate results', async () => {
            for (let i = 0; i < 5; i++) {
                await createBasin(buildCreateBasinDto()).expect(HttpStatus.CREATED);
            }

            const { body: page1 } = await listBasins({ page: 1, limit: 2 }).expect(HttpStatus.OK);
            expect(page1.items).toHaveLength(2);
            expect(page1.total).toBe(5);

            const { body: page3 } = await listBasins({ page: 3, limit: 2 }).expect(HttpStatus.OK);
            expect(page3.items).toHaveLength(1);
            expect(page3.total).toBe(5);
        });
    });

    // ─── Filter by isActive ─────────────────────────────────────
    describe('GET /basins - filter by isActive', () => {
        it('should filter basins by isActive', async () => {
            await createBasin(buildCreateBasinDto()).expect(HttpStatus.CREATED);
            await createBasin(buildCreateBasinDto()).expect(HttpStatus.CREATED);

            const { body: activeOnly } = await listBasins({ isActive: true }).expect(HttpStatus.OK);
            expect(activeOnly.items).toHaveLength(2);

            const { body: inactiveOnly } = await listBasins({ isActive: false }).expect(HttpStatus.OK);
            expect(inactiveOnly.items).toHaveLength(0);
        });
    });
});
