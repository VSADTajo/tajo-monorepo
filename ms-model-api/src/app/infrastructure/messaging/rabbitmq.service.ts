import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import * as amqplib from 'amqplib';
import { TraceContext, X_TRACE_ID_HEADER } from 'tajo-toolkit';

import { AmqpHeaders, IMessageBroker, MessageHandler } from '@domain/ports/message-broker.port';
import { ProviderError } from '@domain/errors/provider.error';
import { RabbitmqConfigService } from '@config/rabbitmq/rabbitmq-config.service';

@Injectable()
export class RabbitmqService implements IMessageBroker, OnModuleInit, OnModuleDestroy {
    private connection: amqplib.ChannelModel | null = null;
    private channel: amqplib.Channel | null = null;
    private readonly assertedQueues = new Set<string>();
    private readonly assertedExchanges = new Set<string>();

    constructor(
        @Inject(Logger)
        private readonly logger: Logger,
        private readonly rabbitmqConfig: RabbitmqConfigService,
        private readonly traceContext: TraceContext,
    ) {}

    async onModuleInit(): Promise<void> {
        if (!this.rabbitmqConfig.enabled) {
            this.logger.log('RabbitMQ is disabled (RABBITMQ_ENABLED=false)');
            return;
        }
        await this.connect();
    }

    async onModuleDestroy(): Promise<void> {
        if (!this.rabbitmqConfig.enabled) return;
        await this.disconnect();
    }

    private async connect(): Promise<void> {
        try {
            this.connection = await amqplib.connect(this.rabbitmqConfig.url);
            this.channel = await this.connection.createChannel();
            await this.channel.prefetch(this.rabbitmqConfig.prefetch);

            this.connection.on('error', (err: Error) => {
                this.logger.error({ msg: 'RabbitMQ connection error', entity: 'Messaging', error: err.message });
            });

            this.connection.on('close', () => {
                this.logger.warn({ msg: 'RabbitMQ connection closed', entity: 'Messaging' });
                this.channel = null;
                this.connection = null;
                this.assertedQueues.clear();
                this.assertedExchanges.clear();
            });

            this.logger.debug(`RabbitMQ connected: ${this.rabbitmqConfig.host}:${this.rabbitmqConfig.port}`);
        } catch (error) {
            this.logger.error({ msg: 'RabbitMQ connection failed', entity: 'Messaging', error: String(error) });
            throw new ProviderError(`Failed to connect to RabbitMQ: ${error}`);
        }
    }

    private async disconnect(): Promise<void> {
        try {
            if (this.channel) await this.channel.close();
            if (this.connection) await this.connection.close();
            this.logger.debug('RabbitMQ disconnected');
        } catch (error) {
            this.logger.warn({ msg: 'RabbitMQ disconnect error', entity: 'Messaging', error: String(error) });
        }
    }

    private async ensureChannel(): Promise<amqplib.Channel> {
        if (!this.channel) {
            await this.connect();
        }
        if (!this.channel) {
            throw new ProviderError('RabbitMQ channel is not available');
        }
        return this.channel;
    }

    private async assertQueue(channel: amqplib.Channel, queue: string): Promise<void> {
        if (this.assertedQueues.has(queue)) return;
        await channel.assertQueue(queue, { durable: true });
        this.assertedQueues.add(queue);
    }

    private async assertTopicExchange(channel: amqplib.Channel, exchange: string): Promise<void> {
        if (this.assertedExchanges.has(exchange)) return;
        await channel.assertExchange(exchange, 'topic', { durable: true });
        this.assertedExchanges.add(exchange);
    }

    async publish<T>(queue: string, message: T): Promise<void> {
        if (!this.rabbitmqConfig.enabled) {
            this.logger.warn({ msg: 'RabbitMQ is disabled — message discarded', entity: 'Messaging', queue });
            return;
        }

        const channel = await this.ensureChannel();
        await this.assertQueue(channel, queue);

        const traceId = this.traceContext.traceId;
        const buffer = Buffer.from(JSON.stringify(message));
        const sent = channel.sendToQueue(queue, buffer, {
            persistent: true,
            headers: traceId ? { [X_TRACE_ID_HEADER]: traceId } : undefined,
        });

        if (!sent) {
            throw new ProviderError(`Failed to publish message to queue "${queue}": channel buffer full`);
        }

        this.logger.debug(`Message published to queue: ${queue}`);
    }

    async publishToTopic<T>(exchange: string, routingKey: string, message: T, headers?: AmqpHeaders): Promise<void> {
        if (!this.rabbitmqConfig.enabled) {
            this.logger.warn({
                msg: 'RabbitMQ is disabled — message discarded',
                entity: 'Messaging',
                exchange,
                routingKey,
            });
            return;
        }

        const channel = await this.ensureChannel();
        await this.assertTopicExchange(channel, exchange);

        const traceId = this.traceContext.traceId;
        const baseHeaders: Record<string, string | number | boolean> = {};
        if (traceId) baseHeaders[X_TRACE_ID_HEADER] = traceId;
        if (headers) Object.assign(baseHeaders, headers);
        const finalHeaders = Object.keys(baseHeaders).length > 0 ? baseHeaders : undefined;

        const envelope = { pattern: routingKey, data: message };
        const buffer = Buffer.from(JSON.stringify(envelope));
        channel.publish(exchange, routingKey, buffer, {
            persistent: true,
            headers: finalHeaders,
        });

        this.logger.debug(`Message published to exchange: ${exchange} [${routingKey}]`);
    }

    async subscribeToTopic<T>(
        exchange: string,
        routingKey: string,
        queue: string,
        handler: MessageHandler<T>,
    ): Promise<void> {
        if (!this.rabbitmqConfig.enabled) {
            this.logger.warn({
                msg: 'RabbitMQ is disabled — subscribeToTopic is a no-op',
                entity: 'Messaging',
                exchange,
                routingKey,
                queue,
            });
            return;
        }

        const channel = await this.ensureChannel();
        await this.assertTopicExchange(channel, exchange);
        await this.assertQueue(channel, queue);
        await channel.bindQueue(queue, exchange, routingKey);

        await channel.consume(queue, async (msg) => {
            if (!msg) return;

            let payload: T;
            try {
                const raw = JSON.parse(msg.content.toString());
                // Support both plain payloads and NestJS envelope { pattern, data }
                payload = raw?.data !== undefined ? (raw.data as T) : (raw as T);
            } catch (parseError) {
                this.logger.error({
                    msg: 'Failed to parse RabbitMQ message — nacking without requeue',
                    entity: 'Messaging',
                    queue,
                    error: String(parseError),
                });
                channel.nack(msg, false, false);
                return;
            }

            const ack = (): void => {
                channel.ack(msg);
            };

            const nack = (requeue: boolean): void => {
                channel.nack(msg, false, requeue);
            };

            try {
                await handler(payload, ack, nack);
            } catch (error) {
                this.logger.error({
                    msg: 'RabbitMQ message handler threw an unhandled error — nacking with requeue',
                    entity: 'Messaging',
                    queue,
                    error: String(error),
                });
                channel.nack(msg, false, true);
            }
        });

        this.logger.log(`Subscribed to exchange "${exchange}" routing key "${routingKey}" on queue "${queue}"`);
    }
}
