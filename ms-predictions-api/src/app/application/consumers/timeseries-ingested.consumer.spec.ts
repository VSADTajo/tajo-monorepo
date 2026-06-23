import { TimeSeriesIngestedConsumer } from './timeseries-ingested.consumer';
import { ISimulationRepository } from '../../domain/ports/simulation-repository.port';
import { ICacheService } from '../../domain/ports/cache-service.port';
import { Simulation, SimulationStatus, SimulationType, DataOrigin } from '../../domain/entities/simulation.entity';
import { Logger } from 'nestjs-pino';
import { CommandBus } from '@nestjs/cqrs';
import { RmqContext } from '@nestjs/microservices';
import { TraceContext } from 'tajo-toolkit';

describe('TimeSeriesIngestedConsumer — cache invalidation on auto-finalize', () => {
    let consumer: TimeSeriesIngestedConsumer;
    let commandBus: jest.Mocked<CommandBus>;
    let simulationRepository: jest.Mocked<ISimulationRepository>;
    let cacheService: jest.Mocked<ICacheService>;
    let traceContext: jest.Mocked<TraceContext>;
    let mockLogger: jest.Mocked<Logger>;
    let ack: jest.Mock;
    let nack: jest.Mock;

    const buildContext = () =>
        ({
            getChannelRef: () => ({ ack, nack }),
            getMessage: () => ({ properties: { headers: {} } }),
        }) as unknown as RmqContext;

    const buildSimulation = (status: SimulationStatus) =>
        new Simulation({
            id: 'sim-1',
            simulationDate: '20260619120000',
            status,
            type: SimulationType.MANUAL,
            dataOrigin: DataOrigin.FORECAST,
        });

    const payload = {
        timeSeries: [
            {
                locationId: 'E001',
                parameterId: 'Q.sim.forecast',
                moduleInstanceId: 'MANUAL',
                forecastDate: '2026-06-19T12:00:00Z',
                startDate: '2026-06-19T12:00:00Z',
                events: [{ timestamp: '2026-06-19T12:00:00Z', value: 12.5, flag: 0 }],
            },
        ],
        simulationId: 'sim-1',
    };

    beforeEach(() => {
        ack = jest.fn();
        nack = jest.fn();

        commandBus = {
            execute: jest.fn().mockResolvedValue({ simulationId: 'sim-1' }),
        } as unknown as jest.Mocked<CommandBus>;

        simulationRepository = {
            findById: jest.fn(),
            update: jest.fn(),
        } as unknown as jest.Mocked<ISimulationRepository>;

        cacheService = {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
            delByPattern: jest.fn().mockResolvedValue(undefined),
        } as jest.Mocked<ICacheService>;

        traceContext = {
            runInContext: jest.fn((_traceId: string, cb: () => Promise<void>) => cb()),
        } as unknown as jest.Mocked<TraceContext>;

        mockLogger = {
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
        } as unknown as jest.Mocked<Logger>;

        consumer = new TimeSeriesIngestedConsumer(
            mockLogger,
            commandBus,
            simulationRepository,
            cacheService,
            traceContext,
        );
    });

    it('invalidates BOTH simulation cache namespaces after auto-finalizing', async () => {
        simulationRepository.findById.mockResolvedValue(buildSimulation(SimulationStatus.IN_PROGRESS));
        simulationRepository.update.mockImplementation((s) => Promise.resolve(s));

        await consumer.handleTimeSeriesIngested(payload, buildContext());

        expect(cacheService.delByPattern).toHaveBeenCalledWith('simulations:*');
        expect(cacheService.delByPattern).toHaveBeenCalledWith('manual-simulation:*');
        expect(cacheService.delByPattern).toHaveBeenCalledTimes(2);
        expect(ack).toHaveBeenCalled();
    });

    it('does NOT invalidate the cache when no simulation status actually changed', async () => {
        simulationRepository.findById.mockResolvedValue(buildSimulation(SimulationStatus.FINALIZED));

        await consumer.handleTimeSeriesIngested(payload, buildContext());

        expect(cacheService.delByPattern).not.toHaveBeenCalled();
        expect(ack).toHaveBeenCalled();
    });
});
