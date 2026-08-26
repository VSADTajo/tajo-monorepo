import { registerAs } from '@nestjs/config';
import { AppConfig, ENVIRONMENT, LOG_LEVEL, VOBS_SOURCE } from './app-config.type';

import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import validateConfig from '@config/helpers/validate-config';

class EnvVariablesValidator {
    @IsOptional()
    @IsString()
    APP_NAME: string;

    @IsEnum(ENVIRONMENT)
    @IsOptional()
    NODE_ENV: ENVIRONMENT;

    @IsOptional()
    @IsString()
    APP_URL: string;

    @IsInt()
    @Min(0)
    @Max(65535)
    @IsOptional()
    APP_PORT: number;

    @IsEnum(LOG_LEVEL)
    @IsOptional()
    APP_LOG_LEVEL: LOG_LEVEL;

    @IsOptional()
    @IsString()
    API_PREFIX: string;

    @IsOptional()
    @IsString()
    LOGS_API_URL: string;

    @IsOptional()
    @IsString()
    X_API_KEY: string;

    @IsOptional()
    @IsString()
    USE_CALCULATOR_PIPELINE: string;

    @IsOptional()
    @IsString()
    VOBS_CSV_SFTP_PATH: string;

    @IsOptional()
    @IsString()
    VOBS_CSV_TIMEZONE: string;

    @IsOptional()
    @IsInt()
    @Min(0)
    VOBS_CSV_FETCH_TIMEOUT_MS: number;

    @IsOptional()
    @IsString()
    VOBS_SOURCE: string;

    @IsOptional()
    @IsString()
    MOCK_MODEL_OUTPUT_SFTP_PATH: string;
}

export default registerAs<AppConfig>('app', () => {
    validateConfig(process.env, EnvVariablesValidator);

    return {
        nodeEnv: process.env.NODE_ENV || ENVIRONMENT.DEVELOPMENT,
        name: process.env.APP_NAME || 'MyApp',
        url: process.env.APP_URL || 'http://my-app.test',
        port: Number(process.env.APP_PORT) || 3000,
        logLevel: process.env.APP_LOG_LEVEL || LOG_LEVEL.INFO,
        apiPrefix: process.env.API_PREFIX || 'api',
        logsApiUrl: process.env.LOGS_API_URL || '',
        xApiKey: process.env.X_API_KEY || '',
        useCalculatorPipeline: process.env.USE_CALCULATOR_PIPELINE === 'true',
        vobsCsvSftpPath: process.env.VOBS_CSV_SFTP_PATH || '',
        vobsCsvTimezone: process.env.VOBS_CSV_TIMEZONE || 'Europe/Madrid',
        vobsCsvFetchTimeoutMs: Number(process.env.VOBS_CSV_FETCH_TIMEOUT_MS) || 30_000,
        vobsSource: process.env.VOBS_SOURCE === VOBS_SOURCE.WISKI_API ? VOBS_SOURCE.WISKI_API : VOBS_SOURCE.SFTP_CSV,
        mockModelOutputSftpPath: process.env.MOCK_MODEL_OUTPUT_SFTP_PATH || '',
    };
});
