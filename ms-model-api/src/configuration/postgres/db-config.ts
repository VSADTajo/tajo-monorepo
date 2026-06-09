import { registerAs } from '@nestjs/config';
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { config as dotenvConfig } from 'dotenv';
import { DataSource, DataSourceOptions, DatabaseType } from 'typeorm';

import { DbConfig } from './db-config.type';
import validateConfig from '@config/helpers/validate-config';

dotenvConfig({ path: '.env' });

class EnvVariablesValidator {
    @IsNotEmpty()
    @IsString()
    DB_HOST: string;

    @IsNotEmpty()
    @IsInt()
    DB_PORT: number;

    @IsOptional()
    @IsString()
    DB_USERNAME: string;

    @IsString()
    @IsOptional()
    DB_PASSWORD: string;

    @IsNotEmpty()
    @IsString()
    DB_DATABASE: string;

    @IsBoolean()
    @IsOptional()
    DB_SYNCHRONIZE: boolean;

    @IsBoolean()
    @IsOptional()
    DB_LOGGING: boolean;
}

const sslEnabled = process.env.DB_SSL === 'true';

const config = {
    type: 'postgres' as DatabaseType,
    host: `${process.env.DB_HOST}`,
    port: parseInt(`${process.env.DB_PORT}`, 10),
    username: `${process.env.DB_USERNAME}`,
    password: `${process.env.DB_PASSWORD}`,
    database: `${process.env.DB_DATABASE}`,
    logging: process.env.DB_LOGGING === 'true',
    migrations: [__dirname + '/../../migrations/**/*{.ts,.js}'],
    entities: [__dirname + '/../../app/domain/**/entities/*.entity{.ts,.js}'],
    autoLoadEntities: true,
    synchronize: process.env.DB_SYNCHRONIZE === 'true',
    cli: {
        migrationsDir: './src/migrations/',
    },
    ssl: sslEnabled ? { rejectUnauthorized: false } : false,
};

export default registerAs<DbConfig>('postgres-database', () => {
    validateConfig(process.env, EnvVariablesValidator);
    return config;
});

export const connectionSource = new DataSource(config as DataSourceOptions);
