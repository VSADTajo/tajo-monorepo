import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AllConfig } from '@config/configuration.type';

/**
 * Service dealing with db config based operations.
 *
 * @class
 */
@Injectable()
export class AppConfigService {
    constructor(private configService: ConfigService<AllConfig>) {}

    public get nodeEnv(): string {
        return this.configService.getOrThrow('app.nodeEnv', { infer: true });
    }

    public get name(): string {
        return this.configService.getOrThrow('app.name', { infer: true });
    }

    public get url(): string {
        return this.configService.getOrThrow('app.url', { infer: true });
    }

    public get port(): number {
        return this.configService.getOrThrow('app.port', { infer: true });
    }

    public get apiPrefix(): string {
        return this.configService.getOrThrow('app.apiPrefix', { infer: true });
    }

    public get logLevel(): string {
        return this.configService.getOrThrow('app.logLevel', { infer: true });
    }

    /** * = permitir todo; en producción: URL(s) o IP(s) separados por coma */
    public get allowedOrigins(): string {
        return this.configService.getOrThrow('app.allowedOrigins', { infer: true });
    }

    /** Lista de IP:PUERTO permitidos. '*' = todos. Varios separados por coma. */
    public get allowedClients(): string[] {
        const raw = this.configService.getOrThrow('app.allowedClients', { infer: true });
        const trimmed = raw.trim();

        if (trimmed === '*') {
            return ['*'];
        }

        return trimmed
            .split(',')
            .map((c) => c.trim())
            .filter((c) => c.length > 0);
    }

    public get logsApiUrl(): string {
        return this.configService.getOrThrow('app.logsApiUrl', { infer: true });
    }

    public get xApiKey(): string {
        return this.configService.getOrThrow('app.xApiKey', { infer: true });
    }
}
