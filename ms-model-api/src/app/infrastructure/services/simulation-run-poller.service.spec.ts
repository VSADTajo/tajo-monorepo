import { Logger } from 'nestjs-pino';

import { ISimulationRunRepository } from '../../domain/ports/simulation-run-repository.port';
import { IMessageBroker } from '../../domain/ports/message-broker.port';
import { SimulationRun } from '../../domain/entities/simulation-run.entity';
import { SimulationRunStatus } from '../../domain/types/simulation-run-status.enum';
import { NormalizedTimeSeriesResult } from '../../domain/results/normalized-timeseries.result';
import { WiskiTimeSeriesResult } from '../../domain/results/wiski-timeseries.result';
import { ProviderError } from '../../domain/errors/provider.error';
import { SimulationResultFetcherService } from './simulation-result-fetcher.service';
import { SimulationRunPollerService } from './simulation-run-poller.service';
import { Topics } from '../messaging/messaging.registry';
import { AppConfigService } from '../../../configuration/app/app-config.service';

const mockLogger = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
};

const mockSimulationRunRepository = {
    create: jest.fn(),
    findBySimulationId: jest.fn(),
    findWaitingResult: jest.fn(),
    update: jest.fn(),
};

const mockSimulationResultFetcher = {
    fetchFromFolder: jest.fn(),
    fetchVobsSeries: jest.fn(),
};

const mockMessageBroker = {
    publish: jest.fn(),
    publishToTopic: jest.fn(),
    subscribeToTopic: jest.fn(),
};

const mockAppConfig = {
    useCalculatorPipeline: false,
};

function buildSimulationRun(overrides: Partial<SimulationRun> = {}): SimulationRun {
    const run = new SimulationRun({
        id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        simulationId: '11111111-1111-1111-1111-111111111111',
        outputFolder: '/simulations/test/output/',
        status: SimulationRunStatus.WAITING_RESULT,
        startedAt: new Date(),
        completedAt: null,
        errorMessage: null,
        ...overrides,
    });
    return run;
}

function buildTimeSeries(overrides: Partial<NormalizedTimeSeriesResult> = {}): NormalizedTimeSeriesResult {
    return new NormalizedTimeSeriesResult({
        locationId: 'E_08',
        parameterId: 'I.mk11.forecast',
        moduleInstanceId: 'Flood_Forecasting',
        stationName: 'Station 8',
        lat: 40.0,
        lon: -3.0,
        x: 0,
        y: 0,
        z: 0,
        units: 'm3/s',
        timeStep: { unit: 'hour', multiplier: 1 },
        forecastDate: '2026-06-19T00:00:00Z',
        startDate: '2026-06-19T00:00:00Z',
        endDate: '2026-06-20T00:00:00Z',
        events: [],
        ...overrides,
    });
}

function buildWiskiSeries(overrides: Partial<WiskiTimeSeriesResult['header']> = {}): WiskiTimeSeriesResult {
    return {
        header: {
            locationId: 'E_08',
            parameterId: 'VICT01.Validado',
            moduleInstanceId: 'wiski_csv',
            stationName: 'Station 8',
            units: 'hm3',
            timeStep: { unit: 'hour', multiplier: 1 },
            forecastDate: null,
            startDate: null,
            endDate: null,
            sourceTimezone: 'Europe/Madrid',
            ...overrides,
        },
        events: [{ date: '2026-06-19', time: '00:00:00', value: '22.552', flag: '2' }],
    };
}

describe('SimulationRunPollerService.pollOnce()', () => {
    let service: SimulationRunPollerService;

    beforeEach(() => {
        jest.clearAllMocks();
        mockAppConfig.useCalculatorPipeline = false;
        service = new SimulationRunPollerService(
            mockLogger as unknown as Logger,
            mockSimulationRunRepository as unknown as ISimulationRunRepository,
            mockSimulationResultFetcher as unknown as SimulationResultFetcherService,
            mockMessageBroker as unknown as IMessageBroker,
            mockAppConfig as unknown as AppConfigService,
        );
    });

    it('(a) should do nothing when no files found in the output folder', async () => {
        const run = buildSimulationRun();
        mockSimulationRunRepository.findWaitingResult.mockResolvedValue([run]);
        mockSimulationResultFetcher.fetchFromFolder.mockResolvedValue(null);

        await service.pollOnce();

        expect(mockSimulationRunRepository.update).not.toHaveBeenCalled();
        expect(mockMessageBroker.publishToTopic).not.toHaveBeenCalled();
    });

    it('(b) should publish timeseries.ingested and mark run COMPLETED when result file is valid (flag OFF)', async () => {
        const run = buildSimulationRun();
        const timeSeries = [buildTimeSeries()];

        mockSimulationRunRepository.findWaitingResult.mockResolvedValue([run]);
        mockSimulationResultFetcher.fetchFromFolder.mockResolvedValue({
            timeSeries,
            processedFileName: 'result.json',
        });
        mockSimulationRunRepository.update.mockResolvedValue(run);
        mockMessageBroker.publishToTopic.mockResolvedValue(undefined);

        await service.pollOnce();

        expect(mockMessageBroker.publishToTopic).toHaveBeenCalledTimes(1);
        expect(mockMessageBroker.publishToTopic).toHaveBeenCalledWith(
            Topics.MODEL_EVENTS.exchange,
            Topics.MODEL_EVENTS.routingKeys.TIMESERIES_INGESTED,
            expect.objectContaining({
                simulationId: run.simulationId,
                providerName: 'manual-simulation',
                seriesCount: timeSeries.length,
                timeSeries,
            }),
        );

        expect(mockSimulationResultFetcher.fetchVobsSeries).not.toHaveBeenCalled();
        expect(run.status).toBe(SimulationRunStatus.COMPLETED);
        expect(run.completedAt).toBeInstanceOf(Date);
        expect(mockSimulationRunRepository.update).toHaveBeenCalledWith(run);
    });

    it('(c) should publish simulation.status.updated with MODEL_FAILED and mark run FAILED when file is malformed', async () => {
        const run = buildSimulationRun();
        const providerError = new ProviderError('Failed to parse simulation result file');

        mockSimulationRunRepository.findWaitingResult.mockResolvedValue([run]);
        mockSimulationResultFetcher.fetchFromFolder.mockRejectedValue(providerError);
        mockSimulationRunRepository.update.mockResolvedValue(run);
        mockMessageBroker.publishToTopic.mockResolvedValue(undefined);

        await service.pollOnce();

        expect(mockMessageBroker.publishToTopic).toHaveBeenCalledTimes(1);
        expect(mockMessageBroker.publishToTopic).toHaveBeenCalledWith(
            Topics.SIMULATION_EVENTS.exchange,
            Topics.SIMULATION_EVENTS.routingKeys.STATUS_UPDATED,
            { simulationId: run.simulationId, status: 'MODEL_FAILED' },
        );

        expect(run.status).toBe(SimulationRunStatus.FAILED);
        expect(run.errorMessage).toBe(providerError.message);
        expect(mockSimulationRunRepository.update).toHaveBeenCalledWith(run);
    });

    it('(d) should publish simulation.manual.output.fetched to calculator when flag ON and v.obs is fetched', async () => {
        mockAppConfig.useCalculatorPipeline = true;
        const run = buildSimulationRun();
        const timeSeries = [buildTimeSeries()];
        const vobs = [buildWiskiSeries()];

        mockSimulationRunRepository.findWaitingResult.mockResolvedValue([run]);
        mockSimulationResultFetcher.fetchFromFolder.mockResolvedValue({
            timeSeries,
            processedFileName: 'result.json',
        });
        mockSimulationResultFetcher.fetchVobsSeries.mockResolvedValue(vobs);
        mockSimulationRunRepository.update.mockResolvedValue(run);
        mockMessageBroker.publishToTopic.mockResolvedValue(undefined);

        await service.pollOnce();

        expect(mockSimulationResultFetcher.fetchVobsSeries).toHaveBeenCalledWith(run.simulationId);
        expect(mockMessageBroker.publishToTopic).toHaveBeenCalledTimes(1);

        const [exchange, routingKey, payload, headers] = mockMessageBroker.publishToTopic.mock.calls[0];
        expect(exchange).toBe(Topics.SIMULATION_EVENTS.exchange);
        expect(routingKey).toBe(Topics.SIMULATION_EVENTS.routingKeys.MANUAL_OUTPUT_FETCHED);
        expect(payload).toMatchObject({
            simulationId: run.simulationId,
            providerName: 'manual-simulation',
            seriesCount: 2,
        });
        expect(headers).toEqual({ 'x-simulation-id': run.simulationId });

        // v.obs series is verbatim from the CSV — parameterId must NOT be reconstructed
        const wiskiEntry = payload.timeSeries.find((s: any) => s.header.parameterId === 'VICT01.Validado');
        expect(wiskiEntry).toBeDefined();
        expect(wiskiEntry.header.locationId).toBe('E_08');

        // Normalized entries must be re-shaped into { header, events } with proper date/time split
        const forecastEntry = payload.timeSeries.find((s: any) => s.header.parameterId === 'I.mk11.forecast');
        expect(forecastEntry).toBeDefined();
        expect(forecastEntry.header.locationId).toBe('E_08');

        expect(run.status).toBe(SimulationRunStatus.COMPLETED);
        expect(mockSimulationRunRepository.update).toHaveBeenCalledWith(run);
    });

    it('(e) should publish to calculator without v.obs when fetchVobsSeries returns null', async () => {
        mockAppConfig.useCalculatorPipeline = true;
        const run = buildSimulationRun();
        const timeSeries = [buildTimeSeries()];

        mockSimulationRunRepository.findWaitingResult.mockResolvedValue([run]);
        mockSimulationResultFetcher.fetchFromFolder.mockResolvedValue({
            timeSeries,
            processedFileName: 'result.json',
        });
        mockSimulationResultFetcher.fetchVobsSeries.mockResolvedValue(null);
        mockSimulationRunRepository.update.mockResolvedValue(run);
        mockMessageBroker.publishToTopic.mockResolvedValue(undefined);

        await service.pollOnce();

        expect(mockSimulationResultFetcher.fetchVobsSeries).toHaveBeenCalledWith(run.simulationId);
        expect(mockMessageBroker.publishToTopic).toHaveBeenCalledTimes(1);

        const [, routingKey, payload] = mockMessageBroker.publishToTopic.mock.calls[0];
        expect(routingKey).toBe(Topics.SIMULATION_EVENTS.routingKeys.MANUAL_OUTPUT_FETCHED);
        expect(payload.seriesCount).toBe(1);
        expect(payload.timeSeries.every((s: any) => s.header.parameterId !== 'VICT01.Validado')).toBe(true);

        expect(run.status).toBe(SimulationRunStatus.COMPLETED);
    });

    it('(f) should treat empty vobs array same as null and still publish to calculator', async () => {
        mockAppConfig.useCalculatorPipeline = true;
        const run = buildSimulationRun();
        const timeSeries = [buildTimeSeries()];

        mockSimulationRunRepository.findWaitingResult.mockResolvedValue([run]);
        mockSimulationResultFetcher.fetchFromFolder.mockResolvedValue({
            timeSeries,
            processedFileName: 'result.json',
        });
        mockSimulationResultFetcher.fetchVobsSeries.mockResolvedValue([]);
        mockSimulationRunRepository.update.mockResolvedValue(run);
        mockMessageBroker.publishToTopic.mockResolvedValue(undefined);

        await service.pollOnce();

        expect(mockMessageBroker.publishToTopic).toHaveBeenCalledTimes(1);
        const [, routingKey, payload] = mockMessageBroker.publishToTopic.mock.calls[0];
        expect(routingKey).toBe(Topics.SIMULATION_EVENTS.routingKeys.MANUAL_OUTPUT_FETCHED);
        expect(payload.seriesCount).toBe(1);
    });

    it('(g) should NEVER call fetchVobsSeries when flag OFF, even on happy path', async () => {
        mockAppConfig.useCalculatorPipeline = false;
        const run = buildSimulationRun();
        const timeSeries = [buildTimeSeries()];

        mockSimulationRunRepository.findWaitingResult.mockResolvedValue([run]);
        mockSimulationResultFetcher.fetchFromFolder.mockResolvedValue({
            timeSeries,
            processedFileName: 'result.json',
        });
        mockSimulationRunRepository.update.mockResolvedValue(run);
        mockMessageBroker.publishToTopic.mockResolvedValue(undefined);

        await service.pollOnce();

        expect(mockSimulationResultFetcher.fetchVobsSeries).not.toHaveBeenCalled();
        const [exchange, routingKey] = mockMessageBroker.publishToTopic.mock.calls[0];
        expect(exchange).toBe(Topics.MODEL_EVENTS.exchange);
        expect(routingKey).toBe(Topics.MODEL_EVENTS.routingKeys.TIMESERIES_INGESTED);
    });
});
