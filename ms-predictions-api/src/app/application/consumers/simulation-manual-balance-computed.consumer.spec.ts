import { SimulationManualBalanceComputedConsumer } from './simulation-manual-balance-computed.consumer';
import { ISimulationRepository } from '../../domain/ports/simulation-repository.port';
import { ICacheService } from '../../domain/ports/cache-service.port';
import { Simulation, SimulationStatus, SimulationType, DataOrigin } from '../../domain/entities/simulation.entity';
import { Logger } from 'nestjs-pino';
import { CommandBus } from '@nestjs/cqrs';
import { RmqContext } from '@nestjs/microservices';
import { TraceContext } from 'tajo-toolkit';
import { ProcessTimeSeriesCommand } from '../commands/prediction.commands';
import {
    buildBalanceComputedPayload,
    buildSingleSeriesPayload,
} from '../../../../test/factories/simulation-manual-balance-computed.factory';

describe('SimulationManualBalanceComputedConsumer', () => {
    let consumer: SimulationManualBalanceComputedConsumer;
    let commandBus: jest.Mocked<CommandBus>;
    let simulationRepository: jest.Mocked<ISimulationRepository>;
    let cacheService: jest.Mocked<ICacheService>;
    let traceContext: jest.Mocked<TraceContext>;
    let mockLogger: jest.Mocked<Logger>;
    let ack: jest.Mock;
    let nack: jest.Mock;

    const SIM_ID = 'sim-balance-123';

    const buildContext = (headers: Record<string, string> = {}) =>
        ({
            getChannelRef: () => ({ ack, nack }),
            getMessage: () => ({ properties: { headers } }),
        }) as unknown as RmqContext;

    const buildSimulation = (status: SimulationStatus) =>
        new Simulation({
            id: SIM_ID,
            simulationDate: '20260705120000',
            status,
            type: SimulationType.MANUAL,
            dataOrigin: DataOrigin.FORECAST,
        });

    beforeEach(() => {
        ack = jest.fn();
        nack = jest.fn();

        commandBus = {
            execute: jest.fn().mockResolvedValue({ simulationId: SIM_ID }),
        } as unknown as jest.Mocked<CommandBus>;

        simulationRepository = {
            findById: jest.fn(),
            update: jest.fn(),
            create: jest.fn(),
            findByDate: jest.fn(),
            findByDateAndEnvAndModmeteo: jest.fn(),
            findLatestFinalized: jest.fn(),
            findAll: jest.fn(),
            findHistorical: jest.fn(),
            softDelete: jest.fn(),
            findAvailableDates: jest.fn(),
            deleteOlderThan: jest.fn(),
            findManual: jest.fn(),
        } as jest.Mocked<ISimulationRepository>;

        cacheService = {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
            delByPattern: jest.fn().mockResolvedValue(undefined),
        } as jest.Mocked<ICacheService>;

        traceContext = {
            runInContext: jest.fn((_traceId: unknown, cb: () => Promise<void>) => cb()),
        } as unknown as jest.Mocked<TraceContext>;

        mockLogger = {
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
        } as unknown as jest.Mocked<Logger>;

        consumer = new SimulationManualBalanceComputedConsumer(
            mockLogger,
            commandBus,
            simulationRepository,
            cacheService,
            traceContext,
        );
    });

    // ─────────────────────────────────────────────────────────────
    // Happy path
    // ─────────────────────────────────────────────────────────────

    it('happy path: dispatches one ProcessTimeSeriesCommand per series, finalizes sim, invalidates caches, acks', async () => {
        const payload = buildBalanceComputedPayload({ simulationId: SIM_ID });
        simulationRepository.findById.mockResolvedValue(buildSimulation(SimulationStatus.MODEL_PROCESSING));
        simulationRepository.update.mockImplementation((s) => Promise.resolve(s));

        await consumer.handle(payload, buildContext());

        expect(commandBus.execute).toHaveBeenCalledTimes(payload.timeSeries.length);
        for (const call of commandBus.execute.mock.calls) {
            const cmd: ProcessTimeSeriesCommand = call[0] as ProcessTimeSeriesCommand;
            expect(cmd).toBeInstanceOf(ProcessTimeSeriesCommand);
            expect(cmd.simulationId).toBe(SIM_ID);
            expect(cmd.providerName).toBe('volume-calculator');
        }

        expect(simulationRepository.update).toHaveBeenCalledTimes(1);
        expect(cacheService.delByPattern).toHaveBeenCalledWith('simulations:*');
        expect(cacheService.delByPattern).toHaveBeenCalledWith('manual-simulation:*');
        expect(cacheService.delByPattern).toHaveBeenCalledTimes(2);
        expect(ack).toHaveBeenCalledTimes(1);
        expect(nack).not.toHaveBeenCalled();
    });

    it('happy path: does NOT update or invalidate cache when simulation is already FINALIZED', async () => {
        const payload = buildBalanceComputedPayload({ simulationId: SIM_ID });
        simulationRepository.findById.mockResolvedValue(buildSimulation(SimulationStatus.FINALIZED));

        await consumer.handle(payload, buildContext());

        expect(simulationRepository.update).not.toHaveBeenCalled();
        expect(cacheService.delByPattern).not.toHaveBeenCalled();
        expect(ack).toHaveBeenCalledTimes(1);
        expect(nack).not.toHaveBeenCalled();
    });

    it('happy path: providerName falls back to volume-calculator when missing in payload', async () => {
        const payload = buildSingleSeriesPayload('v.balance.q.in.for.harmonie', {
            simulationId: SIM_ID,
            providerName: undefined,
        });
        simulationRepository.findById.mockResolvedValue(buildSimulation(SimulationStatus.MODEL_PROCESSING));
        simulationRepository.update.mockResolvedValue(buildSimulation(SimulationStatus.FINALIZED));

        await consumer.handle(payload, buildContext());

        const cmd: ProcessTimeSeriesCommand = commandBus.execute.mock.calls[0][0] as ProcessTimeSeriesCommand;
        expect(cmd.providerName).toBe('volume-calculator');
    });

    // ─────────────────────────────────────────────────────────────
    // traceId propagation
    // ─────────────────────────────────────────────────────────────

    it('calls traceContext.runInContext once with the incoming header traceId', async () => {
        const payload = buildSingleSeriesPayload('v.balance.q.in.for.harmonie', { simulationId: SIM_ID });
        simulationRepository.findById.mockResolvedValue(buildSimulation(SimulationStatus.MODEL_PROCESSING));
        simulationRepository.update.mockResolvedValue(buildSimulation(SimulationStatus.FINALIZED));

        const headers = { 'x-trace-id': 'trace-abc-123' };
        await consumer.handle(payload, buildContext(headers));

        expect(traceContext.runInContext).toHaveBeenCalledTimes(1);
    });

    // ─────────────────────────────────────────────────────────────
    // Error paths (US3)
    // ─────────────────────────────────────────────────────────────

    it('nacks (requeue=false) when simulationId is missing, commandBus untouched', async () => {
        const payload = buildBalanceComputedPayload({ simulationId: undefined as unknown as string });

        await consumer.handle(payload, buildContext());

        expect(commandBus.execute).not.toHaveBeenCalled();
        expect(nack).toHaveBeenCalledWith(expect.anything(), false, false);
        expect(ack).not.toHaveBeenCalled();
    });

    it('nacks (requeue=false) when simulationRepository.findById throws (unknown simulationId)', async () => {
        const payload = buildBalanceComputedPayload({ simulationId: SIM_ID });
        simulationRepository.findById.mockRejectedValue(new Error('Simulation not found'));

        await consumer.handle(payload, buildContext());

        expect(commandBus.execute).toHaveBeenCalledTimes(payload.timeSeries.length);
        expect(nack).toHaveBeenCalledWith(expect.anything(), false, false);
        expect(ack).not.toHaveBeenCalled();
    });

    it('nacks (requeue=false) when commandBus.execute throws mid-batch, no partial finalize', async () => {
        const payload = buildBalanceComputedPayload({ simulationId: SIM_ID });
        commandBus.execute
            .mockResolvedValueOnce({ simulationId: SIM_ID })
            .mockRejectedValueOnce(new Error('DB error mid-batch'));

        await consumer.handle(payload, buildContext());

        expect(simulationRepository.update).not.toHaveBeenCalled();
        expect(cacheService.delByPattern).not.toHaveBeenCalled();
        expect(nack).toHaveBeenCalledWith(expect.anything(), false, false);
        expect(ack).not.toHaveBeenCalled();
    });

    it('acks with warning log when timeSeries is empty, commandBus untouched, no finalize', async () => {
        const payload = buildBalanceComputedPayload({ simulationId: SIM_ID, timeSeries: [] });

        await consumer.handle(payload, buildContext());

        expect(commandBus.execute).not.toHaveBeenCalled();
        expect(simulationRepository.update).not.toHaveBeenCalled();
        expect(mockLogger.warn).toHaveBeenCalled();
        expect(ack).toHaveBeenCalledTimes(1);
        expect(nack).not.toHaveBeenCalled();
    });

    // ─────────────────────────────────────────────────────────────
    // missVal mapping
    // ─────────────────────────────────────────────────────────────

    it('maps missVal events to isMissing=true, value=0; normal events to isMissing=false', async () => {
        const payload = buildSingleSeriesPayload('v.balance.q.in.for.harmonie', { simulationId: SIM_ID });
        simulationRepository.findById.mockResolvedValue(buildSimulation(SimulationStatus.MODEL_PROCESSING));
        simulationRepository.update.mockResolvedValue(buildSimulation(SimulationStatus.FINALIZED));

        await consumer.handle(payload, buildContext());

        const cmd: ProcessTimeSeriesCommand = commandBus.execute.mock.calls[0][0] as ProcessTimeSeriesCommand;
        const events = cmd.series.events;

        // The factory includes 1 event with value='-999.0'
        const missingEvents = events.filter((e) => e.isMissing === true);
        expect(missingEvents.length).toBeGreaterThan(0);
        missingEvents.forEach((e) => expect(e.value).toBe(0));

        const normalEvents = events.filter((e) => !e.isMissing);
        expect(normalEvents.length).toBeGreaterThan(0);
        normalEvents.forEach((e) => {
            expect(typeof e.value).toBe('number');
            expect(e.value).not.toBe(0);
        });
    });
});
