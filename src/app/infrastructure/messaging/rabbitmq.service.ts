import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import * as amqplib from 'amqplib';

import { IMessageBroker } from '@domain/ports/message-broker.port';
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
    ) {}

    async onModuleInit(): Promise<void> {
        if (!this.rabbitmqConfig.enabled) {
            this.logger.debug('RabbitMQ is disabled (RABBITMQ_ENABLED=false)');
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
            this.logger.debug(`RabbitMQ is disabled — message to queue "${queue}" was discarded`);
            return;
        }

        const channel = await this.ensureChannel();
        await this.assertQueue(channel, queue);

        const buffer = Buffer.from(JSON.stringify(message));
        const sent = channel.sendToQueue(queue, buffer, { persistent: true });

        if (!sent) {
            throw new ProviderError(`Failed to publish message to queue "${queue}": channel buffer full`);
        }

        this.logger.debug(`Message published to queue: ${queue}`);
    }

    async publishToTopic<T>(exchange: string, routingKey: string, message: T): Promise<void> {
        if (!this.rabbitmqConfig.enabled) {
            this.logger.debug(`RabbitMQ is disabled — message to exchange "${exchange}" [${routingKey}] was discarded`);
            return;
        }

        const channel = await this.ensureChannel();
        await this.assertTopicExchange(channel, exchange);

        const buffer = Buffer.from(JSON.stringify(message));
        channel.publish(exchange, routingKey, buffer, { persistent: true });

        this.logger.debug(`Message published to exchange: ${exchange} [${routingKey}]`);
    }
}
