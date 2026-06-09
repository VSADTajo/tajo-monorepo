import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AllConfig } from '@config/configuration.type';

@Injectable()
export class RedisConfigService {
    constructor(private configService: ConfigService<AllConfig>) {}

    get host(): string {
        return this.configService.getOrThrow('redis.host', { infer: true });
    }

    get port(): number {
        return this.configService.getOrThrow('redis.port', { infer: true });
    }

    get permissionTtl(): number {
        return this.configService.getOrThrow('redis.permissionTtl', { infer: true });
    }
}
