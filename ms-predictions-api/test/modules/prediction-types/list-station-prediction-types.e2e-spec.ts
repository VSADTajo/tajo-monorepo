import { INestApplication, HttpStatus } from '@nestjs/common';
import request from 'supertest';
import { CommandBus } from '@nestjs/cqrs';
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
import {
    ProcessTimeSeriesCommand,
    ProcessTimeSeriesHandler,
} from '../../../src/app/application/commands/prediction.commands';
import {
    ListPredictionTypesHandler,
    ListStationPredictionTypesHandler,
} from '../../../src/app/application/queries/prediction-type.queries';
import { PredictionTypeController } from '../../../src/app/api/controllers/prediction-type.controller';

import { CachingQueryBus } from '../../../src/app/infrastructure/cache/caching-query-bus.service';

import { createTestApp, TestContext } from '../../helpers/test-app.helper';
import { cleanDatabase } from '../../helpers/db.helper';
import { buildProcessTimeSeriesCommand, buildTimeSeriesData } from '../../factories/simulation.factory';

describe('List Station Prediction Types (e2e)', () => {
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
            controllers: [PredictionTypeController],
            providers: [
                ProcessTimeSeriesHandler,
                ListPredictionTypesHandler,
                ListStationPredictionTypesHandler,
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

    // ─────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────

    // Seeds one finalized prediction (simulation + prediction + results) for a station + type.
    // forecastDate is varied per call so each seed lands in its own simulation.
    async function seedFinalizedType(stationId: string, typeName: string, forecastDate: string) {
        const cmdData = buildProcessTimeSeriesCommand({
            series: buildTimeSeriesData({
                locationId: stationId,
                parameterId: typeName,
                startDate: `${forecastDate}T00:00:00.000Z`,
                forecastDate: `${forecastDate}T00:00:00.000Z`,
                endDate: `${forecastDate}T05:00:00.000Z`,
            }),
            providerName: `WRF_${typeName}`,
        });
        const result = await commandBus.execute(new ProcessTimeSeriesCommand(cmdData));
        await dataSource.query('UPDATE simulations SET status = $1 WHERE id = $2', ['FINALIZED', result.simulationId]);
        return result;
    }

    function getByStation(stationCode: string) {
        return request(app.getHttpServer()).get(`/prediction-types/by-station/${stationCode}`);
    }

    // ─────────────────────────────────────────────────────────────
    // Tests
    // ─────────────────────────────────────────────────────────────

    it('should return only the types that have data for the station', async () => {
        const stationId = 'STATION-A';
        await seedFinalizedType(stationId, 'Discharge_forecast', '2026-03-10');
        await seedFinalizedType(stationId, 'P.ens.forecast', '2026-03-11');
        // A different station — must not leak into STATION-A results
        await seedFinalizedType('STATION-OTHER', 'WaterLevel_forecast', '2026-03-12');

        const { body } = await getByStation(stationId).expect(HttpStatus.OK);

        expect(body.stationCode).toBe(stationId);
        const names = body.predictionTypes.map((pt: { name: string }) => pt.name);
        expect(names).toHaveLength(2);
        expect(names).toContain('Discharge_forecast');
        expect(names).toContain('P.ens.forecast');
        expect(names).not.toContain('WaterLevel_forecast');
        for (const pt of body.predictionTypes) {
            expect(pt.id).toBeDefined();
            expect(pt.unit).toBeDefined();
        }
    });

    it('should exclude types from non-finalized and soft-deleted simulations', async () => {
        const stationId = 'STATION-B';

        // Finalized → must appear
        await seedFinalizedType(stationId, 'Discharge_forecast', '2026-04-01');

        // Not finalized (left in its seeded status) → must NOT appear
        const inProgress = await commandBus.execute(
            new ProcessTimeSeriesCommand(
                buildProcessTimeSeriesCommand({
                    series: buildTimeSeriesData({
                        locationId: stationId,
                        parameterId: 'P.ens.forecast',
                        startDate: '2026-04-02T00:00:00.000Z',
                        forecastDate: '2026-04-02T00:00:00.000Z',
                        endDate: '2026-04-02T05:00:00.000Z',
                    }),
                    providerName: 'WRF_INPROGRESS',
                }),
            ),
        );
        expect(inProgress.simulationId).toBeDefined();

        // Finalized then soft-deleted → must NOT appear
        const deleted = await seedFinalizedType(stationId, 'WaterLevel_forecast', '2026-04-03');
        await dataSource.query('UPDATE simulations SET "deletedAt" = now() WHERE id = $1', [deleted.simulationId]);

        const { body } = await getByStation(stationId).expect(HttpStatus.OK);

        const names = body.predictionTypes.map((pt: { name: string }) => pt.name);
        expect(names).toEqual(['Discharge_forecast']);
    });

    it('should exclude types that have a prediction but no results', async () => {
        const stationId = 'STATION-C';
        await seedFinalizedType(stationId, 'Discharge_forecast', '2026-05-01');
        await seedFinalizedType(stationId, 'P.ens.forecast', '2026-05-02');

        // Strip the results of P.ens.forecast — the prediction stays but has no data
        await dataSource.query(
            `DELETE FROM prediction_results pr
             USING predictions p, prediction_types pt
             WHERE pr."predictionId" = p.id
               AND p."predictionTypeId" = pt.id
               AND p."stationId" = $1
               AND pt.name = $2`,
            [stationId, 'P.ens.forecast'],
        );

        const { body } = await getByStation(stationId).expect(HttpStatus.OK);

        const names = body.predictionTypes.map((pt: { name: string }) => pt.name);
        expect(names).toEqual(['Discharge_forecast']);
    });

    it('should return an empty list for a station with no data', async () => {
        const { body } = await getByStation('UNKNOWN-STATION').expect(HttpStatus.OK);

        expect(body.stationCode).toBe('UNKNOWN-STATION');
        expect(body.predictionTypes).toHaveLength(0);
    });
});
