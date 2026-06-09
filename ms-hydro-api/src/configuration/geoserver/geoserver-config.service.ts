import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseType } from 'typeorm';

import { AllConfig } from '@config/configuration.type';

@Injectable()
export class GeoserverDbConfigService {
    constructor(private configService: ConfigService<AllConfig>) {}

    public get type(): DatabaseType {
        return this.configService.get('geoserver-database.type', { infer: true }) || 'postgres';
    }

    public get host(): string {
        return this.configService.getOrThrow('geoserver-database.host', { infer: true });
    }

    public get port(): number {
        return this.configService.getOrThrow('geoserver-database.port', { infer: true });
    }

    public get username(): string | undefined {
        return this.configService.get('geoserver-database.username', { infer: true });
    }

    public get password(): string | undefined {
        return this.configService.get('geoserver-database.password', { infer: true });
    }

    public get database(): string {
        return this.configService.getOrThrow('geoserver-database.database', { infer: true });
    }

    public get config() {
        const sslEnabled = process.env.GEOSERVER_DB_SSL === 'true';
        return {
            type: this.type,
            host: this.host,
            port: this.port,
            username: this.username,
            password: this.password,
            database: this.database,
            synchronize: false,
            logging: false,
            ...(sslEnabled ? { ssl: { rejectUnauthorized: false } } : {}),
            extra: {
                max: 3,
                idleTimeoutMillis: 30000,
                connectionTimeoutMillis: 5000,
            },
        };
    }
}
