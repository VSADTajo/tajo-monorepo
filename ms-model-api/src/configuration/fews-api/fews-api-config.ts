import { registerAs } from '@nestjs/config';
import { FewsApiConfig } from './fews-api-config.type';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import validateConfig from '@config/helpers/validate-config';

class EnvVariablesValidator {
    @IsOptional()
    @IsString()
    FEWS_API_BASE_URL: string;

    @IsOptional()
    @IsString()
    FEWS_API_SERVICE_PATH: string;

    @IsOptional()
    @IsString()
    FEWS_WORKFLOW_ID: string;

    @IsOptional()
    @IsString()
    FEWS_FILTER_ID: string;

    @IsOptional()
    @IsString()
    FEWS_API_USERNAME: string;

    @IsOptional()
    @IsString()
    FEWS_API_PASSWORD: string;

    @IsOptional()
    @IsInt()
    @Min(0)
    FEWS_TASK_TIMEOUT_MS: number;

    @IsOptional()
    @IsInt()
    @Min(0)
    FEWS_TASK_POLL_INTERVAL_MS: number;

    @IsOptional()
    @IsInt()
    @Min(0)
    FEWS_REQUEST_TIMEOUT_MS: number;
}

export default registerAs<FewsApiConfig>('fews-api', () => {
    validateConfig(process.env, EnvVariablesValidator);

    return {
        baseUrl: process.env.FEWS_API_BASE_URL || 'http://localhost:8080',
        servicePath: process.env.FEWS_API_SERVICE_PATH || '/rest/fewspiservice/v1',
        workflowId: process.env.FEWS_WORKFLOW_ID || '',
        filterId: process.env.FEWS_FILTER_ID || '',
        username: process.env.FEWS_API_USERNAME || '',
        password: process.env.FEWS_API_PASSWORD || '',
        taskTimeoutMs: Number(process.env.FEWS_TASK_TIMEOUT_MS) || 30 * 60 * 1000,
        taskPollIntervalMs: Number(process.env.FEWS_TASK_POLL_INTERVAL_MS) || 15_000,
        requestTimeoutMs: Number(process.env.FEWS_REQUEST_TIMEOUT_MS) || 60_000,
    };
});
