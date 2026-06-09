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
import { CreateSubBasinHandler, DeleteSubBasinHandler } from '../../../src/app/application/commands/sub-basin.commands';
import { CreateStationHandler } from '../../../src/app/application/commands/station.commands';
import { GetSubBasinByIdHandler } from '../../../src/app/application/queries/sub-basin.queries';
import { BasinController } from '../../../src/app/api/controllers/basin.controller';
import { SubBasinController } from '../../../src/app/api/controllers/sub-basin.controller';
import { StationController } from '../../../src/app/api/controllers/station.controller';

// Test helpers
import { createTestApp, TestContext } from '../../helpers/test-app.helper';
import { cleanDatabase } from '../../helpers/db.helper';
import { buildCreateBasinDto } from '../../factories/basin.factory';
import { buildCreateSubBasinDto } from '../../factories/sub-basin.factory';

describe('Delete SubBasin (e2e)', () => {
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
                DeleteSubBasinHandler,
                GetSubBasinByIdHandler,
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

    function deleteSubBasin(id: string) {
        return request(app.getHttpServer()).delete(`/sub-basins/${id}`);
    }

    function getSubBasin(id: string) {
        return request(app.getHttpServer()).get(`/sub-basins/${id}`);
    }

    async function setupSubBasin() {
        const basinDto = buildCreateBasinDto();
        const { body: basin } = await createBasin(basinDto).expect(HttpStatus.CREATED);
        const subBasinDto = buildCreateSubBasinDto(basin.id);
        const { body: subBasin } = await createSubBasin(subBasinDto).expect(HttpStatus.CREATED);
        return subBasin;
    }

    // ─── Soft delete ──────────────────────────────────────────
    describe('DELETE /sub-basins/:id', () => {
        it('should soft delete a sub-basin (set isActive=false)', async () => {
            const subBasin = await setupSubBasin();

            const { body } = await deleteSubBasin(subBasin.id).expect(HttpStatus.OK);

            expect(body.id).toBe(subBasin.id);
            expect(body.isActive).toBe(false);
        });

        it('should be idempotent (delete already inactive)', async () => {
            const subBasin = await setupSubBasin();

            // First delete: active → inactive
            await deleteSubBasin(subBasin.id).expect(HttpStatus.OK);

            // Second delete: already inactive → still 200
            const { body } = await deleteSubBasin(subBasin.id).expect(HttpStatus.OK);

            expect(body.id).toBe(subBasin.id);
            expect(body.isActive).toBe(false);
        });

        it('should verify GET reflects the delete', async () => {
            const subBasin = await setupSubBasin();

            await deleteSubBasin(subBasin.id).expect(HttpStatus.OK);

            const { body } = await getSubBasin(subBasin.id).expect(HttpStatus.OK);
            expect(body.isActive).toBe(false);
        });
    });

    // ─── Not found ────────────────────────────────────────────
    describe('DELETE /sub-basins/:id - not found', () => {
        it('should return 404 for non-existent sub-basin', async () => {
            await deleteSubBasin('00000000-0000-0000-0000-000000000000').expect(HttpStatus.NOT_FOUND);
        });
    });
});
