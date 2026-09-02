import { registerAs } from '@nestjs/config';
import { FewsApiConfig } from './fews-api-config.type';
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import validateConfig from '@config/helpers/validate-config';

/** Values the PI REST service accepts for `runOption` on runtask. */
export const FEWS_RUN_OPTIONS = ['all', 'alloneatatime', 'allmostrecentonly'] as const;

/** Defaults agreed with Idrica for the CH Tajo instance (endpoints_FEWS_TagusFlowCast.xlsx). */
export const FEWS_DEFAULTS = {
    baseUrl: 'http://cpdfews2.saihchtajo.es:8080/FewsWebServices',
    servicePath: '/rest/fewspiservice/v1',
    workflowId: 'ForecastMIKE11_mod',
    filterId: 'Tajo_Forecasts_mods',
    runUserId: 'fews',
    runOption: 'alloneatatime',
    runStartOffsetMinutes: 60,
    runHorizonDays: 3,
} as const;

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
    @IsString()
    FEWS_RUN_USER_ID: string;

    @IsOptional()
    @IsIn([...FEWS_RUN_OPTIONS])
    FEWS_RUN_OPTION: string;

    @IsOptional()
    @IsInt()
    @Min(0)
    FEWS_RUN_START_OFFSET_MINUTES: number;

    @IsOptional()
    @IsInt()
    @Min(1)
    FEWS_RUN_HORIZON_DAYS: number;

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

    @IsOptional()
    @IsString()
    MOCK_FEWS_BASE_URL: string;

    @IsOptional()
    @IsInt()
    @Min(0)
    MOCK_FEWS_RUNNING_MS: number;
}

function intOr(raw: string | undefined, fallback: number): number {
    const parsed = Number(raw);
    return raw !== undefined && raw !== '' && Number.isFinite(parsed) ? parsed : fallback;
}

export default registerAs<FewsApiConfig>('fews-api', () => {
    validateConfig(process.env, EnvVariablesValidator);

    return {
        baseUrl: process.env.FEWS_API_BASE_URL || FEWS_DEFAULTS.baseUrl,
        servicePath: process.env.FEWS_API_SERVICE_PATH || FEWS_DEFAULTS.servicePath,
        workflowId: process.env.FEWS_WORKFLOW_ID || FEWS_DEFAULTS.workflowId,
        filterId: process.env.FEWS_FILTER_ID || FEWS_DEFAULTS.filterId,
        username: process.env.FEWS_API_USERNAME || '',
        password: process.env.FEWS_API_PASSWORD || '',
        runUserId: process.env.FEWS_RUN_USER_ID || FEWS_DEFAULTS.runUserId,
        runOption: process.env.FEWS_RUN_OPTION || FEWS_DEFAULTS.runOption,
        runStartOffsetMinutes: intOr(process.env.FEWS_RUN_START_OFFSET_MINUTES, FEWS_DEFAULTS.runStartOffsetMinutes),
        runHorizonDays: intOr(process.env.FEWS_RUN_HORIZON_DAYS, FEWS_DEFAULTS.runHorizonDays),
        taskTimeoutMs: Number(process.env.FEWS_TASK_TIMEOUT_MS) || 30 * 60 * 1000,
        taskPollIntervalMs: Number(process.env.FEWS_TASK_POLL_INTERVAL_MS) || 15_000,
        requestTimeoutMs: Number(process.env.FEWS_REQUEST_TIMEOUT_MS) || 60_000,
        mockBaseUrl: process.env.MOCK_FEWS_BASE_URL || `http://127.0.0.1:${Number(process.env.APP_PORT) || 3000}`,
        mockRunningMs: Number(process.env.MOCK_FEWS_RUNNING_MS) || 0,
    };
});
