import { Logger } from 'nestjs-pino';
import { X_TRACE_ID_HEADER } from 'tajo-toolkit';
import type { TraceContext } from 'tajo-toolkit';

import { RabbitmqService } from './rabbitmq.service';
import { RabbitmqConfigService } from '@config/rabbitmq/rabbitmq-config.service';

// ─── Mock amqplib ────────────────────────────────────────────────────────────

const mockPublish = jest.fn().mockReturnValue(true);
const mockSendToQueue = jest.fn().mockReturnValue(true);
const mockPrefetch = jest.fn().mockResolvedValue(undefined);
const mockAssertQueue = jest.fn().mockResolvedValue(undefined);
const mockAssertExchange = jest.fn().mockResolvedValue(undefined);
const mockConsume = jest.fn().mockResolvedValue(undefined);
const mockBindQueue = jest.fn().mockResolvedValue(undefined);
const mockChannelClose = jest.fn().mockResolvedValue(undefined);

const mockChannel = {
    prefetch: mockPrefetch,
    assertQueue: mockAssertQueue,
    assertExchange: mockAssertExchange,
    publish: mockPublish,
    sendToQueue: mockSendToQueue,
    consume: mockConsume,
    bindQueue: mockBindQueue,
    close: mockChannelClose,
};

const mockConnectionOn = jest.fn();
const mockConnectionClose = jest.fn().mockResolvedValue(undefined);
const mockCreateChannel = jest.fn().mockResolvedValue(mockChannel);

jest.mock('amqplib', () => ({
    connect: jest.fn().mockImplementation(async () => ({
        createChannel: mockCreateChannel,
        on: mockConnectionOn,
        close: mockConnectionClose,
    })),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

const mockLogger = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
} as unknown as Logger;

function buildService(traceId: string | null = null): RabbitmqService {
    const config = {
        enabled: true,
        url: 'amqp://guest:guest@localhost:5672',
        host: 'localhost',
        port: 5672,
        prefetch: 10,
    } as unknown as RabbitmqConfigService;

    const traceContext = { traceId } as unknown as TraceContext;

    return new RabbitmqService(mockLogger, config, traceContext);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('RabbitmqService.publishToTopic()', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockCreateChannel.mockResolvedValue(mockChannel);
        mockPublish.mockReturnValue(true);
    });

    it('should pass custom headers merged with trace id when both are present', async () => {
        const service = buildService('trace-abc');
        await service.onModuleInit();
        jest.clearAllMocks();

        await service.publishToTopic(
            'x-exchange',
            'y.key',
            { msg: 'hello' },
            {
                'x-simulation-id': 'sim-1',
            },
        );

        expect(mockPublish).toHaveBeenCalledTimes(1);
        const publishOptions = mockPublish.mock.calls[0][3] as { headers?: Record<string, unknown> };
        expect(publishOptions.headers).toMatchObject({
            [X_TRACE_ID_HEADER]: 'trace-abc',
            'x-simulation-id': 'sim-1',
        });
    });

    it('should pass only trace id in headers when no custom headers provided', async () => {
        const service = buildService('trace-xyz');
        await service.onModuleInit();
        jest.clearAllMocks();

        await service.publishToTopic('x-exchange', 'y.key', { msg: 'hello' });

        expect(mockPublish).toHaveBeenCalledTimes(1);
        const publishOptions = mockPublish.mock.calls[0][3] as { headers?: Record<string, unknown> };
        expect(publishOptions.headers).toEqual({ [X_TRACE_ID_HEADER]: 'trace-xyz' });
    });

    it('should omit headers entirely when no trace id and no custom headers', async () => {
        const service = buildService(null);
        await service.onModuleInit();
        jest.clearAllMocks();

        await service.publishToTopic('x-exchange', 'y.key', { msg: 'hello' });

        expect(mockPublish).toHaveBeenCalledTimes(1);
        const publishOptions = mockPublish.mock.calls[0][3] as { headers?: Record<string, unknown> };
        expect(publishOptions.headers).toBeUndefined();
    });

    it('should preserve existing behavior when custom headers are omitted (backward compat)', async () => {
        const service = buildService('trace-back');
        await service.onModuleInit();
        jest.clearAllMocks();

        // Call WITHOUT the 4th argument — existing callers
        await service.publishToTopic('model-events', 'timeseries.ingested', { data: 123 });

        expect(mockPublish).toHaveBeenCalledTimes(1);
        const publishArgs = mockPublish.mock.calls[0];
        expect(publishArgs[0]).toBe('model-events');
        expect(publishArgs[1]).toBe('timeseries.ingested');
        const publishOptions = publishArgs[3] as { headers?: Record<string, unknown> };
        expect(publishOptions.headers).toEqual({ [X_TRACE_ID_HEADER]: 'trace-back' });
    });
});
