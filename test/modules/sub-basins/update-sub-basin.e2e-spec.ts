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
import { ICacheService } from '../../../src/app/domain/ports/cache-service.port';

// Infrastructure
import { BasinRepository } from '../../../src/app/infrastructure/persistence/basin.repository';
import { SubBasinRepository } from '../../../src/app/infrastructure/persistence/sub-basin.repository';
import { CachingQueryBus } from '../../../src/app/infrastructure/cache/caching-query-bus.service';

// Application
import { CreateBasinHandler } from '../../../src/app/application/commands/basin.commands';
import { CreateSubBasinHandler, UpdateSubBasinHandler } from '../../../src/app/application/commands/sub-basin.commands';
import { GetSubBasinByIdHandler } from '../../../src/app/application/queries/sub-basin.queries';
import { BasinController } from '../../../src/app/api/controllers/basin.controller';
import { SubBasinController } from '../../../src/app/api/controllers/sub-basin.controller';

// Test helpers
import { createTestApp, TestContext } from '../../helpers/test-app.helper';
import { cleanDatabase } from '../../helpers/db.helper';
import { buildCreateBasinDto } from '../../factories/basin.factory';
import { buildCreateSubBasinDto } from '../../factories/sub-basin.factory';

describe('Update SubBasin (e2e)', () => {
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
            controllers: [BasinController, SubBasinController],
            providers: [
                CreateBasinHandler,
                CreateSubBasinHandler,
                UpdateSubBasinHandler,
                GetSubBasinByIdHandler,
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

    function updateSubBasin(id: string, dto: Record<string, unknown>) {
        return request(app.getHttpServer()).put(`/sub-basins/${id}`).send(dto);
    }

    function getSubBasin(id: string) {
        return request(app.getHttpServer()).get(`/sub-basins/${id}`);
    }

    async function setupSubBasin() {
        const basinDto = buildCreateBasinDto();
        const { body: basin } = await createBasin(basinDto).expect(HttpStatus.CREATED);
        const subBasinDto = buildCreateSubBasinDto(basin.id);
        const { body: subBasin } = await createSubBasin(subBasinDto).expect(HttpStatus.CREATED);
        return { basin, subBasin };
    }

    // ─── Successful updates ──────────────────────────────────────
    describe('PUT /sub-basins/:id - successful updates', () => {
        it('should update sub-basin name', async () => {
            const { subBasin } = await setupSubBasin();

            const { body } = await updateSubBasin(subBasin.id, { name: 'Updated Name' }).expect(HttpStatus.OK);

            expect(body.name).toBe('Updated Name');
        });

        it('should verify GET reflects the update', async () => {
            const { subBasin } = await setupSubBasin();

            await updateSubBasin(subBasin.id, { name: 'Verified Name' }).expect(HttpStatus.OK);

            const { body } = await getSubBasin(subBasin.id).expect(HttpStatus.OK);
            expect(body.name).toBe('Verified Name');
        });
    });

    // ─── Not found ────────────────────────────────────────────
    describe('PUT /sub-basins/:id - not found', () => {
        it('should return 404 for non-existent sub-basin', async () => {
            await updateSubBasin('00000000-0000-0000-0000-000000000000', { name: 'Test' }).expect(HttpStatus.NOT_FOUND);
        });
    });

    // ─── Conflict ─────────────────────────────────────────────
    describe('PUT /sub-basins/:id - conflicts', () => {
        it('should reject duplicate code with 409', async () => {
            const { basin } = await setupSubBasin();
            const subBasinDto2 = buildCreateSubBasinDto(basin.id);
            const { body: subBasin2 } = await createSubBasin(subBasinDto2).expect(HttpStatus.CREATED);

            // Get the first sub-basin's code
            const subBasinDto1 = buildCreateSubBasinDto(basin.id);
            const { body: subBasin1 } = await createSubBasin(subBasinDto1).expect(HttpStatus.CREATED);

            const { body } = await updateSubBasin(subBasin2.id, { code: subBasin1.code }).expect(HttpStatus.CONFLICT);
            expect(body.ErrorDescription).toContain('code');
        });
    });
});
