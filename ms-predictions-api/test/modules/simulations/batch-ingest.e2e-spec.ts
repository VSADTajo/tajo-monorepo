import { INestApplication, HttpStatus } from '@nestjs/common';
import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import { DataSource } from 'typeorm';
import { StartedPostgreSqlContainer } from '@testcontainers/postgresql';

import { PredictionType } from '../../../src/app/domain/entities/prediction-type.entity';
import { Simulation } from '../../../src/app/domain/entities/simulation.entity';
import { Maneuver } from '../../../src/app/domain/entities/maneuver.entity';
import { Prediction } from '../../../src/app/domain/entities/prediction.entity';
import { PredictionResult as PredictionResultEntity } from '../../../src/app/domain/entities/prediction-result.entity';

import { IPredictionTypeRepository } from '../../../src/app/domain/ports/prediction-type-repository.port';
import { ISimulationRepository } from '../../../src/app/domain/ports/simulation-repository.port';
import { IPredictionRepository } from '../../../src/app/domain/ports/prediction-repository.port';
import { IPredictionResultRepository } from '../../../src/app/domain/ports/prediction-result-repository.port';
import { IStationThresholdService } from '../../../src/app/domain/ports/station-threshold-service.port';
import { ICacheService } from '../../../src/app/domain/ports/cache-service.port';
import { IMessageBroker } from '../../../src/app/domain/ports/message-broker.port';

import { PredictionTypeRepository } from '../../../src/app/infrastructure/persistence/prediction-type.repository';
import { SimulationRepository } from '../../../src/app/infrastructure/persistence/simulation.repository';
import { PredictionRepository } from '../../../src/app/infrastructure/persistence/prediction.repository';
import { PredictionResultRepository } from '../../../src/app/infrastructure/persistence/prediction-result.repository';
import { ProcessTimeSeriesHandler } from '../../../src/app/application/commands/prediction.commands';
import {
    FinalizeSimulationHandler,
    BatchIngestHandler,
} from '../../../src/app/application/commands/simulation.commands';
import {
    ListSimulationsHandler,
    GetSimulationByDateHandler,
    GetLatestSimulationHandler,
    GetHistoricalSimulationsHandler,
    GetAvailableDatesHandler,
} from '../../../src/app/application/queries/simulation.queries';
import { SimulationController } from '../../../src/app/api/controllers/simulation.controller';

import { CachingQueryBus } from '../../../src/app/infrastructure/cache/caching-query-bus.service';

import { createTestApp, TestContext } from '../../helpers/test-app.helper';
import { cleanDatabase } from '../../helpers/db.helper';
import { buildBatchIngestDto } from '../../factories/prediction.factory';

describe('Batch Ingest (e2e)', () => {
    let app: INestApplication;
    let dataSource: DataSource;
    let pgContainer: StartedPostgreSqlContainer;

    const mockCacheService = {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue(undefined),
        del: jest.fn().mockResolvedValue(undefined),
        delByPattern: jest.fn().mockResolvedValue(undefined),
    };

    const mockMessageBroker = {
        publish: jest.fn().mockResolvedValue(undefined),
        publishToTopic: jest.fn().mockResolvedValue(undefined),
    };

    const mockStationThresholdService = {
        getThreshold: jest.fn().mockResolvedValue(null),
    };

    beforeAll(async () => {
        const ctx: TestContext = await createTestApp({
            entities: [PredictionType, Simulation, Prediction, PredictionResultEntity, Maneuver],
            controllers: [SimulationController],
            providers: [
                ProcessTimeSeriesHandler,
                BatchIngestHandler,
                FinalizeSimulationHandler,
                ListSimulationsHandler,
                GetSimulationByDateHandler,
                GetLatestSimulationHandler,
                GetHistoricalSimulationsHandler,
                GetAvailableDatesHandler,
                { provide: IPredictionTypeRepository, useClass: PredictionTypeRepository },
                { provide: ISimulationRepository, useClass: SimulationRepository },
                { provide: IPredictionRepository, useClass: PredictionRepository },
                { provide: IPredictionResultRepository, useClass: PredictionResultRepository },
                { provide: IStationThresholdService, useValue: mockStationThresholdService },
                { provide: ICacheService, useValue: mockCacheService },
                { provide: IMessageBroker, useValue: mockMessageBroker },
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

    function batchIngest(dto: Record<string, unknown>) {
        return request(app.getHttpServer()).post('/simulations/with-predictions').send(dto);
    }

    function listSimulations() {
        return request(app.getHttpServer()).get('/simulations');
    }

    it('should create simulation with predictions in batch', async () => {
        const dto = buildBatchIngestDto();

        const { body } = await batchIngest(dto).expect(HttpStatus.CREATED);

        expect(body.simulationId).toBeDefined();
        expect(body.processedCount).toBe(dto.predictions.length);
        expect(body.errors).toEqual([]);
    });

    it('should create simulation visible in list', async () => {
        const dto = buildBatchIngestDto();
        await batchIngest(dto).expect(HttpStatus.CREATED);

        const { body } = await listSimulations().expect(HttpStatus.OK);

        expect(body.data.length).toBeGreaterThanOrEqual(1);
        expect(body.data[0].simulationDate).toBeDefined();
    });

    it('should reject empty predictions array', async () => {
        const dto = buildBatchIngestDto({ predictions: [] as never[] });

        await batchIngest(dto).expect(HttpStatus.BAD_REQUEST);
    });

    it('should reject invalid simulation date format', async () => {
        const dto = buildBatchIngestDto({ simulationDate: 'invalid-date' });

        const { body } = await batchIngest(dto).expect(HttpStatus.BAD_REQUEST);

        expect(body).toBeDefined();
    });

    it('should handle multiple predictions in a single batch', async () => {
        const baseDate = new Date('2026-03-10T00:00:00Z');
        const dto = buildBatchIngestDto({
            predictions: [
                {
                    stationId: uuidv4(),
                    typeName: 'Discharge_forecast',
                    units: 'm3/s',
                    events: [
                        { timestamp: baseDate.toISOString(), value: 10.5 },
                        { timestamp: new Date(baseDate.getTime() + 3600000).toISOString(), value: 12.3 },
                    ],
                },
                {
                    stationId: uuidv4(),
                    typeName: 'Precipitation_forecast',
                    units: 'mm',
                    events: [{ timestamp: baseDate.toISOString(), value: 5.0 }],
                },
            ],
        });

        const { body } = await batchIngest(dto).expect(HttpStatus.CREATED);

        expect(body.processedCount).toBe(2);
        expect(body.errors).toEqual([]);
    });
});
