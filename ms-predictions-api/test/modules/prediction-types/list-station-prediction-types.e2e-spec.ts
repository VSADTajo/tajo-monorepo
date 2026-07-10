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
import { CoverageReportService } from '../../../src/app/infrastructure/services/coverage-report.service';

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
                CoverageReportService,
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

    // Convenience: find a coverage row by type name.
    function typeRow(
        body: { types: Array<{ name: string; hasData: boolean; lastEntered: string | null }> },
        name: string,
    ) {
        return body.types.find((t) => t.name === name);
    }

    it('should return the whole catalog, flagging which types have data for the station', async () => {
        const stationId = 'STATION-A';
        await seedFinalizedType(stationId, 'Discharge_forecast', '2026-03-10');
        await seedFinalizedType(stationId, 'P.ens.forecast', '2026-03-11');
        // A different station seeds another catalog type — it must appear as "never" for STATION-A
        await seedFinalizedType('STATION-OTHER', 'WaterLevel_forecast', '2026-03-12');

        const { body } = await getByStation(stationId).expect(HttpStatus.OK);

        expect(body.stationCode).toBe(stationId);
        // Catalog now has 3 types; all are returned regardless of station data.
        expect(body.total).toBe(3);
        expect(body.types).toHaveLength(3);
        expect(body.withData).toBe(2);

        const discharge = typeRow(body, 'Discharge_forecast');
        const pens = typeRow(body, 'P.ens.forecast');
        const level = typeRow(body, 'WaterLevel_forecast');

        expect(discharge?.hasData).toBe(true);
        expect(discharge?.lastEntered).not.toBeNull();
        expect(pens?.hasData).toBe(true);
        expect(pens?.lastEntered).not.toBeNull();
        // Only seeded for another station → present but never entered here.
        expect(level?.hasData).toBe(false);
        expect(level?.lastEntered).toBeNull();
    });

    it('should mark types from non-finalized and soft-deleted simulations as never entered', async () => {
        const stationId = 'STATION-B';

        // Finalized → hasData
        await seedFinalizedType(stationId, 'Discharge_forecast', '2026-04-01');

        // Not finalized (left in its seeded status) → hasData false
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

        // Finalized then soft-deleted → hasData false
        const deleted = await seedFinalizedType(stationId, 'WaterLevel_forecast', '2026-04-03');
        await dataSource.query('UPDATE simulations SET "deletedAt" = now() WHERE id = $1', [deleted.simulationId]);

        const { body } = await getByStation(stationId).expect(HttpStatus.OK);

        expect(body.withData).toBe(1);
        expect(typeRow(body, 'Discharge_forecast')?.hasData).toBe(true);
        expect(typeRow(body, 'P.ens.forecast')?.hasData).toBe(false);
        expect(typeRow(body, 'WaterLevel_forecast')?.hasData).toBe(false);
    });

    it('should mark types that have a prediction but no results as never entered', async () => {
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

        expect(body.withData).toBe(1);
        expect(typeRow(body, 'Discharge_forecast')?.hasData).toBe(true);
        expect(typeRow(body, 'P.ens.forecast')?.hasData).toBe(false);
        expect(typeRow(body, 'P.ens.forecast')?.lastEntered).toBeNull();
    });

    it('should return an empty catalog coverage when no types exist yet', async () => {
        const { body } = await getByStation('UNKNOWN-STATION').expect(HttpStatus.OK);

        expect(body.stationCode).toBe('UNKNOWN-STATION');
        expect(body.total).toBe(0);
        expect(body.withData).toBe(0);
        expect(body.types).toHaveLength(0);
    });
});
