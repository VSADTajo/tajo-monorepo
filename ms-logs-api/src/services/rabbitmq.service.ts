import amqp from 'amqplib';
import {
    WebhookDispatchService,
    SIMULATION_EVENTS_EXCHANGE,
    WEBHOOK_SOURCE_ROUTING_KEYS,
} from './webhook-dispatch.service';

const EXCHANGE_NAME = 'notifications';
const ROUTING_KEY = 'notification.created';

// Queue this service owns to receive platform events and fan them out to webhook subscribers.
const WEBHOOK_QUEUE = 'logs-webhook-dispatch';

const PREFETCH = Number(process.env.RABBITMQ_PREFETCH) || 10;
const RECONNECT_DELAY_MS = 5000;

export class RabbitMQService {
    private static connection: Awaited<ReturnType<typeof amqp.connect>> | null = null;
    private static channel: Awaited<ReturnType<Awaited<ReturnType<typeof amqp.connect>>['createChannel']>> | null = null;
    // Whether the webhook consumer was started, so it can be re-registered after a reconnect.
    private static consumerActive = false;
    private static reconnecting = false;
    private static shuttingDown = false;

    static async connect(): Promise<void> {
        const host = process.env.RABBITMQ_HOST || 'localhost';
        const port = process.env.RABBITMQ_PORT || '5672';
        const user = process.env.RABBITMQ_USER || 'guest';
        const password = process.env.RABBITMQ_PASSWORD || 'guest';

        const url = `amqp://${user}:${password}@${host}:${port}`;

        const conn = await amqp.connect(url);
        RabbitMQService.connection = conn;

        const ch = await conn.createChannel();
        RabbitMQService.channel = ch;

        await ch.assertExchange(EXCHANGE_NAME, 'topic', { durable: true });

        console.log(`RabbitMQ connected: ${host}:${port}, exchange "${EXCHANGE_NAME}" asserted`);

        conn.on('close', () => {
            RabbitMQService.connection = null;
            RabbitMQService.channel = null;
            if (RabbitMQService.shuttingDown) return;
            console.error('RabbitMQ connection closed');
            // If the webhook consumer was active, proactively reconnect and re-register it,
            // otherwise webhook delivery stops silently until the process restarts.
            if (RabbitMQService.consumerActive) {
                RabbitMQService.scheduleReconnect();
            }
        });

        conn.on('error', (err: Error) => {
            console.error('RabbitMQ connection error:', err.message);
        });
    }

    private static scheduleReconnect(): void {
        if (RabbitMQService.reconnecting || RabbitMQService.shuttingDown) return;
        RabbitMQService.reconnecting = true;
        setTimeout(async () => {
            try {
                await RabbitMQService.connect();
                if (RabbitMQService.consumerActive) {
                    await RabbitMQService.consumeSimulationEvents();
                }
                RabbitMQService.reconnecting = false;
                console.log('RabbitMQ reconnected and webhook consumer re-registered');
            } catch (err: unknown) {
                RabbitMQService.reconnecting = false;
                console.error('RabbitMQ reconnect failed, will retry:', err instanceof Error ? err.message : err);
                RabbitMQService.scheduleReconnect();
            }
        }, RECONNECT_DELAY_MS);
    }

    static async publish(payload: object): Promise<void> {
        if (!RabbitMQService.channel) {
            await RabbitMQService.connect();
        }

        if (!RabbitMQService.channel) {
            throw new Error('RabbitMQ channel not available after reconnect attempt');
        }

        const message = Buffer.from(JSON.stringify(payload));
        RabbitMQService.channel.publish(EXCHANGE_NAME, ROUTING_KEY, message, {
            persistent: true,
            contentType: 'application/json',
        });
    }

    /**
     * Subscribe to the `simulation-events` topic exchange and fan each event out to the
     * matching webhook subscriptions. Manual ack with bounded prefetch.
     *
     * On error the message is NACKed **without requeue** on purpose: delivery failures are already
     * handled and recorded inside the dispatcher (never thrown), so a throw here means a poison
     * message (unparseable) or a transient store error. Requeueing would create a tight infinite
     * redelivery loop (no DLX/attempt-counter on this queue), so we drop-and-log instead.
     */
    static async consumeSimulationEvents(): Promise<void> {
        if (!RabbitMQService.channel) {
            await RabbitMQService.connect();
        }
        const ch = RabbitMQService.channel;
        if (!ch) {
            throw new Error('RabbitMQ channel not available for webhook consumer');
        }

        RabbitMQService.consumerActive = true;
        await ch.assertExchange(SIMULATION_EVENTS_EXCHANGE, 'topic', { durable: true });
        await ch.assertQueue(WEBHOOK_QUEUE, { durable: true });
        await ch.prefetch(PREFETCH);
        for (const routingKey of WEBHOOK_SOURCE_ROUTING_KEYS) {
            await ch.bindQueue(WEBHOOK_QUEUE, SIMULATION_EVENTS_EXCHANGE, routingKey);
        }

        await ch.consume(WEBHOOK_QUEUE, async (msg) => {
            if (!msg) return;
            const routingKey = msg.fields.routingKey;
            try {
                const payload = JSON.parse(msg.content.toString()) as Record<string, unknown>;
                await WebhookDispatchService.handleIncomingEvent(routingKey, payload);
                ch.ack(msg);
            } catch (error: unknown) {
                const message = error instanceof Error ? error.message : 'Unknown error';
                console.error(`Webhook consumer dropped message for routingKey "${routingKey}": ${message}`);
                ch.nack(msg, false, false); // drop (no requeue) — avoids an infinite redelivery loop
            }
        });

        console.log(`RabbitMQ webhook consumer bound: queue "${WEBHOOK_QUEUE}" ← exchange "${SIMULATION_EVENTS_EXCHANGE}"`);
    }

    static async disconnect(): Promise<void> {
        RabbitMQService.shuttingDown = true;
        RabbitMQService.consumerActive = false;
        if (RabbitMQService.channel) {
            await RabbitMQService.channel.close();
            RabbitMQService.channel = null;
        }
        if (RabbitMQService.connection) {
            await RabbitMQService.connection.close();
            RabbitMQService.connection = null;
        }
    }
}
