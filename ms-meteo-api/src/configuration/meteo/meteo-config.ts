import { registerAs } from '@nestjs/config';
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { MeteoConfig, RetentionMode } from './meteo-config.type';
import validateConfig from '@config/helpers/validate-config';

class EnvVariablesValidator {
    @IsOptional()
    @IsString()
    SFTP_API_URL: string;

    @IsOptional()
    @IsString()
    SFTP_API_INTERNAL_CALLER: string;

    @IsOptional()
    @IsString()
    METEO_BASE_PATH: string;

    @IsOptional()
    @IsString()
    GEOSERVER_URL: string;

    @IsOptional()
    @IsString()
    GEOSERVER_USER: string;

    @IsOptional()
    @IsString()
    GEOSERVER_PASSWORD: string;

    @IsOptional()
    @IsString()
    GEOSERVER_WORKSPACE: string;

    @IsOptional()
    @IsString()
    GEOSERVER_DB_HOST: string;

    @IsOptional()
    @IsInt()
    GEOSERVER_DB_PORT: number;

    @IsOptional()
    @IsString()
    GEOSERVER_DB_DATABASE: string;

    @IsOptional()
    @IsString()
    GEOSERVER_DB_USERNAME: string;

    @IsOptional()
    @IsString()
    GEOSERVER_DB_PASSWORD: string;

    @IsOptional()
    @IsString()
    METEO_GEOTIFF_DIR: string;

    @IsOptional()
    @IsString()
    METEO_SYNC_CRON: string;

    @IsOptional()
    @IsString()
    METEO_RETENTION_CRON: string;

    @IsOptional()
    @IsInt()
    @Min(1)
    METEO_RETENTION_DAYS: number;

    @IsOptional()
    @IsIn(['days', 'today'])
    METEO_RETENTION_MODE: string;

    @IsOptional()
    @IsInt()
    @Min(1)
    METEO_INGEST_CONCURRENCY: number;

    @IsOptional()
    @IsString()
    AEMET_API_KEY: string;

    @IsOptional()
    @IsString()
    AEMET_BASE_URL: string;

    @IsOptional()
    @IsString()
    AEMET_DEFAULT_AREA: string;
}

export default registerAs<MeteoConfig>('meteo', () => {
    validateConfig(process.env, EnvVariablesValidator);

    return {
        sftpApiUrl: process.env.SFTP_API_URL || 'http://ms-sftp-api:3003',
        sftpApiInternalCaller: process.env.SFTP_API_INTERNAL_CALLER || 'ms-meteo-api',
        meteoBasePath: process.env.METEO_BASE_PATH || 'tajo/METEO',
        geoserverUrl: process.env.GEOSERVER_URL || 'http://vsad-tajo-geoserver:8080/geoserver',
        geoserverUser: process.env.GEOSERVER_USER || 'admin',
        geoserverPassword: process.env.GEOSERVER_PASSWORD || 'geoserver',
        geoserverWorkspace: process.env.GEOSERVER_WORKSPACE || 'tajo',
        geoserverDbHost: process.env.GEOSERVER_DB_HOST || 'infra-db-geoserver',
        geoserverDbPort: Number(process.env.GEOSERVER_DB_PORT) || 5432,
        geoserverDbDatabase: process.env.GEOSERVER_DB_DATABASE || 'geoserver',
        geoserverDbUsername: process.env.GEOSERVER_DB_USERNAME || 'postgres',
        geoserverDbPassword: process.env.GEOSERVER_DB_PASSWORD || 'secret',
        meteoGeotiffDir: process.env.METEO_GEOTIFF_DIR || '/opt/datasets/meteo',
        meteoSyncCron: process.env.METEO_SYNC_CRON || '0 */3 * * *',
        meteoRetentionCron: process.env.METEO_RETENTION_CRON || '0 3 * * *',
        meteoRetentionDays: Number(process.env.METEO_RETENTION_DAYS) || 7,
        meteoRetentionMode: (process.env.METEO_RETENTION_MODE === 'days' ? 'days' : 'today') as RetentionMode,
        meteoIngestConcurrency: Number(process.env.METEO_INGEST_CONCURRENCY) || 4,
        aemetApiKey: process.env.AEMET_API_KEY || '',
        aemetBaseUrl: process.env.AEMET_BASE_URL || 'https://opendata.aemet.es/opendata',
        aemetDefaultArea: process.env.AEMET_DEFAULT_AREA || 'esp',
    };
});
