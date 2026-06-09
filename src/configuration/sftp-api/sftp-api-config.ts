import { registerAs } from '@nestjs/config';
import { SftpApiConfig } from './sftp-api-config.type';
import { IsOptional, IsString } from 'class-validator';
import validateConfig from '@config/helpers/validate-config';

class EnvVariablesValidator {
    @IsOptional()
    @IsString()
    SFTP_API_BASE_URL: string;
}

export default registerAs<SftpApiConfig>('sftp-api', () => {
    validateConfig(process.env, EnvVariablesValidator);

    return {
        baseUrl: process.env.SFTP_API_BASE_URL || 'http://localhost:3003',
    };
});
