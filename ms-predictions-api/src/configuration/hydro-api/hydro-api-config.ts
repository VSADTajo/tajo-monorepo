import { registerAs } from '@nestjs/config';
import { HydroApiConfig } from './hydro-api-config.type';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import validateConfig from '@config/helpers/validate-config';

class EnvVariablesValidator {
    @IsOptional()
    @IsString()
    HYDRO_API_BASE_URL: string;

    @IsInt()
    @Min(1)
    @IsOptional()
    STATION_THRESHOLD_CACHE_TTL: number;
}

export default registerAs<HydroApiConfig>('hydro-api', () => {
    validateConfig(process.env, EnvVariablesValidator);

    return {
        baseUrl: process.env.HYDRO_API_BASE_URL || 'http://localhost:3004',
        stationThresholdCacheTtl: Number(process.env.STATION_THRESHOLD_CACHE_TTL) || 300,
    };
});
