import { registerAs } from '@nestjs/config';
import { SftpServerConfig, SftpServerUser } from './sftp-server-config.type';
import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';
import validateConfig from '@config/helpers/validate-config';

class EnvVariablesValidator {
    @IsBoolean()
    @IsOptional()
    SFTP_SERVER_ENABLED: boolean;

    @IsInt()
    @Min(1)
    @IsOptional()
    SFTP_SERVER_PORT: number;

    @IsString()
    @IsOptional()
    SFTP_SERVER_HOST_KEY_PATH: string;

    @IsBoolean()
    @IsOptional()
    SFTP_SERVER_AUTO_GENERATE_HOST_KEY: boolean;

    @IsInt()
    @Min(1)
    @IsOptional()
    SFTP_SERVER_MAX_CONNECTIONS: number;

    @IsString()
    @IsOptional()
    SFTP_SERVER_USERS: string;
}

export default registerAs<SftpServerConfig>('sftpServer', () => {
    validateConfig(process.env, EnvVariablesValidator);

    let users: SftpServerUser[] = [];
    const usersJson = process.env.SFTP_SERVER_USERS;
    if (usersJson) {
        try {
            users = JSON.parse(usersJson);
        } catch {
            throw new Error('SFTP_SERVER_USERS must be a valid JSON array');
        }
    }

    return {
        enabled: process.env.SFTP_SERVER_ENABLED === 'true',
        port: Number(process.env.SFTP_SERVER_PORT) || 8212,
        hostKeyPath: process.env.SFTP_SERVER_HOST_KEY_PATH || '/data/sftp/host_key',
        autoGenerateHostKey: process.env.SFTP_SERVER_AUTO_GENERATE_HOST_KEY !== 'false',
        maxConnections: Number(process.env.SFTP_SERVER_MAX_CONNECTIONS) || 10,
        users,
    };
});
