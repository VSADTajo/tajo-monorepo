import { registerAs } from '@nestjs/config';
import { SftpConfig } from './sftp-config.type';
import { IsInt, IsOptional, Min } from 'class-validator';
import validateConfig from '@config/helpers/validate-config';

class EnvVariablesValidator {
    @IsInt()
    @Min(1000)
    @IsOptional()
    SFTP_CONNECTION_TIMEOUT: number;

    @IsInt()
    @Min(1000)
    @IsOptional()
    SFTP_OPERATION_TIMEOUT: number;
}

export default registerAs<SftpConfig>('sftp', () => {
    validateConfig(process.env, EnvVariablesValidator);

    return {
        connectionTimeout: Number(process.env.SFTP_CONNECTION_TIMEOUT) || 10000,
        operationTimeout: Number(process.env.SFTP_OPERATION_TIMEOUT) || 60000,
    };
});
