import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AllConfig } from '@config/configuration.type';

@Injectable()
export class WiskiApiConfigService {
    constructor(private configService: ConfigService<AllConfig>) {}

    public get baseUrl(): string {
        return this.configService.getOrThrow('wiski-api.baseUrl', { infer: true });
    }

    public get path(): string {
        return this.configService.getOrThrow('wiski-api.path', { infer: true });
    }

    public get timezone(): string {
        return this.configService.getOrThrow('wiski-api.timezone', { infer: true });
    }

    public get requestTimeoutMs(): number {
        return this.configService.getOrThrow('wiski-api.requestTimeoutMs', { infer: true });
    }

    public get maxResponseBytes(): number {
        return this.configService.getOrThrow('wiski-api.maxResponseBytes', { infer: true });
    }

    public get username(): string {
        return this.configService.getOrThrow('wiski-api.username', { infer: true });
    }

    public get password(): string {
        return this.configService.getOrThrow('wiski-api.password', { infer: true });
    }

    public get mockBaseUrl(): string {
        return this.configService.getOrThrow('wiski-api.mockBaseUrl', { infer: true });
    }
}
