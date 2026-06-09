import { INestApplication, HttpStatus } from '@nestjs/common';
import request from 'supertest';
import { CommandBus } from '@nestjs/cqrs';
import { DataSource } from 'typeorm';
import { StartedPostgreSqlContainer } from '@testcontainers/postgresql';

import { PredictionType } from '../../../src/app/domain/entities/prediction-type.entity';
import { Simulation } from '../../../src/app/domain/entities/simulation.entity';
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
import { FinalizeSimulationHandler } from '../../../src/app/application/commands/simulation.commands';
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
import { buildProcessTimeSeriesCommand, buildTimeSeriesData } from '../../factories/simulation.factory';

describe('Query Simulations (e2e)', () => {
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
            entities: [PredictionType, Simulation, Prediction, PredictionResultEntity],
            controllers: [SimulationController],
            providers: [
                ProcessTimeSeriesHandler,
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

    // Helper: seed a simulation via ProcessTimeSeriesCommand
    async function seedSimulation(
        overrides?: Partial<{ forecastDate: string; providerName: string; moduleInstanceId: string }>,
    ) {
        const cmdData = buildProcessTimeSeriesCommand({
            series: buildTimeSeriesData({
                forecastDate: overrides?.forecastDate,
                moduleInstanceId: overrides?.moduleInstanceId,
            }),
            providerName: overrides?.providerName,
        });
        return commandBus.execute(new ProcessTimeSeriesCommand(cmdData));
    }

    // Helper functions (NOT async)
    function listSimulations(query?: Record<string, string | number>) {
        const req = request(app.getHttpServer()).get('/simulations');
        if (query) {
            return req.query(query);
        }
        return req;
    }

    function getSimulationByDate(simulationDate: string) {
        return request(app.getHttpServer()).get(`/simulations/${simulationDate}`);
    }

    function getLatestSimulation() {
        return request(app.getHttpServer()).get('/simulations/latest');
    }

    function getHistoricalSimulations(query?: Record<string, string | number>) {
        const req = request(app.getHttpServer()).get('/simulations/historical');
        if (query) {
            return req.query(query);
        }
        return req;
    }

    function getAvailableDates(query?: Record<string, string>) {
        const req = request(app.getHttpServer()).get('/simulations/available-dates');
        if (query) {
            return req.query(query);
        }
        return req;
    }

    function finalizeSimulation(id: string) {
        return request(app.getHttpServer()).patch(`/simulations/${id}/finalize`);
    }

    // ─────────────────────────────────────────────────────────────
    // GET /simulations (list)
    // ─────────────────────────────────────────────────────────────

    it('should list simulations', async () => {
        await seedSimulation({ forecastDate: '2026-03-10T10:00:00.000Z' });
        await seedSimulation({ forecastDate: '2026-03-11T10:00:00.000Z' });

        const { body } = await listSimulations().expect(HttpStatus.OK);

        expect(body.data).toHaveLength(2);
        expect(body.total).toBe(2);
        expect(body.page).toBe(1);
        expect(body.limit).toBe(20);
    });

    it('should filter simulations by status', async () => {
        await seedSimulation({ forecastDate: '2026-03-10T10:00:00.000Z' });

        const { body } = await listSimulations({ status: 'IN_PROGRESS' }).expect(HttpStatus.OK);

        expect(body.data.length).toBeGreaterThanOrEqual(1);
        for (const sim of body.data) {
            expect(sim.status).toBe('IN_PROGRESS');
        }
    });

    it('should return empty list when filtering by non-matching status', async () => {
        await seedSimulation({ forecastDate: '2026-03-10T10:00:00.000Z' });

        const { body } = await listSimulations({ status: 'FINALIZED' }).expect(HttpStatus.OK);

        expect(body.data).toHaveLength(0);
        expect(body.total).toBe(0);
    });

    // ─────────────────────────────────────────────────────────────
    // GET /simulations/:simulationDate
    // ─────────────────────────────────────────────────────────────

    it('should get simulation by date', async () => {
        await seedSimulation({ forecastDate: '2026-03-10T10:00:00.000Z' });

        const { body } = await getSimulationByDate('20260310100000').expect(HttpStatus.OK);

        expect(body.simulationDate).toBe('20260310100000');
        expect(body.id).toBeDefined();
    });

    it('should return 404 for non-existent simulation date', async () => {
        await getSimulationByDate('20991231235959').expect(HttpStatus.NOT_FOUND);
    });

    // ─────────────────────────────────────────────────────────────
    // GET /simulations/latest
    // ─────────────────────────────────────────────────────────────

    it('should get latest finalized simulation', async () => {
        const result = await seedSimulation({ forecastDate: '2026-03-10T10:00:00.000Z' });

        // Finalize the simulation
        await finalizeSimulation(result.simulationId).expect(HttpStatus.OK);

        const { body } = await getLatestSimulation().expect(HttpStatus.OK);

        expect(body.id).toBe(result.simulationId);
        expect(body.status).toBe('FINALIZED');
    });

    it('should return 404 when no finalized simulation exists', async () => {
        await seedSimulation({ forecastDate: '2026-03-10T10:00:00.000Z' });

        await getLatestSimulation().expect(HttpStatus.NOT_FOUND);
    });

    // ─────────────────────────────────────────────────────────────
    // GET /simulations/historical
    // ─────────────────────────────────────────────────────────────

    it('should get historical simulations', async () => {
        const result = await seedSimulation({ forecastDate: '2026-03-10T10:00:00.000Z' });
        await finalizeSimulation(result.simulationId).expect(HttpStatus.OK);

        const { body } = await getHistoricalSimulations().expect(HttpStatus.OK);

        expect(body.data.length).toBeGreaterThanOrEqual(1);
        expect(body.page).toBe(1);
        expect(body.limit).toBe(20);
    });

    // ─────────────────────────────────────────────────────────────
    // GET /simulations/available-dates
    // ─────────────────────────────────────────────────────────────

    it('should get available dates', async () => {
        await seedSimulation({ forecastDate: '2026-03-10T10:00:00.000Z' });
        await seedSimulation({ forecastDate: '2026-03-11T10:00:00.000Z' });

        const { body } = await getAvailableDates().expect(HttpStatus.OK);

        expect(body.dates).toBeDefined();
        expect(Array.isArray(body.dates)).toBe(true);
        expect(body.dates.length).toBeGreaterThanOrEqual(2);
    });

    // ─────────────────────────────────────────────────────────────
    // PATCH /simulations/:id/finalize
    // ─────────────────────────────────────────────────────────────

    it('should finalize an IN_PROGRESS simulation', async () => {
        const result = await seedSimulation({ forecastDate: '2026-03-10T10:00:00.000Z' });

        const { body } = await finalizeSimulation(result.simulationId).expect(HttpStatus.OK);

        expect(body.id).toBe(result.simulationId);
        expect(body.status).toBe('FINALIZED');
    });

    it('should return 409 when finalizing a non-IN_PROGRESS simulation', async () => {
        const result = await seedSimulation({ forecastDate: '2026-03-10T10:00:00.000Z' });

        // Finalize first time
        await finalizeSimulation(result.simulationId).expect(HttpStatus.OK);

        // Try to finalize again — should fail
        await finalizeSimulation(result.simulationId).expect(HttpStatus.CONFLICT);
    });

    it('should return 404 when finalizing a non-existent simulation', async () => {
        await finalizeSimulation('00000000-0000-0000-0000-000000000000').expect(HttpStatus.NOT_FOUND);
    });

    // ─────────────────────────────────────────────────────────────
    // DataOrigin: derivation + filtering
    // ─────────────────────────────────────────────────────────────

    it('should set dataOrigin=HISTORICAL when parameterId contains .historical', async () => {
        const cmdData = buildProcessTimeSeriesCommand({
            series: buildTimeSeriesData({
                parameterId: 'Q.historical',
                forecastDate: '2026-04-08T00:00:00.000Z',
            }),
            providerName: 'FlowCast Observados',
        });
        await commandBus.execute(new ProcessTimeSeriesCommand(cmdData));

        const { body } = await getSimulationByDate('20260408000000').expect(HttpStatus.OK);

        expect(body.dataOrigin).toBe('HISTORICAL');
    });

    it('should set dataOrigin=FORECAST when parameterId does not contain .historical', async () => {
        await seedSimulation({ forecastDate: '2026-03-15T10:00:00.000Z', providerName: 'FEWS' });

        const { body } = await getSimulationByDate('20260315100000').expect(HttpStatus.OK);

        expect(body.dataOrigin).toBe('FORECAST');
    });

    it('should filter simulations by dataOrigin=HISTORICAL', async () => {
        // Seed HISTORICAL
        const historicalCmd = buildProcessTimeSeriesCommand({
            series: buildTimeSeriesData({
                parameterId: 'Q.historical',
                forecastDate: '2026-04-10T00:00:00.000Z',
            }),
            providerName: 'FlowCast Observados',
        });
        await commandBus.execute(new ProcessTimeSeriesCommand(historicalCmd));

        // Seed FORECAST
        await seedSimulation({ forecastDate: '2026-04-11T10:00:00.000Z' });

        const { body } = await listSimulations({ dataOrigin: 'HISTORICAL' }).expect(HttpStatus.OK);

        expect(body.data.length).toBe(1);
        expect(body.data[0].dataOrigin).toBe('HISTORICAL');
    });

    it('should filter simulations by dataOrigin=FORECAST', async () => {
        // Seed HISTORICAL
        const historicalCmd = buildProcessTimeSeriesCommand({
            series: buildTimeSeriesData({
                parameterId: 'Precip.historical',
                forecastDate: '2026-04-12T00:00:00.000Z',
            }),
            providerName: 'FlowCast Observados',
        });
        await commandBus.execute(new ProcessTimeSeriesCommand(historicalCmd));

        // Seed FORECAST
        await seedSimulation({ forecastDate: '2026-04-13T10:00:00.000Z' });

        const { body } = await listSimulations({ dataOrigin: 'FORECAST' }).expect(HttpStatus.OK);

        expect(body.data.length).toBe(1);
        expect(body.data[0].dataOrigin).toBe('FORECAST');
    });

    it('should filter available-dates by dataOrigin', async () => {
        // Seed HISTORICAL
        const historicalCmd = buildProcessTimeSeriesCommand({
            series: buildTimeSeriesData({
                parameterId: 'Q.historical',
                forecastDate: '2026-04-14T00:00:00.000Z',
            }),
            providerName: 'FlowCast Observados',
        });
        await commandBus.execute(new ProcessTimeSeriesCommand(historicalCmd));

        // Seed FORECAST
        await seedSimulation({ forecastDate: '2026-04-15T10:00:00.000Z' });

        const { body: historicalDates } = await getAvailableDates({ dataOrigin: 'HISTORICAL' }).expect(HttpStatus.OK);
        expect(historicalDates.dates).toHaveLength(1);
        expect(historicalDates.dates[0]).toBe('20260414000000');

        const { body: forecastDates } = await getAvailableDates({ dataOrigin: 'FORECAST' }).expect(HttpStatus.OK);
        expect(forecastDates.dates).toHaveLength(1);
        expect(forecastDates.dates[0]).toBe('20260415100000');

        const { body: allDates } = await getAvailableDates().expect(HttpStatus.OK);
        expect(allDates.dates).toHaveLength(2);
    });
});
