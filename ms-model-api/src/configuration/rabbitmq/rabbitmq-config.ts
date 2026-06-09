import { registerAs } from '@nestjs/config';
import { RabbitmqConfig } from './rabbitmq-config.type';
import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Transform } from 'class-transformer';
import validateConfig from '@config/helpers/validate-config';

class EnvVariablesValidator {
    @IsOptional()
    @IsBoolean()
    @Transform(({ value }) => value === 'true' || value === '1')
    RABBITMQ_ENABLED: boolean;

    @IsOptional()
    @IsString()
    RABBITMQ_HOST: string;

    @IsInt()
    @Min(0)
    @Max(65535)
    @IsOptional()
    RABBITMQ_PORT: number;

    @IsOptional()
    @IsString()
    RABBITMQ_USER: string;

    @IsOptional()
    @IsString()
    RABBITMQ_PASSWORD: string;

    @IsOptional()
    @IsString()
    RABBITMQ_VHOST: string;

    @IsInt()
    @Min(1)
    @IsOptional()
    RABBITMQ_PREFETCH: number;

    @IsInt()
    @Min(0)
    @IsOptional()
    RABBITMQ_RETRY_ATTEMPTS: number;

    @IsInt()
    @Min(0)
    @IsOptional()
    RABBITMQ_RETRY_DELAY: number;
}

export default registerAs<RabbitmqConfig>('rabbitmq', () => {
    validateConfig(process.env, EnvVariablesValidator);

    return {
        enabled: process.env.RABBITMQ_ENABLED === 'true' || process.env.RABBITMQ_ENABLED === '1',
        host: process.env.RABBITMQ_HOST || '127.0.0.1',
        port: Number(process.env.RABBITMQ_PORT) || 5672,
        user: process.env.RABBITMQ_USER || 'guest',
        password: process.env.RABBITMQ_PASSWORD || 'guest',
        vhost: process.env.RABBITMQ_VHOST || '/',
        prefetch: Number(process.env.RABBITMQ_PREFETCH) || 10,
        retryAttempts: Number(process.env.RABBITMQ_RETRY_ATTEMPTS) || 3,
        retryDelay: Number(process.env.RABBITMQ_RETRY_DELAY) || 5000,
    };
});
