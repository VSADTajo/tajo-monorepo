import { registerAs } from '@nestjs/config';
import { AppConfig, ENVIRONMENT, LOG_LEVEL } from './app-config.type';

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
    MANUAL_SIMULATION_MODULE_INSTANCE_ID: string;

    @IsOptional()
    @IsString()
    MANUAL_SIMULATION_PARAMETER_ID: string;
}

/** What Idrica's FEWS import expects on the manual-simulation input (endpoints_FEWS_TagusFlowCast.xlsx). */
export const MANUAL_SIMULATION_DEFAULTS = {
    moduleInstanceId: 'ImportAPI_Q_mod',
    parameterId: 'Q.salida.forecast.web',
} as const;

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
        manualSimulationModuleInstanceId:
            process.env.MANUAL_SIMULATION_MODULE_INSTANCE_ID || MANUAL_SIMULATION_DEFAULTS.moduleInstanceId,
        manualSimulationParameterId:
            process.env.MANUAL_SIMULATION_PARAMETER_ID || MANUAL_SIMULATION_DEFAULTS.parameterId,
    };
});
