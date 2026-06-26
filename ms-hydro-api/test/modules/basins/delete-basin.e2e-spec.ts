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
import { CreateBasinHandler, DeleteBasinHandler } from '../../../src/app/application/commands/basin.commands';
import { CreateSubBasinHandler } from '../../../src/app/application/commands/sub-basin.commands';
import { GetBasinByIdHandler } from '../../../src/app/application/queries/basin.queries';
import { BasinController } from '../../../src/app/api/controllers/basin.controller';
import { SubBasinController } from '../../../src/app/api/controllers/sub-basin.controller';

// Test helpers
import { createTestApp, TestContext } from '../../helpers/test-app.helper';
import { cleanDatabase } from '../../helpers/db.helper';
import { buildCreateBasinDto } from '../../factories/basin.factory';

describe('Delete Basin (e2e)', () => {
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
                DeleteBasinHandler,
                GetBasinByIdHandler,
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

    function deleteBasin(id: string) {
        return request(app.getHttpServer()).delete(`/basins/${id}`);
    }

    function getBasin(id: string) {
        return request(app.getHttpServer()).get(`/basins/${id}`);
    }

    // ─── Soft delete ──────────────────────────────────────────
    describe('DELETE /basins/:id', () => {
        it('should soft delete a basin (set isActive=false)', async () => {
            const dto = buildCreateBasinDto();
            const { body: basin } = await createBasin(dto).expect(HttpStatus.CREATED);

            const { body } = await deleteBasin(basin.id).expect(HttpStatus.OK);

            expect(body.id).toBe(basin.id);
            expect(body.isActive).toBe(false);
        });

        it('should be idempotent (delete already inactive)', async () => {
            const dto = buildCreateBasinDto();
            const { body: basin } = await createBasin(dto).expect(HttpStatus.CREATED);

            // First delete: active → inactive
            await deleteBasin(basin.id).expect(HttpStatus.OK);

            // Second delete: already inactive → still 200
            const { body } = await deleteBasin(basin.id).expect(HttpStatus.OK);

            expect(body.id).toBe(basin.id);
            expect(body.isActive).toBe(false);
        });

        it('should verify GET reflects the delete', async () => {
            const dto = buildCreateBasinDto();
            const { body: basin } = await createBasin(dto).expect(HttpStatus.CREATED);

            await deleteBasin(basin.id).expect(HttpStatus.OK);

            const { body } = await getBasin(basin.id).expect(HttpStatus.OK);
            expect(body.isActive).toBe(false);
        });
    });

    // ─── Not found ────────────────────────────────────────────
    describe('DELETE /basins/:id - not found', () => {
        it('should return 404 for non-existent basin', async () => {
            await deleteBasin('00000000-0000-0000-0000-000000000000').expect(HttpStatus.NOT_FOUND);
        });
    });
});
