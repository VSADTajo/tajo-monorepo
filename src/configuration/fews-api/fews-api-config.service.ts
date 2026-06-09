import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AllConfig } from '@config/configuration.type';

@Injectable()
export class FewsApiConfigService {
    constructor(private configService: ConfigService<AllConfig>) {}

    public get baseUrl(): string {
        return this.configService.getOrThrow('fews-api.baseUrl', { infer: true });
    }
}
