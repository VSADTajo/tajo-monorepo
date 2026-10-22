import { registerAs } from '@nestjs/config';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

import validateConfig from '@config/helpers/validate-config';
import { WiskiApiConfig } from './wiski-api-config.type';

class EnvVariablesValidator {
    @IsOptional()
    @IsString()
    WISKI_API_BASE_URL: string;

    @IsOptional()
    @IsString()
    WISKI_API_PATH: string;

    @IsOptional()
    @IsString()
    WISKI_API_TIMEZONE: string;

    @IsOptional()
    @IsInt()
    @Min(0)
    WISKI_API_REQUEST_TIMEOUT_MS: number;

    @IsOptional()
    @IsInt()
    @Min(0)
    WISKI_API_MAX_RESPONSE_BYTES: number;

    @IsOptional()
    @IsString()
    WISKI_API_TOKEN: string;

    @IsOptional()
    @IsString()
    MOCK_WISKI_BASE_URL: string;
}

export default registerAs<WiskiApiConfig>('wiski-api', () => {
    validateConfig(process.env, EnvVariablesValidator);

    return {
        baseUrl: process.env.WISKI_API_BASE_URL || '',
        path: process.env.WISKI_API_PATH || '/wiski/tagus_flowcast_observado/',
        timezone: process.env.WISKI_API_TIMEZONE || 'Europe/Madrid',
        requestTimeoutMs: Number(process.env.WISKI_API_REQUEST_TIMEOUT_MS) || 120_000,
        maxResponseBytes: Number(process.env.WISKI_API_MAX_RESPONSE_BYTES) || 50 * 1024 * 1024,
        token: process.env.WISKI_API_TOKEN || '',
        mockBaseUrl: process.env.MOCK_WISKI_BASE_URL || `http://127.0.0.1:${Number(process.env.APP_PORT) || 3000}`,
    };
});
