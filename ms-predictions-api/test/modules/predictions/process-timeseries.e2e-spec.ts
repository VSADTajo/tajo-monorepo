import { INestApplication } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { DataSource } from 'typeorm';
import { StartedPostgreSqlContainer } from '@testcontainers/postgresql';

import { PredictionType } from '../../../src/app/domain/entities/prediction-type.entity';
import { Simulation } from '../../../src/app/domain/entities/simulation.entity';
import { Prediction } from '../../../src/app/domain/entities/prediction.entity';
import { PredictionResult as PredictionResultEntity } from '../../../src/app/domain/entities/prediction-result.entity';
import { Maneuver } from '../../../src/app/domain/entities/maneuver.entity';

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

import {
    ProcessTimeSeriesCommand,
    ProcessTimeSeriesHandler,
} from '../../../src/app/application/commands/prediction.commands';

import { CachingQueryBus } from '../../../src/app/infrastructure/cache/caching-query-bus.service';

import { createTestApp, TestContext } from '../../helpers/test-app.helper';
import { cleanDatabase } from '../../helpers/db.helper';
import {
    buildProcessTimeSeriesCommand,
    buildTimeSeriesData,
    buildTimeSeriesEvents,
} from '../../factories/simulation.factory';

describe('Process TimeSeries (e2e)', () => {
    let app: INestApplication;
    let dataSource: DataSource;
    let pgContainer: StartedPostgreSqlContainer;
    let commandBus: CommandBus;

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
            controllers: [],
            providers: [
                ProcessTimeSeriesHandler,
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
        commandBus = app.get(CommandBus);
    }, 60_000);

    afterEach(async () => {
        await cleanDatabase(dataSource);
        jest.clearAllMocks();
    });

    afterAll(async () => {
        await app.close();
        await pgContainer.stop();
    });

    it('should process valid time series and create all records', async () => {
        const cmdData = buildProcessTimeSeriesCommand();
        const result = await commandBus.execute(new ProcessTimeSeriesCommand(cmdData));

        expect(result.simulationId).toBeDefined();
        expect(result.predictionId).toBeDefined();
        expect(result.resultsCount).toBe(cmdData.series.events.length);
        expect(result.notificationCreated).toBe(false);
    });

    it('should be idempotent — duplicate command skips creation', async () => {
        const cmdData = buildProcessTimeSeriesCommand();
        const result1 = await commandBus.execute(new ProcessTimeSeriesCommand(cmdData));
        const result2 = await commandBus.execute(new ProcessTimeSeriesCommand(cmdData));

        expect(result2.simulationId).toBe(result1.simulationId);
        expect(result2.predictionId).toBe(result1.predictionId);
        expect(result2.resultsCount).toBe(0); // skipped
    });

    it('should skip isMissing events', async () => {
        const events = [
            { timestamp: '2026-03-10T00:00:00Z', value: 10, flag: 0, isMissing: false },
            { timestamp: '2026-03-10T01:00:00Z', value: 20, flag: 0, isMissing: true },
            { timestamp: '2026-03-10T02:00:00Z', value: 30, flag: 0, isMissing: false },
        ];
        const cmdData = buildProcessTimeSeriesCommand({
            series: buildTimeSeriesData({ events }),
        });
        const result = await commandBus.execute(new ProcessTimeSeriesCommand(cmdData));

        expect(result.resultsCount).toBe(2); // skipped 1 missing
    });

    it('should publish notification to RabbitMQ when threshold exceeded', async () => {
        mockStationThresholdService.getThreshold.mockResolvedValueOnce(50);

        const events = buildTimeSeriesEvents(3, { value: 80 }); // all values = 80 > threshold 50
        const cmdData = buildProcessTimeSeriesCommand({
            series: buildTimeSeriesData({ events }),
        });
        const result = await commandBus.execute(new ProcessTimeSeriesCommand(cmdData));

        expect(result.notificationCreated).toBe(true);
        expect(mockMessageBroker.publishToTopic).toHaveBeenCalledWith(
            'notifications',
            'notification.created',
            expect.objectContaining({
                type: 'THRESHOLD_EXCEEDED',
                source: 'ms-predictions-api',
                severity: 'CRITICAL',
                metadata: expect.objectContaining({
                    thresholdValue: 50,
                    actualValue: 80,
                }),
            }),
        );
    });

    it('should NOT publish notification when threshold not exceeded', async () => {
        mockStationThresholdService.getThreshold.mockResolvedValueOnce(100);

        const events = buildTimeSeriesEvents(3, { value: 50 }); // all values = 50 < threshold 100
        const cmdData = buildProcessTimeSeriesCommand({
            series: buildTimeSeriesData({ events }),
        });
        const result = await commandBus.execute(new ProcessTimeSeriesCommand(cmdData));

        expect(result.notificationCreated).toBe(false);
        expect(mockMessageBroker.publishToTopic).not.toHaveBeenCalled();
    });

    it('should create PredictionType if not exists', async () => {
        const cmdData = buildProcessTimeSeriesCommand({
            series: buildTimeSeriesData({ parameterId: 'NewCustomType', units: 'custom_unit' }),
        });
        const result = await commandBus.execute(new ProcessTimeSeriesCommand(cmdData));

        expect(result.simulationId).toBeDefined();
        expect(result.predictionId).toBeDefined();
    });
});
