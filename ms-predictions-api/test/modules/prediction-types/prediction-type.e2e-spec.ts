import { INestApplication, HttpStatus } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { StartedPostgreSqlContainer } from '@testcontainers/postgresql';

import { PredictionType } from '../../../src/app/domain/entities/prediction-type.entity';
import { IPredictionTypeRepository } from '../../../src/app/domain/ports/prediction-type-repository.port';
import { ICacheService } from '../../../src/app/domain/ports/cache-service.port';

import { PredictionTypeRepository } from '../../../src/app/infrastructure/persistence/prediction-type.repository';
import { ListPredictionTypesHandler } from '../../../src/app/application/queries/prediction-type.queries';
import { CreatePredictionTypeHandler } from '../../../src/app/application/commands/prediction-type.commands';
import { PredictionTypeController } from '../../../src/app/api/controllers/prediction-type.controller';

import { CachingQueryBus } from '../../../src/app/infrastructure/cache/caching-query-bus.service';
import { CoverageReportService } from '../../../src/app/infrastructure/services/coverage-report.service';

import { createTestApp, TestContext } from '../../helpers/test-app.helper';
import { cleanDatabase } from '../../helpers/db.helper';
import { buildCreatePredictionTypeDto } from '../../factories/prediction-type.factory';

describe('PredictionTypes (e2e)', () => {
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
            entities: [PredictionType],
            controllers: [PredictionTypeController],
            providers: [
                ListPredictionTypesHandler,
                CreatePredictionTypeHandler,
                { provide: IPredictionTypeRepository, useClass: PredictionTypeRepository },
                { provide: ICacheService, useValue: mockCacheService },
                CoverageReportService,
                CachingQueryBus,
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

    // ─────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────

    function createPredictionType(dto: { name: string; unit: string }) {
        return request(app.getHttpServer()).post('/prediction-types').send(dto);
    }

    function listPredictionTypes() {
        return request(app.getHttpServer()).get('/prediction-types');
    }

    // ─────────────────────────────────────────────────────────────
    // Tests
    // ─────────────────────────────────────────────────────────────

    it('should create a prediction type', async () => {
        const dto = buildCreatePredictionTypeDto({ name: 'P.harmonie.forecast' });

        const { body } = await createPredictionType(dto).expect(HttpStatus.CREATED);

        expect(body.id).toBeDefined();
        expect(body.name).toBe('P.harmonie.forecast');
        expect(body.unit).toBe(dto.unit);
    });

    it('should return 409 when creating a duplicate prediction type', async () => {
        const dto = buildCreatePredictionTypeDto({ name: 'P.ens.forecast' });

        await createPredictionType(dto).expect(HttpStatus.CREATED);
        await createPredictionType(dto).expect(HttpStatus.CONFLICT);
    });

    it('should return 400 for invalid payload', async () => {
        await createPredictionType({ name: '', unit: 'mm' }).expect(HttpStatus.BAD_REQUEST);
        await createPredictionType({ name: 'P.test', unit: '' }).expect(HttpStatus.BAD_REQUEST);
    });

    it('should list all prediction types', async () => {
        const dto1 = buildCreatePredictionTypeDto({ name: 'P.harmonie.forecast' });
        const dto2 = buildCreatePredictionTypeDto({ name: 'P.ens.forecast' });

        await createPredictionType(dto1).expect(HttpStatus.CREATED);
        await createPredictionType(dto2).expect(HttpStatus.CREATED);

        const { body } = await listPredictionTypes().expect(HttpStatus.OK);

        expect(body.predictionTypes).toHaveLength(2);
        const names = body.predictionTypes.map((pt: { name: string }) => pt.name);
        expect(names).toContain('P.harmonie.forecast');
        expect(names).toContain('P.ens.forecast');
    });

    it('should return empty list when no prediction types exist', async () => {
        const { body } = await listPredictionTypes().expect(HttpStatus.OK);

        expect(body.predictionTypes).toHaveLength(0);
    });
});
