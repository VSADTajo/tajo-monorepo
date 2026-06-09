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
import { CreateSubBasinHandler } from '../../../src/app/application/commands/sub-basin.commands';
import { GetBasinByIdHandler } from '../../../src/app/application/queries/basin.queries';
import { BasinController } from '../../../src/app/api/controllers/basin.controller';
import { SubBasinController } from '../../../src/app/api/controllers/sub-basin.controller';

// Test helpers
import { createTestApp, TestContext } from '../../helpers/test-app.helper';
import { cleanDatabase } from '../../helpers/db.helper';
import { buildCreateBasinDto } from '../../factories/basin.factory';
import { buildCreateSubBasinDto } from '../../factories/sub-basin.factory';

describe('Get Basin (e2e)', () => {
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

    function createSubBasin(dto: Record<string, unknown>) {
        return request(app.getHttpServer()).post('/sub-basins').send(dto);
    }

    function getBasin(id: string) {
        return request(app.getHttpServer()).get(`/basins/${id}`);
    }

    // ─── Successful retrieval ──────────────────────────────────
    describe('GET /basins/:id - successful retrieval', () => {
        it('should return basin with sub-basins included', async () => {
            const basinDto = buildCreateBasinDto();
            const { body: basin } = await createBasin(basinDto).expect(HttpStatus.CREATED);

            const subBasinDto1 = buildCreateSubBasinDto(basin.id);
            await createSubBasin(subBasinDto1).expect(HttpStatus.CREATED);
            const subBasinDto2 = buildCreateSubBasinDto(basin.id);
            await createSubBasin(subBasinDto2).expect(HttpStatus.CREATED);

            const { body } = await getBasin(basin.id).expect(HttpStatus.OK);

            expect(body.id).toBe(basin.id);
            expect(body.name).toBe(basinDto.name);
            expect(body.subBasins).toHaveLength(2);
            expect(body.subBasins[0]).toHaveProperty('id');
            expect(body.subBasins[0]).toHaveProperty('name');
            expect(body.subBasins[0]).toHaveProperty('code');
            expect(body.subBasins[0]).toHaveProperty('isActive');
        });

        it('should return basin with empty sub-basins array when none exist', async () => {
            const basinDto = buildCreateBasinDto();
            const { body: basin } = await createBasin(basinDto).expect(HttpStatus.CREATED);

            const { body } = await getBasin(basin.id).expect(HttpStatus.OK);

            expect(body.subBasins).toEqual([]);
        });
    });

    // ─── Not found ────────────────────────────────────────────
    describe('GET /basins/:id - not found', () => {
        it('should return 404 for non-existent basin', async () => {
            const { body } = await getBasin('00000000-0000-0000-0000-000000000000').expect(HttpStatus.NOT_FOUND);

            expect(body.ErrorDescription).toBeDefined();
        });
    });
});
