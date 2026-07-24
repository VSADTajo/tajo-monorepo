import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AllConfig } from '@config/configuration.type';

@Injectable()
export class AerialPrecipitationConfigService {
    constructor(private configService: ConfigService<AllConfig>) {}

    public get sftpDirectory(): string {
        return this.configService.getOrThrow('aerial-precipitation.sftpDirectory', { infer: true });
    }

    public get pollIntervalMs(): number {
        return this.configService.getOrThrow('aerial-precipitation.pollIntervalMs', { infer: true });
    }

    public get filePrefixes(): string[] {
        return this.configService.getOrThrow('aerial-precipitation.filePrefixes', { infer: true });
    }

    public get retentionDays(): number {
        return this.configService.getOrThrow('aerial-precipitation.retentionDays', { infer: true });
    }

    public get cleanupCron(): string {
        return this.configService.getOrThrow('aerial-precipitation.cleanupCron', { infer: true });
    }

    public get listCacheTtlSeconds(): number {
        return this.configService.getOrThrow('aerial-precipitation.listCacheTtlSeconds', { infer: true });
    }

    public get latestCacheTtlSeconds(): number {
        return this.configService.getOrThrow('aerial-precipitation.latestCacheTtlSeconds', { infer: true });
    }
}
