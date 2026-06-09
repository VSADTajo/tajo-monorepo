import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AllConfig } from '@config/configuration.type';

@Injectable()
export class UserApiConfigService {
    constructor(private configService: ConfigService<AllConfig>) {}

    public get url(): string {
        return this.configService.getOrThrow('user-api.url', { infer: true });
    }
}
