import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AllConfig } from '@config/configuration.type';

@Injectable()
export class RabbitmqConfigService {
    constructor(private configService: ConfigService<AllConfig>) {}

    public get enabled(): boolean {
        return this.configService.getOrThrow('rabbitmq.enabled', { infer: true });
    }

    public get host(): string {
        return this.configService.getOrThrow('rabbitmq.host', { infer: true });
    }

    public get port(): number {
        return this.configService.getOrThrow('rabbitmq.port', { infer: true });
    }

    public get user(): string {
        return this.configService.getOrThrow('rabbitmq.user', { infer: true });
    }

    public get password(): string {
        return this.configService.getOrThrow('rabbitmq.password', { infer: true });
    }

    public get vhost(): string {
        return this.configService.getOrThrow('rabbitmq.vhost', { infer: true });
    }

    public get prefetch(): number {
        return this.configService.getOrThrow('rabbitmq.prefetch', { infer: true });
    }

    public get retryAttempts(): number {
        return this.configService.getOrThrow('rabbitmq.retryAttempts', { infer: true });
    }

    public get retryDelay(): number {
        return this.configService.getOrThrow('rabbitmq.retryDelay', { infer: true });
    }

    public get url(): string {
        const encodedVhost = this.vhost === '/' ? '' : `/${encodeURIComponent(this.vhost)}`;
        return `amqp://${this.user}:${this.password}@${this.host}:${this.port}${encodedVhost}`;
    }
}
