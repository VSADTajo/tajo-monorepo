import { registerAs } from '@nestjs/config';
import { RedisConfig } from './redis-config.type';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import validateConfig from '@config/helpers/validate-config';

class EnvVariablesValidator {
    @IsOptional()
    @IsString()
    REDIS_HOST: string;

    @IsInt()
    @Min(0)
    @Max(65535)
    @IsOptional()
    REDIS_PORT: number;

    @IsInt()
    @Min(1)
    @IsOptional()
    REDIS_DEFAULT_TTL: number;
}

export default registerAs<RedisConfig>('redis', () => {
    validateConfig(process.env, EnvVariablesValidator);

    return {
        host: process.env.REDIS_HOST || '127.0.0.1',
        port: Number(process.env.REDIS_PORT) || 6379,
        defaultTtl: Number(process.env.REDIS_DEFAULT_TTL) || 300,
    };
});
