import { registerAs } from '@nestjs/config';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { AerialPrecipitationConfig } from './aerial-precipitation-config.type';
import validateConfig from '@config/helpers/validate-config';

class EnvVariablesValidator {
    @IsOptional()
    @IsString()
    AERIAL_PRECIP_SFTP_DIRECTORY: string;

    @IsOptional()
    @IsInt()
    @Min(1)
    AERIAL_PRECIP_POLL_INTERVAL_MS: number;

    @IsOptional()
    @IsString()
    AERIAL_PRECIP_FILE_PREFIXES: string;

    @IsOptional()
    @IsInt()
    @Min(1)
    AERIAL_PRECIP_RETENTION_DAYS: number;

    @IsOptional()
    @IsString()
    AERIAL_PRECIP_CLEANUP_CRON: string;

    @IsOptional()
    @IsInt()
    @Min(1)
    AERIAL_PRECIP_LIST_CACHE_TTL_SECONDS: number;

    @IsOptional()
    @IsInt()
    @Min(1)
    AERIAL_PRECIP_LATEST_CACHE_TTL_SECONDS: number;
}

export default registerAs<AerialPrecipitationConfig>('aerial-precipitation', () => {
    validateConfig(process.env, EnvVariablesValidator);

    const prefixesRaw =
        process.env.AERIAL_PRECIP_FILE_PREFIXES || 'tagus_eps_Pareal_,tagus_harmonie_Pareal_,tagus_saih_Pareal_';

    return {
        sftpDirectory: process.env.AERIAL_PRECIP_SFTP_DIRECTORY || '/tagus/pareal',
        pollIntervalMs: Number(process.env.AERIAL_PRECIP_POLL_INTERVAL_MS) || 300000,
        filePrefixes: prefixesRaw
            .split(',')
            .map((p) => p.trim())
            .filter(Boolean),
        retentionDays: Number(process.env.AERIAL_PRECIP_RETENTION_DAYS) || 30,
        cleanupCron: process.env.AERIAL_PRECIP_CLEANUP_CRON || '0 3 * * *',
        listCacheTtlSeconds: Number(process.env.AERIAL_PRECIP_LIST_CACHE_TTL_SECONDS) || 60,
        latestCacheTtlSeconds: Number(process.env.AERIAL_PRECIP_LATEST_CACHE_TTL_SECONDS) || 300,
    };
});
