import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AllConfig } from '@config/configuration.type';

@Injectable()
export class RedisConfigService {
    constructor(private configService: ConfigService<AllConfig>) {}

    public get host(): string {
        return this.configService.getOrThrow('redis.host', { infer: true });
    }

    public get port(): number {
        return this.configService.getOrThrow('redis.port', { infer: true });
    }

    public get defaultTtl(): number {
        return this.configService.getOrThrow('redis.defaultTtl', { infer: true });
    }
}
