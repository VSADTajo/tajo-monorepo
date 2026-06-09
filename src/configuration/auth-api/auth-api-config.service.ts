import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AllConfig } from '@config/configuration.type';

@Injectable()
export class AuthApiConfigService {
    constructor(private configService: ConfigService<AllConfig>) {}

    public get authApiUrl(): string {
        return this.configService.getOrThrow('auth-api.authApiUrl', { infer: true });
    }
}
