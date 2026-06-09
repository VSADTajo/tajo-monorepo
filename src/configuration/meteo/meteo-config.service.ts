import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AllConfig } from '@config/configuration.type';
import { RetentionMode } from './meteo-config.type';

@Injectable()
export class MeteoConfigService {
    constructor(private configService: ConfigService<AllConfig>) {}

    public get sftpApiUrl(): string {
        return this.configService.getOrThrow('meteo.sftpApiUrl', { infer: true });
    }

    public get sftpApiInternalCaller(): string {
        return this.configService.getOrThrow('meteo.sftpApiInternalCaller', { infer: true });
    }

    public get meteoBasePath(): string {
        return this.configService.getOrThrow('meteo.meteoBasePath', { infer: true });
    }

    public get geoserverUrl(): string {
        return this.configService.getOrThrow('meteo.geoserverUrl', { infer: true });
    }

    public get geoserverUser(): string {
        return this.configService.getOrThrow('meteo.geoserverUser', { infer: true });
    }

    public get geoserverPassword(): string {
        return this.configService.getOrThrow('meteo.geoserverPassword', { infer: true });
    }

    public get geoserverWorkspace(): string {
        return this.configService.getOrThrow('meteo.geoserverWorkspace', { infer: true });
    }

    public get geoserverDbHost(): string {
        return this.configService.getOrThrow('meteo.geoserverDbHost', { infer: true });
    }

    public get geoserverDbPort(): number {
        return this.configService.getOrThrow('meteo.geoserverDbPort', { infer: true });
    }

    public get geoserverDbDatabase(): string {
        return this.configService.getOrThrow('meteo.geoserverDbDatabase', { infer: true });
    }

    public get geoserverDbUsername(): string {
        return this.configService.getOrThrow('meteo.geoserverDbUsername', { infer: true });
    }

    public get geoserverDbPassword(): string {
        return this.configService.getOrThrow('meteo.geoserverDbPassword', { infer: true });
    }

    public get meteoGeotiffDir(): string {
        return this.configService.getOrThrow('meteo.meteoGeotiffDir', { infer: true });
    }

    public get meteoSyncCron(): string {
        return this.configService.getOrThrow('meteo.meteoSyncCron', { infer: true });
    }

    public get meteoRetentionCron(): string {
        return this.configService.getOrThrow('meteo.meteoRetentionCron', { infer: true });
    }

    public get meteoRetentionDays(): number {
        return this.configService.getOrThrow('meteo.meteoRetentionDays', { infer: true });
    }

    public get meteoRetentionMode(): RetentionMode {
        return this.configService.getOrThrow('meteo.meteoRetentionMode', { infer: true });
    }

    public get meteoIngestConcurrency(): number {
        return this.configService.getOrThrow('meteo.meteoIngestConcurrency', { infer: true });
    }

    public get aemetApiKey(): string {
        return this.configService.getOrThrow('meteo.aemetApiKey', { infer: true });
    }

    public get aemetBaseUrl(): string {
        return this.configService.getOrThrow('meteo.aemetBaseUrl', { infer: true });
    }

    public get aemetDefaultArea(): string {
        return this.configService.getOrThrow('meteo.aemetDefaultArea', { infer: true });
    }
}
