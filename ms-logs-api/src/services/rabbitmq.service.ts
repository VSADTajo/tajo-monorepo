import amqp from 'amqplib';

const EXCHANGE_NAME = 'notifications';
const ROUTING_KEY = 'notification.created';

export class RabbitMQService {
    private static connection: Awaited<ReturnType<typeof amqp.connect>> | null = null;
    private static channel: Awaited<ReturnType<Awaited<ReturnType<typeof amqp.connect>>['createChannel']>> | null = null;

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
            console.error('RabbitMQ connection closed, will reconnect on next publish');
            RabbitMQService.connection = null;
            RabbitMQService.channel = null;
        });

        conn.on('error', (err: Error) => {
            console.error('RabbitMQ connection error:', err.message);
        });
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

    static async disconnect(): Promise<void> {
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
