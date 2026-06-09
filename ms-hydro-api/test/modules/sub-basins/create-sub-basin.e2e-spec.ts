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
import { BasinController } from '../../../src/app/api/controllers/basin.controller';
import { SubBasinController } from '../../../src/app/api/controllers/sub-basin.controller';

// Test helpers
import { createTestApp, TestContext } from '../../helpers/test-app.helper';
import { cleanDatabase } from '../../helpers/db.helper';
import { buildCreateBasinDto } from '../../factories/basin.factory';
import { buildCreateSubBasinDto } from '../../factories/sub-basin.factory';

describe('Create SubBasin (e2e)', () => {
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

    async function setupBasin() {
        const basinDto = buildCreateBasinDto();
        const { body: basin } = await createBasin(basinDto).expect(HttpStatus.CREATED);
        return basin;
    }

    // ─── Successful creation ──────────────────────────────────
    describe('POST /sub-basins - successful creation', () => {
        it('should create a sub-basin and return its details', async () => {
            const basin = await setupBasin();
            const dto = buildCreateSubBasinDto(basin.id);

            const { body } = await createSubBasin(dto).expect(HttpStatus.CREATED);

            expect(body).toMatchObject({
                id: expect.any(String),
                name: dto.name,
                code: dto.code.toUpperCase(),
                basinId: basin.id,
                isActive: true,
            });
        });
    });

    // ─── Foreign key validation ───────────────────────────────
    describe('POST /sub-basins - foreign key validation', () => {
        it('should reject invalid basinId with 404', async () => {
            const dto = buildCreateSubBasinDto('00000000-0000-0000-0000-000000000000');

            await createSubBasin(dto).expect(HttpStatus.NOT_FOUND);
        });
    });

    // ─── Duplicate rejection ──────────────────────────────────
    describe('POST /sub-basins - duplicates', () => {
        it('should reject duplicate code with 409', async () => {
            const basin = await setupBasin();
            const dto1 = buildCreateSubBasinDto(basin.id);
            await createSubBasin(dto1).expect(HttpStatus.CREATED);

            const dto2 = buildCreateSubBasinDto(basin.id);
            (dto2 as Record<string, unknown>).code = dto1.code;

            const { body } = await createSubBasin(dto2).expect(HttpStatus.CONFLICT);
            expect(body.ErrorDescription).toContain('code');
        });

        it('should reject duplicate name within same basin with 409', async () => {
            const basin = await setupBasin();
            const dto1 = buildCreateSubBasinDto(basin.id);
            await createSubBasin(dto1).expect(HttpStatus.CREATED);

            const dto2 = buildCreateSubBasinDto(basin.id);
            (dto2 as Record<string, unknown>).name = dto1.name;

            const { body } = await createSubBasin(dto2).expect(HttpStatus.CONFLICT);
            expect(body.ErrorDescription).toContain('name');
        });
    });

    // ─── Validation errors ────────────────────────────────────
    describe('POST /sub-basins - validation', () => {
        it('should reject missing required fields with 400', async () => {
            await createSubBasin({}).expect(HttpStatus.BAD_REQUEST);
        });
    });
});
