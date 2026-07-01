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
    GetHistoricalPredictionsHandler,
    GetRawPredictionsHandler,
    GetForecastPredictionsHandler,
    GetMaxAndLatestValuesHandler,
} from '../../../src/app/application/queries/prediction.queries';
import { GetAvailableDatesHandler } from '../../../src/app/application/queries/simulation.queries';
import { PredictionController } from '../../../src/app/api/controllers/prediction.controller';

import { CachingQueryBus } from '../../../src/app/infrastructure/cache/caching-query-bus.service';

import { createTestApp, TestContext } from '../../helpers/test-app.helper';
import { cleanDatabase } from '../../helpers/db.helper';
import {
    buildProcessTimeSeriesCommand,
    buildTimeSeriesData,
    buildTimeSeriesEvents,
} from '../../factories/simulation.factory';

describe('Query Predictions (e2e)', () => {
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
            controllers: [PredictionController],
            providers: [
                ProcessTimeSeriesHandler,
                GetHistoricalPredictionsHandler,
                GetRawPredictionsHandler,
                GetForecastPredictionsHandler,
                GetAvailableDatesHandler,
                GetMaxAndLatestValuesHandler,
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
    // Helpers — seed data via ProcessTimeSeriesCommand
    // ─────────────────────────────────────────────────────────────

    async function seedTimeSeries(overrides?: Parameters<typeof buildProcessTimeSeriesCommand>[0]) {
        const cmdData = buildProcessTimeSeriesCommand(overrides);
        const result = await commandBus.execute(new ProcessTimeSeriesCommand(cmdData));
        return { cmdData, result };
    }

    function getAvailableDates() {
        return request(app.getHttpServer()).get('/predictions/available-dates');
    }

    function getForecast(query?: Record<string, string>) {
        return request(app.getHttpServer())
            .get('/predictions/forecast')
            .query(query || {});
    }

    function getMaxAndLatestValues(query?: Record<string, string>) {
        return request(app.getHttpServer())
            .get('/predictions/max-and-latest-values')
            .query(query || {});
    }

    // ─────────────────────────────────────────────────────────────
    // Tests
    // ─────────────────────────────────────────────────────────────

    it('should return available dates', async () => {
        await seedTimeSeries();

        const { body } = await getAvailableDates().expect(HttpStatus.OK);

        expect(body.dates).toBeDefined();
        expect(Array.isArray(body.dates)).toBe(true);
        expect(body.dates.length).toBeGreaterThanOrEqual(1);
    });

    it('should return max-and-latest-values with maxDate field', async () => {
        const stationId = 'd0000000-0000-0000-0000-000000000004';
        const events = buildTimeSeriesEvents(5, { value: 42.5 });
        await seedTimeSeries({
            series: buildTimeSeriesData({ locationId: stationId, events }),
        });

        // Finalize simulation so max-and-latest picks it up
        // eslint-disable-next-line quotes, @typescript-eslint/quotes
        await dataSource.query("UPDATE simulations SET status = 'FINALIZED'");

        const { body } = await getMaxAndLatestValues().expect(HttpStatus.OK);

        expect(body.values).toBeDefined();
        expect(Array.isArray(body.values)).toBe(true);
        expect(body.values.length).toBeGreaterThanOrEqual(1);
        for (const item of body.values) {
            expect(item).toHaveProperty('maxValue');
            expect(item).toHaveProperty('maxDate');
            expect(item).toHaveProperty('latestValue');
            expect(item).toHaveProperty('latestDate');
        }
    });

    it('should default to latest finalized simulation when simulationDate is not provided', async () => {
        const stationId = 'd1000000-0000-0000-0000-000000000001';
        const typeName = 'Discharge_forecast';

        // Seed older simulation
        const { result: older } = await seedTimeSeries({
            series: buildTimeSeriesData({
                locationId: stationId,
                parameterId: typeName,
                startDate: '2026-01-10T00:00:00.000Z',
                forecastDate: '2026-01-10T00:00:00.000Z',
                endDate: '2026-01-10T23:00:00.000Z',
                events: buildTimeSeriesEvents(2, { value: 10 }),
            }),
            providerName: 'WRF_OLD',
        });

        // Seed newer simulation
        const { result: newer } = await seedTimeSeries({
            series: buildTimeSeriesData({
                locationId: stationId,
                parameterId: typeName,
                startDate: '2026-01-20T00:00:00.000Z',
                forecastDate: '2026-01-20T00:00:00.000Z',
                endDate: '2026-01-20T23:00:00.000Z',
                events: buildTimeSeriesEvents(2, { value: 99 }),
            }),
            providerName: 'WRF_NEW',
        });

        // Finalize both simulations directly in DB
        // eslint-disable-next-line quotes, @typescript-eslint/quotes
        const finalizeQuery = "UPDATE simulations SET status = 'FINALIZED' WHERE id IN ($1, $2)";
        await dataSource.query(finalizeQuery, [older.simulationId, newer.simulationId]);

        // Call without simulationDate — should return only latest simulation data
        const { body } = await getMaxAndLatestValues({ typeName }).expect(HttpStatus.OK);

        expect(body.values).toBeDefined();
        expect(body.values.length).toBeGreaterThanOrEqual(1);
        // All returned values should be from the newer simulation
        for (const item of body.values) {
            expect(item.simulationDate).toBe('20260120000000');
        }
    });

    it('should return specific simulation when simulationDate is provided', async () => {
        const stationId = 'd2000000-0000-0000-0000-000000000002';
        const typeName = 'Discharge_forecast';

        // Seed older simulation
        await seedTimeSeries({
            series: buildTimeSeriesData({
                locationId: stationId,
                parameterId: typeName,
                startDate: '2026-02-10T00:00:00.000Z',
                forecastDate: '2026-02-10T00:00:00.000Z',
                endDate: '2026-02-10T23:00:00.000Z',
                events: buildTimeSeriesEvents(2, { value: 15 }),
            }),
            providerName: 'WRF_A',
        });

        // Seed newer simulation
        await seedTimeSeries({
            series: buildTimeSeriesData({
                locationId: stationId,
                parameterId: typeName,
                startDate: '2026-02-20T00:00:00.000Z',
                forecastDate: '2026-02-20T00:00:00.000Z',
                endDate: '2026-02-20T23:00:00.000Z',
                events: buildTimeSeriesEvents(2, { value: 80 }),
            }),
            providerName: 'WRF_B',
        });

        // Finalize both
        // eslint-disable-next-line quotes, @typescript-eslint/quotes
        await dataSource.query("UPDATE simulations SET status = 'FINALIZED'");

        // Call with explicit older simulationDate — should return only older data
        const { body } = await getMaxAndLatestValues({
            simulationDate: '20260210000000',
            typeName,
        }).expect(HttpStatus.OK);

        expect(body.values).toBeDefined();
        for (const item of body.values) {
            expect(item.simulationDate).toBe('20260210000000');
        }
    });

    it('should isolate percentile NULL from non-NULL percentile predictions in max-and-latest', async () => {
        const stationId = 'p0000000-0000-0000-0000-000000000099';
        const baseTypeName = 'P.ens.forecast';
        const simulationDate = '20260520000000';

        // Seed deterministic forecast (percentile NULL) with low values — same simulationDate
        await seedTimeSeries({
            series: buildTimeSeriesData({
                locationId: stationId,
                parameterId: baseTypeName, // no numeric suffix → percentile = null
                startDate: '2026-05-20T00:00:00.000Z',
                forecastDate: '2026-05-20T00:00:00.000Z',
                endDate: '2026-05-20T05:00:00.000Z',
                events: buildTimeSeriesEvents(3, { value: 0.5 }),
            }),
        });

        // Seed P90 prediction with much higher values for the same station + same simulationDate
        await seedTimeSeries({
            series: buildTimeSeriesData({
                locationId: stationId,
                parameterId: `${baseTypeName}.90`, // suffix .90 → percentile = 90
                startDate: '2026-05-20T00:00:00.000Z',
                forecastDate: '2026-05-20T00:00:00.000Z',
                endDate: '2026-05-20T05:00:00.000Z',
                events: buildTimeSeriesEvents(3, { value: 12.7 }),
            }),
        });

        // eslint-disable-next-line quotes, @typescript-eslint/quotes
        await dataSource.query("UPDATE simulations SET status = 'FINALIZED'");

        // Default call (no percentile filter) — must return ONLY the percentile NULL row
        const { body: defaultBody } = await getMaxAndLatestValues({
            typeName: baseTypeName,
            simulationDate,
        }).expect(HttpStatus.OK);

        const stationItems = defaultBody.values.filter((v: { stationId: string }) => v.stationId === stationId);
        expect(stationItems).toHaveLength(1);
        expect(stationItems[0].maxValue).toBe(0.5);

        // Explicit percentile=90 — must return ONLY the percentile=90 row
        const { body: p90Body } = await getMaxAndLatestValues({
            typeName: baseTypeName,
            simulationDate,
            percentile: '90',
        }).expect(HttpStatus.OK);

        const p90Items = p90Body.values.filter((v: { stationId: string }) => v.stationId === stationId);
        expect(p90Items).toHaveLength(1);
        expect(p90Items[0].maxValue).toBe(12.7);
    });

    it('should return forecast predictions filtered by stationId', async () => {
        const stationId = 'f0000000-0000-0000-0000-000000000006';
        const events = buildTimeSeriesEvents(3);
        await seedTimeSeries({
            series: buildTimeSeriesData({ locationId: stationId, events }),
        });
        // findForecast without an explicit simulationDate only looks at FINALIZED
        // simulations (latest-finalized subquery). Seed runs leave them IN_PROGRESS,
        // so we have to finalize here for the query to find anything.
        // eslint-disable-next-line quotes, @typescript-eslint/quotes
        await dataSource.query("UPDATE simulations SET status = 'FINALIZED'");

        const { body } = await getForecast({ stationId }).expect(HttpStatus.OK);

        expect(body.predictions).toHaveLength(1);
        expect(body.predictions[0].stationId).toBe(stationId);
        expect(body.predictions[0].results).toHaveLength(events.length);
    });

    it('should return empty forecast predictions for non-forecast type', async () => {
        const stationId = 'g0000000-0000-0000-0000-000000000007';
        await seedTimeSeries({
            series: buildTimeSeriesData({
                locationId: stationId,
                parameterId: 'WaterLevel_historical',
                units: 'm',
            }),
        });

        const { body } = await getForecast({ stationId }).expect(HttpStatus.OK);

        expect(body.predictions).toHaveLength(0);
    });

    it('should filter forecast result points by the startDate/endDate window (inclusive)', async () => {
        const stationId = 'a0000000-0000-0000-0000-00000000000a';
        // buildTimeSeriesEvents seeds hourly points from 2026-03-10T00:00:00Z.
        const events = buildTimeSeriesEvents(5); // 00:00, 01:00, 02:00, 03:00, 04:00
        await seedTimeSeries({
            series: buildTimeSeriesData({ locationId: stationId, events }),
        });
        // eslint-disable-next-line quotes, @typescript-eslint/quotes
        await dataSource.query("UPDATE simulations SET status = 'FINALIZED'");

        const { body } = await getForecast({
            stationId,
            startDate: '2026-03-10T01:00:00Z',
            endDate: '2026-03-10T03:00:00Z',
        }).expect(HttpStatus.OK);

        expect(body.predictions).toHaveLength(1);
        // Only the 01:00, 02:00 and 03:00 points fall inside the window.
        expect(body.predictions[0].results).toHaveLength(3);
        const dates = body.predictions[0].results.map((r: { date: string }) => r.date);
        expect(dates).toEqual(['2026-03-10T01:00:00.000Z', '2026-03-10T02:00:00.000Z', '2026-03-10T03:00:00.000Z']);
    });

    it('should exclude predictions with no result points inside the date window', async () => {
        const stationId = 'b0000000-0000-0000-0000-00000000000b';
        await seedTimeSeries({
            series: buildTimeSeriesData({ locationId: stationId, events: buildTimeSeriesEvents(3) }),
        });
        // eslint-disable-next-line quotes, @typescript-eslint/quotes
        await dataSource.query("UPDATE simulations SET status = 'FINALIZED'");

        const { body } = await getForecast({
            stationId,
            startDate: '2026-01-01T00:00:00Z',
            endDate: '2026-01-02T00:00:00Z',
        }).expect(HttpStatus.OK);

        expect(body.predictions).toHaveLength(0);
    });

    it('should reject a forecast request with a malformed startDate', async () => {
        await getForecast({ stationId: 'c0000000-0000-0000-0000-00000000000c', startDate: 'not-a-date' }).expect(
            HttpStatus.BAD_REQUEST,
        );
    });
});
