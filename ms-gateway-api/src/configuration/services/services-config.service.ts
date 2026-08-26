import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AllConfig } from '@config/configuration.type';

@Injectable()
export class ServicesConfigService {
    constructor(private configService: ConfigService<AllConfig>) {}

    public get authApiUrl(): string {
        return this.configService.getOrThrow('services.authApiUrl', { infer: true });
    }

    public get userApiUrl(): string {
        return this.configService.getOrThrow('services.userApiUrl', { infer: true });
    }

    public get sftpApiUrl(): string {
        return this.configService.getOrThrow('services.sftpApiUrl', { infer: true });
    }

    public get predictionsApiUrl(): string {
        return this.configService.getOrThrow('services.predictionsApiUrl', { infer: true });
    }

    public get hydroApiUrl(): string {
        return this.configService.getOrThrow('services.hydroApiUrl', { infer: true });
    }

    public get notificationsApiUrl(): string {
        return this.configService.getOrThrow('services.notificationsApiUrl', { infer: true });
    }

    public get meteoApiUrl(): string {
        return this.configService.getOrThrow('services.meteoApiUrl', { infer: true });
    }

    public get modelApiUrl(): string {
        return this.configService.getOrThrow('services.modelApiUrl', { infer: true });
    }
}
