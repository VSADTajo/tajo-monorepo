import { registerAs } from '@nestjs/config';
import { IsNotEmpty, IsString } from 'class-validator';
import { AuthApiConfig } from './auth-api-config.type';
import validateConfig from '@config/helpers/validate-config';

class EnvVariablesValidator {
    @IsNotEmpty()
    @IsString()
    AUTH_API_URL: string;
}

export default registerAs<AuthApiConfig>('auth-api', () => {
    validateConfig(process.env, EnvVariablesValidator);

    return {
        authApiUrl: process.env.AUTH_API_URL!,
    };
});
