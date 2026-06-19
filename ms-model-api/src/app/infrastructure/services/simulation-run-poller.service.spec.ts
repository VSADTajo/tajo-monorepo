import { Logger } from 'nestjs-pino';

import { ISimulationRunRepository } from '../../domain/ports/simulation-run-repository.port';
import { IMessageBroker } from '../../domain/ports/message-broker.port';
import { SimulationRun } from '../../domain/entities/simulation-run.entity';
import { SimulationRunStatus } from '../../domain/types/simulation-run-status.enum';
import { NormalizedTimeSeriesResult } from '../../domain/results/normalized-timeseries.result';
import { ProviderError } from '../../domain/errors/provider.error';
import { SimulationResultFetcherService } from './simulation-result-fetcher.service';
import { SimulationRunPollerService } from './simulation-run-poller.service';
import { Topics } from '../messaging/messaging.registry';

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
};

const mockMessageBroker = {
    publish: jest.fn(),
    publishToTopic: jest.fn(),
    subscribeToTopic: jest.fn(),
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

function buildTimeSeries(): NormalizedTimeSeriesResult {
    return new NormalizedTimeSeriesResult({
        locationId: 'LOC_001',
        parameterId: 'Q',
        moduleInstanceId: 'Flood_Forecasting',
        stationName: 'Station 1',
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
    });
}

describe('SimulationRunPollerService.pollOnce()', () => {
    let service: SimulationRunPollerService;

    beforeEach(() => {
        jest.clearAllMocks();
        service = new SimulationRunPollerService(
            mockLogger as unknown as Logger,
            mockSimulationRunRepository as unknown as ISimulationRunRepository,
            mockSimulationResultFetcher as unknown as SimulationResultFetcherService,
            mockMessageBroker as unknown as IMessageBroker,
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

    it('(b) should publish timeseries.ingested and mark run COMPLETED when result file is valid', async () => {
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
});
