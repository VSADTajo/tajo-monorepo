import { CommandBus } from '@nestjs/cqrs';
import { Logger } from 'nestjs-pino';

import { IMessageBroker, MessageHandler } from '../../domain/ports/message-broker.port';
import { RegisterSimulationRunCommand } from '../../application/commands/simulation-run.commands';
import { SimulationDispatchedConsumerService } from './simulation-dispatched-consumer.service';
import { Topics, Queues } from '../messaging/messaging.registry';
import { MockModelOutputService } from './mock-model-output.service';

const mockLogger = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
};

const mockCommandBus = {
    execute: jest.fn(),
};

const mockMessageBroker = {
    subscribeToTopic: jest.fn(),
    publish: jest.fn(),
    publishToTopic: jest.fn(),
};

const mockMockModelOutput = {
    seedOutput: jest.fn(),
};

describe('SimulationDispatchedConsumerService', () => {
    let service: SimulationDispatchedConsumerService;

    beforeEach(() => {
        jest.clearAllMocks();
        service = new SimulationDispatchedConsumerService(
            mockLogger as unknown as Logger,
            mockCommandBus as unknown as CommandBus,
            mockMessageBroker as unknown as IMessageBroker,
            mockMockModelOutput as unknown as MockModelOutputService,
        );
    });

    it('should call messageBroker.subscribeToTopic with the correct exchange, routing key and queue on init', async () => {
        mockMessageBroker.subscribeToTopic.mockResolvedValue(undefined);

        await service.onModuleInit();

        expect(mockMessageBroker.subscribeToTopic).toHaveBeenCalledTimes(1);
        expect(mockMessageBroker.subscribeToTopic).toHaveBeenCalledWith(
            Topics.SIMULATION_EVENTS.exchange,
            Topics.SIMULATION_EVENTS.routingKeys.MANUAL_DISPATCHED,
            Queues.MODEL_SIMULATION_DISPATCHED,
            expect.any(Function),
        );
    });

    it('should execute RegisterSimulationRunCommand with the correct payload when handler is called', async () => {
        let capturedHandler: MessageHandler<{ simulationId: string; outputFolder: string }> | null = null;

        mockMessageBroker.subscribeToTopic.mockImplementation(
            async (_exchange: string, _rk: string, _queue: string, handler: MessageHandler<any>) => {
                capturedHandler = handler;
            },
        );

        mockCommandBus.execute.mockResolvedValue({ simulationId: 'test-id', status: 'WAITING_RESULT' });

        await service.onModuleInit();

        expect(capturedHandler).not.toBeNull();

        const ack = jest.fn();
        const nack = jest.fn();
        const payload = {
            simulationId: '11111111-1111-1111-1111-111111111111',
            outputFolder: '/simulations/test/output/',
        };

        await capturedHandler!(payload, ack, nack);

        expect(mockCommandBus.execute).toHaveBeenCalledTimes(1);
        const executedCommand: RegisterSimulationRunCommand = mockCommandBus.execute.mock.calls[0][0];
        expect(executedCommand).toBeInstanceOf(RegisterSimulationRunCommand);
        expect(executedCommand.simulationId).toBe(payload.simulationId);
        expect(executedCommand.outputFolder).toBe(payload.outputFolder);
        expect(ack).toHaveBeenCalledTimes(1);
        expect(nack).not.toHaveBeenCalled();
    });

    it('should call nack(false) when handler throws an error', async () => {
        let capturedHandler: MessageHandler<{ simulationId: string; outputFolder: string }> | null = null;

        mockMessageBroker.subscribeToTopic.mockImplementation(
            async (_exchange: string, _rk: string, _queue: string, handler: MessageHandler<any>) => {
                capturedHandler = handler;
            },
        );

        mockCommandBus.execute.mockRejectedValue(new Error('Command failed'));

        await service.onModuleInit();

        const ack = jest.fn();
        const nack = jest.fn();
        const payload = {
            simulationId: '22222222-2222-2222-2222-222222222222',
            outputFolder: '/simulations/test/output/',
        };

        await capturedHandler!(payload, ack, nack);

        expect(nack).toHaveBeenCalledWith(false);
        expect(ack).not.toHaveBeenCalled();
    });

    // ── Model source ──────────────────────────────────────────────────────────

    /** Runs the subscribed handler once with the given event payload. */
    async function dispatch(payload: Record<string, unknown>) {
        const ack = jest.fn();
        const nack = jest.fn();
        mockMessageBroker.subscribeToTopic.mockImplementation(
            async (_exchange: string, _key: string, _queue: string, handler: MessageHandler<any>) => {
                await handler(payload as any, ack, nack);
            },
        );
        mockCommandBus.execute.mockResolvedValue(undefined);
        await service.onModuleInit();
        return { ack, nack };
    }

    it('should seed a reference output when the simulation runs in MOCK mode', async () => {
        mockMockModelOutput.seedOutput.mockResolvedValue('tajo/SIMULATIONS/s1/output/mock.json');

        const { ack } = await dispatch({
            simulationId: 's1',
            outputFolder: 'tajo/SIMULATIONS/s1/output',
            modelSource: 'MOCK',
        });

        expect(mockMockModelOutput.seedOutput).toHaveBeenCalledWith('tajo/SIMULATIONS/s1/output');
        expect(ack).toHaveBeenCalled();
    });

    it('should not seed anything in SFTP mode — the real model delivers the file', async () => {
        const { ack } = await dispatch({
            simulationId: 's1',
            outputFolder: 'tajo/SIMULATIONS/s1/output',
            modelSource: 'SFTP',
        });

        expect(mockMockModelOutput.seedOutput).not.toHaveBeenCalled();
        expect(ack).toHaveBeenCalled();
    });

    it('should default to SFTP when the event carries no modelSource', async () => {
        const { ack } = await dispatch({ simulationId: 's1', outputFolder: 'tajo/SIMULATIONS/s1/output' });

        expect(mockMockModelOutput.seedOutput).not.toHaveBeenCalled();
        expect(ack).toHaveBeenCalled();
    });

    it('should nack without requeue when seeding the mock output fails', async () => {
        mockMockModelOutput.seedOutput.mockRejectedValue(new Error('no reference configured'));

        const { ack, nack } = await dispatch({
            simulationId: 's1',
            outputFolder: 'tajo/SIMULATIONS/s1/output',
            modelSource: 'MOCK',
        });

        expect(nack).toHaveBeenCalledWith(false);
        expect(ack).not.toHaveBeenCalled();
    });
});
