import { registerAs } from '@nestjs/config';
import { JwtConfig } from './jwt-config.type';

import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import validateConfig from '@config/helpers/validate-config';

class EnvVariablesValidator {
    @IsNotEmpty()
    @IsString()
    JWT_SECRET: string;

    @IsOptional()
    @IsString()
    JWT_EXPIRATION: string;

    @IsOptional()
    @IsString()
    JWT_ACCESS_EXPIRATION: string;

    @IsOptional()
    @IsString()
    JWT_REFRESH_EXPIRATION: string;
}

export default registerAs<JwtConfig>('jwt', () => {
    validateConfig(process.env, EnvVariablesValidator);

    return {
        secret: process.env.JWT_SECRET!,
        expiration: process.env.JWT_EXPIRATION || '1h',
        accessExpiration: process.env.JWT_ACCESS_EXPIRATION || '15m',
        refreshExpiration: process.env.JWT_REFRESH_EXPIRATION || '15d',
    };
});
