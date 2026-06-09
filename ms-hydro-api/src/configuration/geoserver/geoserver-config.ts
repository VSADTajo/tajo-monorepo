import { registerAs } from '@nestjs/config';
import { IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { config as dotenvConfig } from 'dotenv';
import { DatabaseType } from 'typeorm';

import { GeoserverDbConfig } from './geoserver-config.type';
import validateConfig from '@config/helpers/validate-config';

dotenvConfig({ path: '.env' });

class EnvVariablesValidator {
    @IsNotEmpty()
    @IsString()
    GEOSERVER_DB_HOST: string;

    @IsNotEmpty()
    @IsInt()
    GEOSERVER_DB_PORT: number;

    @IsOptional()
    @IsString()
    GEOSERVER_DB_USERNAME: string;

    @IsString()
    @IsOptional()
    GEOSERVER_DB_PASSWORD: string;

    @IsNotEmpty()
    @IsString()
    GEOSERVER_DB_DATABASE: string;
}

export default registerAs<GeoserverDbConfig>('geoserver-database', () => {
    validateConfig(process.env, EnvVariablesValidator);
    return {
        type: 'postgres' as DatabaseType,
        host: `${process.env.GEOSERVER_DB_HOST}`,
        port: parseInt(`${process.env.GEOSERVER_DB_PORT}`, 10),
        username: `${process.env.GEOSERVER_DB_USERNAME}`,
        password: `${process.env.GEOSERVER_DB_PASSWORD}`,
        database: `${process.env.GEOSERVER_DB_DATABASE}`,
    };
});
