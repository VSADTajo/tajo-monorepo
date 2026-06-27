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
import { ICacheService } from '../../../src/app/domain/ports/cache-service.port';

// Infrastructure
import { BasinRepository } from '../../../src/app/infrastructure/persistence/basin.repository';
import { CachingQueryBus } from '../../../src/app/infrastructure/cache/caching-query-bus.service';

// Application
import { CreateBasinHandler } from '../../../src/app/application/commands/basin.commands';
import { BasinController } from '../../../src/app/api/controllers/basin.controller';

// Test helpers
import { createTestApp, TestContext } from '../../helpers/test-app.helper';
import { cleanDatabase } from '../../helpers/db.helper';
import { buildCreateBasinDto } from '../../factories/basin.factory';

describe('Create Basin (e2e)', () => {
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
            controllers: [BasinController],
            providers: [
                CreateBasinHandler,
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

    // ─── Successful creation ──────────────────────────────────
    describe('POST /basins - successful creation', () => {
        it('should create a basin and return its details', async () => {
            const dto = buildCreateBasinDto();

            const { body } = await createBasin(dto).expect(HttpStatus.CREATED);

            expect(body).toMatchObject({
                id: expect.any(String),
                name: dto.name,
                code: dto.code.toUpperCase(),
                isActive: true,
            });
        });

        it('should create basin without optional description', async () => {
            const dto = buildCreateBasinDto();
            delete (dto as Record<string, unknown>).description;

            const { body } = await createBasin(dto).expect(HttpStatus.CREATED);

            expect(body.description).toBeNull();
        });

        it('should normalize code to uppercase', async () => {
            const dto = buildCreateBasinDto();
            (dto as Record<string, unknown>).code = 'lower-code';

            const { body } = await createBasin(dto).expect(HttpStatus.CREATED);

            expect(body.code).toBe('LOWER-CODE');
        });
    });

    // ─── Duplicate rejection ──────────────────────────────────
    describe('POST /basins - duplicates', () => {
        it('should reject duplicate name with 409', async () => {
            const dto1 = buildCreateBasinDto();
            await createBasin(dto1).expect(HttpStatus.CREATED);

            const dto2 = buildCreateBasinDto();
            (dto2 as Record<string, unknown>).name = dto1.name;

            const { body } = await createBasin(dto2).expect(HttpStatus.CONFLICT);
            expect(body.ErrorDescription).toContain('name');
        });

        it('should reject duplicate code with 409', async () => {
            const dto1 = buildCreateBasinDto();
            await createBasin(dto1).expect(HttpStatus.CREATED);

            const dto2 = buildCreateBasinDto();
            (dto2 as Record<string, unknown>).code = dto1.code;

            const { body } = await createBasin(dto2).expect(HttpStatus.CONFLICT);
            expect(body.ErrorDescription).toContain('code');
        });
    });

    // ─── Validation errors ────────────────────────────────────
    describe('POST /basins - validation', () => {
        it('should reject missing required fields with 400', async () => {
            await createBasin({}).expect(HttpStatus.BAD_REQUEST);
        });
    });
});
