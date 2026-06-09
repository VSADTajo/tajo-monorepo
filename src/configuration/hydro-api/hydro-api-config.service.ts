import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AllConfig } from '@config/configuration.type';

@Injectable()
export class HydroApiConfigService {
    constructor(private configService: ConfigService<AllConfig>) {}

    public get baseUrl(): string {
        return this.configService.getOrThrow('hydro-api.baseUrl', { infer: true });
    }

    public get stationThresholdCacheTtl(): number {
        return this.configService.getOrThrow('hydro-api.stationThresholdCacheTtl', { infer: true });
    }
}
