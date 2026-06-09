import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseType } from 'typeorm';

// Configs
import { AllConfig } from '@config/configuration.type';

@Injectable()
export class PostgresDbConfigService {
    constructor(private configService: ConfigService<AllConfig>) {}

    public get type(): DatabaseType {
        return this.configService.get('postgres-database.type', { infer: true }) || 'postgres';
    }

    public get username(): string | undefined {
        return this.configService.get('postgres-database.username', { infer: true });
    }

    public get password(): string | undefined {
        return this.configService.get('postgres-database.password', { infer: true });
    }

    public get database(): string {
        return this.configService.getOrThrow('postgres-database.database', { infer: true });
    }

    public get host(): string {
        return this.configService.getOrThrow('postgres-database.host', { infer: true });
    }

    public get port(): number {
        return this.configService.getOrThrow('postgres-database.port', { infer: true });
    }

    public get synchronize(): boolean {
        return this.configService.getOrThrow('postgres-database.synchronize', { infer: true });
    }

    public get logging(): boolean {
        return this.configService.getOrThrow('postgres-database.logging', { infer: true });
    }

    public get entities(): boolean {
        return this.configService.getOrThrow('postgres-database.entities', { infer: true });
    }

    public get migrations(): boolean {
        return this.configService.getOrThrow('postgres-database.migrations', { infer: true });
    }

    public get config() {
        if (process.env.NODE_ENV === 'test') {
            return {
                type: 'sqlite',
                database: './test.sqlite',
                dropSchema: true,
                migrations: [__dirname + '/../../../migrations/**/*{.ts,.js}'],
                entities: [__dirname + '/../../app/domain/**/entities/*.entity{.ts,.js}'],
                synchronize: true,
                keepConnectionAlive: true,
            };
        }
        const sslEnabled = process.env.DB_SSL === 'true';
        return {
            type: this.type,
            host: this.host,
            port: this.port,
            username: this.username,
            password: this.password,
            database: this.database,
            logging: this.logging,
            synchronize: this.synchronize,
            entities: this.entities,
            migrations: this.migrations,
            ...(sslEnabled ? { ssl: { rejectUnauthorized: false } } : {}),
            extra: {
                max: 10,
                idleTimeoutMillis: 30000,
                connectionTimeoutMillis: 5000,
                keepAlive: true,
                keepAliveInitialDelayMillis: 10000,
            },
        };
    }
}
