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
import { CreateBasinHandler, UpdateBasinHandler } from '../../../src/app/application/commands/basin.commands';
import { GetBasinByIdHandler } from '../../../src/app/application/queries/basin.queries';
import { BasinController } from '../../../src/app/api/controllers/basin.controller';

// Test helpers
import { createTestApp, TestContext } from '../../helpers/test-app.helper';
import { cleanDatabase } from '../../helpers/db.helper';
import { buildCreateBasinDto } from '../../factories/basin.factory';

describe('Update Basin (e2e)', () => {
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
                UpdateBasinHandler,
                GetBasinByIdHandler,
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

    function updateBasin(id: string, dto: Record<string, unknown>) {
        return request(app.getHttpServer()).put(`/basins/${id}`).send(dto);
    }

    function getBasin(id: string) {
        return request(app.getHttpServer()).get(`/basins/${id}`);
    }

    // ─── Successful updates ──────────────────────────────────────
    describe('PUT /basins/:id - successful updates', () => {
        it('should update basin name', async () => {
            const dto = buildCreateBasinDto();
            const { body: basin } = await createBasin(dto).expect(HttpStatus.CREATED);

            const { body } = await updateBasin(basin.id, { name: 'Updated Name' }).expect(HttpStatus.OK);

            expect(body.name).toBe('Updated Name');
            expect(body.id).toBe(basin.id);
        });

        it('should update basin code', async () => {
            const dto = buildCreateBasinDto();
            const { body: basin } = await createBasin(dto).expect(HttpStatus.CREATED);

            const { body } = await updateBasin(basin.id, { code: 'NEW-CODE' }).expect(HttpStatus.OK);

            expect(body.code).toBe('NEW-CODE');
        });

        it('should verify GET reflects the update', async () => {
            const dto = buildCreateBasinDto();
            const { body: basin } = await createBasin(dto).expect(HttpStatus.CREATED);

            await updateBasin(basin.id, { name: 'Verified Name' }).expect(HttpStatus.OK);

            const { body } = await getBasin(basin.id).expect(HttpStatus.OK);
            expect(body.name).toBe('Verified Name');
        });
    });

    // ─── Not found ────────────────────────────────────────────
    describe('PUT /basins/:id - not found', () => {
        it('should return 404 for non-existent basin', async () => {
            await updateBasin('00000000-0000-0000-0000-000000000000', { name: 'Test' }).expect(HttpStatus.NOT_FOUND);
        });
    });

    // ─── Conflict ─────────────────────────────────────────────
    describe('PUT /basins/:id - conflicts', () => {
        it('should reject duplicate name with 409', async () => {
            const dto1 = buildCreateBasinDto();
            await createBasin(dto1).expect(HttpStatus.CREATED);

            const dto2 = buildCreateBasinDto();
            const { body: basin2 } = await createBasin(dto2).expect(HttpStatus.CREATED);

            const { body } = await updateBasin(basin2.id, { name: dto1.name }).expect(HttpStatus.CONFLICT);
            expect(body.ErrorDescription).toContain('name');
        });

        it('should reject duplicate code with 409', async () => {
            const dto1 = buildCreateBasinDto();
            await createBasin(dto1).expect(HttpStatus.CREATED);

            const dto2 = buildCreateBasinDto();
            const { body: basin2 } = await createBasin(dto2).expect(HttpStatus.CREATED);

            const { body } = await updateBasin(basin2.id, { code: dto1.code }).expect(HttpStatus.CONFLICT);
            expect(body.ErrorDescription).toContain('code');
        });
    });
});
