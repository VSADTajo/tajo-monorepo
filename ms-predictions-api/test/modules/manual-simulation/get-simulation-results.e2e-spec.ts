import { INestApplication, HttpStatus } from '@nestjs/common';
import request from 'supertest';
import { CommandBus } from '@nestjs/cqrs';
import { DataSource } from 'typeorm';
import { StartedPostgreSqlContainer } from '@testcontainers/postgresql';

import { Simulation } from '../../../src/app/domain/entities/simulation.entity';
import { Maneuver } from '../../../src/app/domain/entities/maneuver.entity';
import { Prediction } from '../../../src/app/domain/entities/prediction.entity';
import { PredictionType } from '../../../src/app/domain/entities/prediction-type.entity';
import { PredictionResult } from '../../../src/app/domain/entities/prediction-result.entity';

import { ISimulationRepository } from '../../../src/app/domain/ports/simulation-repository.port';
import { IManeuverRepository } from '../../../src/app/domain/ports/maneuver-repository.port';
import { IPredictionRepository } from '../../../src/app/domain/ports/prediction-repository.port';
import { IPredictionResultRepository } from '../../../src/app/domain/ports/prediction-result-repository.port';
import { IPredictionTypeRepository } from '../../../src/app/domain/ports/prediction-type-repository.port';
import { ICacheService } from '../../../src/app/domain/ports/cache-service.port';
import { IMessageBroker } from '../../../src/app/domain/ports/message-broker.port';
import { ISimulationSftpService } from '../../../src/app/domain/ports/simulation-sftp.port';
import { IStationThresholdService } from '../../../src/app/domain/ports/station-threshold-service.port';

import { SimulationRepository } from '../../../src/app/infrastructure/persistence/simulation.repository';
import { ManeuverRepository } from '../../../src/app/infrastructure/persistence/maneuver.repository';
import { PredictionRepository } from '../../../src/app/infrastructure/persistence/prediction.repository';
import { PredictionResultRepository } from '../../../src/app/infrastructure/persistence/prediction-result.repository';
import { PredictionTypeRepository } from '../../../src/app/infrastructure/persistence/prediction-type.repository';
import { CachingQueryBus } from '../../../src/app/infrastructure/cache/caching-query-bus.service';

import { CreateManualSimulationHandler } from '../../../src/app/application/commands/manual-simulation.commands';
import {
    ProcessTimeSeriesCommand,
    ProcessTimeSeriesHandler,
} from '../../../src/app/application/commands/prediction.commands';
import { GetSimulationResultsHandler } from '../../../src/app/application/queries/manual-simulation.queries';
import { SimulationController } from '../../../src/app/api/controllers/simulation.controller';

import { createTestApp, TestContext } from '../../helpers/test-app.helper';
import { cleanDatabase } from '../../helpers/db.helper';
import { buildCreateManualSimulationDto } from '../../factories/manual-simulation.factory';
import { buildTimeSeriesData, buildTimeSeriesEvents } from '../../factories/simulation.factory';

describe('Get Simulation Results (e2e)', () => {
    let app: INestApplication;
    let dataSource: DataSource;
    let pgContainer: StartedPostgreSqlContainer;
    let commandBus: CommandBus;

    const mockSftpService = {
        uploadInputFile: jest.fn().mockResolvedValue(undefined),
        ensureOutputFolder: jest.fn().mockResolvedValue(undefined),
        listFolder: jest.fn().mockResolvedValue([]),
        downloadFile: jest.fn().mockResolvedValue(Buffer.from('')),
    };

    const mockMessageBroker = {
        publish: jest.fn().mockResolvedValue(undefined),
        publishToTopic: jest.fn().mockResolvedValue(undefined),
    };

    const mockCacheService = {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue(undefined),
        del: jest.fn().mockResolvedValue(undefined),
        delByPattern: jest.fn().mockResolvedValue(undefined),
    };

    const mockStationThresholdService = {
        getThreshold: jest.fn().mockResolvedValue(null),
    };

    beforeAll(async () => {
        const ctx: TestContext = await createTestApp({
            entities: [Simulation, Maneuver, Prediction, PredictionType, PredictionResult],
            controllers: [SimulationController],
            providers: [
                CreateManualSimulationHandler,
                ProcessTimeSeriesHandler,
                GetSimulationResultsHandler,
                { provide: ISimulationRepository, useClass: SimulationRepository },
                { provide: IManeuverRepository, useClass: ManeuverRepository },
                { provide: IPredictionRepository, useClass: PredictionRepository },
                { provide: IPredictionResultRepository, useClass: PredictionResultRepository },
                { provide: IPredictionTypeRepository, useClass: PredictionTypeRepository },
                { provide: ISimulationSftpService, useValue: mockSftpService },
                { provide: IMessageBroker, useValue: mockMessageBroker },
                { provide: ICacheService, useValue: mockCacheService },
                { provide: IStationThresholdService, useValue: mockStationThresholdService },
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

    function createManualSimulation(dto: object) {
        return request(app.getHttpServer()).post('/simulations/manual').send(dto);
    }

    function getSimulationResults(id: string) {
        return request(app.getHttpServer()).get(`/simulations/manual/${id}/results`);
    }

    it('should return 200 with sorted predictions and results for a manual simulation', async () => {
        // 1. Create a manual simulation
        const { body: sim } = await createManualSimulation(
            buildCreateManualSimulationDto({ maneuvers: [{ reservoirCode: 'E001', outputFlowValue: 10 }] }),
        ).expect(HttpStatus.CREATED);

        // 2. Seed two predictions with time-series (different stations to verify ordering)
        const stationBEvents = buildTimeSeriesEvents(3, {});
        const stationAEvents = buildTimeSeriesEvents(3, {});

        await commandBus.execute(
            new ProcessTimeSeriesCommand({
                series: buildTimeSeriesData({
                    locationId: 'AR72',
                    parameterId: 'Q.NAM.forecast',
                    moduleInstanceId: 'MOD-1',
                    stationName: 'Station AR72',
                    forecastDate: '2026-07-10T00:00:00.000Z',
                    events: stationBEvents,
                }),
                simulationId: sim.id,
            }),
        );

        await commandBus.execute(
            new ProcessTimeSeriesCommand({
                series: buildTimeSeriesData({
                    locationId: 'AR71',
                    parameterId: 'Q.NAM.forecast',
                    moduleInstanceId: 'MOD-1',
                    stationName: 'Station AR71',
                    forecastDate: '2026-07-10T00:00:00.000Z',
                    events: stationAEvents,
                }),
                simulationId: sim.id,
            }),
        );

        // 3. GET the results endpoint
        const { body } = await getSimulationResults(sim.id).expect(HttpStatus.OK);

        // Assert simulation identity
        expect(body.simulation).toBeDefined();
        expect(body.simulation.id).toBe(sim.id);
        expect(body.simulation.type).toBe('MANUAL');
        expect(body.simulation.status).toBeDefined();

        // Assert predictions are returned
        expect(Array.isArray(body.predictions)).toBe(true);
        expect(body.predictions.length).toBe(2);

        // Assert predictions are ordered by stationId ASC
        expect(body.predictions[0].stationId).toBe('AR71');
        expect(body.predictions[1].stationId).toBe('AR72');

        // Assert results are present within each prediction
        const firstPrediction = body.predictions[0];
        expect(Array.isArray(firstPrediction.results)).toBe(true);
        expect(firstPrediction.results.length).toBe(3);

        // Assert results are ordered by date ASC
        const dates = firstPrediction.results.map((r: { date: string }) => new Date(r.date).getTime());
        for (let i = 1; i < dates.length; i++) {
            expect(dates[i]).toBeGreaterThanOrEqual(dates[i - 1]);
        }

        // Assert result shape
        const firstResult = firstPrediction.results[0];
        expect(firstResult).toHaveProperty('date');
        expect(firstResult).toHaveProperty('value');
        expect(firstResult).toHaveProperty('flag');
        expect(typeof firstResult.value).toBe('number');
    });

    it('should return 200 with empty predictions when nothing has been ingested yet', async () => {
        const { body: sim } = await createManualSimulation(
            buildCreateManualSimulationDto({ maneuvers: [{ reservoirCode: 'E001', outputFlowValue: 5 }] }),
        ).expect(HttpStatus.CREATED);

        const { body } = await getSimulationResults(sim.id).expect(HttpStatus.OK);

        expect(body.simulation.id).toBe(sim.id);
        expect(body.simulation.type).toBe('MANUAL');
        expect(Array.isArray(body.predictions)).toBe(true);
        expect(body.predictions).toHaveLength(0);
    });

    it('should return 404 when the simulation is not MANUAL', async () => {
        // Insert an AUTOMATIC simulation directly via repository
        const simulationRepo = dataSource.getRepository(Simulation);
        const automaticSim = simulationRepo.create({
            simulationDate: '20260710120000',
            type: 'AUTOMATIC' as any,
            status: 'FINALIZED' as any,
        });
        const saved = await simulationRepo.save(automaticSim);

        await getSimulationResults(saved.id).expect(HttpStatus.NOT_FOUND);
    });

    it('should return 404 when the simulation does not exist', async () => {
        await getSimulationResults('00000000-0000-0000-0000-000000000000').expect(HttpStatus.NOT_FOUND);
    });

    it('should return 400 when the id is not a valid UUID', async () => {
        await getSimulationResults('not-a-uuid').expect(HttpStatus.BAD_REQUEST);
    });
});
