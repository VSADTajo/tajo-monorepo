import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AllConfig } from '@config/configuration.type';

@Injectable()
export class JwtConfigService {
    constructor(private configService: ConfigService<AllConfig>) {}

    public get secret(): string {
        return this.configService.getOrThrow('jwt.secret', { infer: true });
    }

    public get expiration(): string {
        return this.configService.getOrThrow('jwt.expiration', { infer: true });
    }

    public get accessExpiration(): string {
        return this.configService.getOrThrow('jwt.accessExpiration', { infer: true });
    }

    public get refreshExpiration(): string {
        return this.configService.getOrThrow('jwt.refreshExpiration', { infer: true });
    }
}
