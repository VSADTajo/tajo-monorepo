import { AppConfig } from './app/app-config.type';
import { DbConfig } from './postgres/db-config.type';
import { RedisConfig } from './redis/redis-config.type';
import { RabbitmqConfig } from './rabbitmq/rabbitmq-config.type';
import { StorageConfig } from './storage/storage-config.type';
import { SftpConfig } from './sftp/sftp-config.type';
import { SftpServerConfig } from './sftp-server/sftp-server-config.type';
import { AuthApiConfig } from './auth-api/auth-api-config.type';

export type AllConfig = {
    app: AppConfig;
    'postgres-database': DbConfig;
    redis: RedisConfig;
    rabbitmq: RabbitmqConfig;
    storage: StorageConfig;
    sftp: SftpConfig;
    sftpServer: SftpServerConfig;
    'auth-api': AuthApiConfig;
};
