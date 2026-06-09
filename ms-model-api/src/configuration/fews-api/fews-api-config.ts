import { registerAs } from '@nestjs/config';
import { FewsApiConfig } from './fews-api-config.type';
import { IsOptional, IsString } from 'class-validator';
import validateConfig from '@config/helpers/validate-config';

class EnvVariablesValidator {
    @IsOptional()
    @IsString()
    FEWS_API_BASE_URL: string;
}

export default registerAs<FewsApiConfig>('fews-api', () => {
    validateConfig(process.env, EnvVariablesValidator);

    return {
        baseUrl: process.env.FEWS_API_BASE_URL || 'http://localhost:8080',
    };
});
