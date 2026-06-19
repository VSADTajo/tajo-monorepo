import { registerAs } from '@nestjs/config';
import { IsOptional, IsString } from 'class-validator';
import validateConfig from '@config/helpers/validate-config';
import { SftpApiConfig } from './sftp-api-config.type';

class EnvVariablesValidator {
    @IsOptional()
    @IsString()
    SFTP_API_URL: string;
}

export default registerAs<SftpApiConfig>('sftp-api', () => {
    validateConfig(process.env, EnvVariablesValidator);

    return {
        baseUrl: process.env.SFTP_API_URL || 'http://ms-sftp-api:3003',
    };
});
