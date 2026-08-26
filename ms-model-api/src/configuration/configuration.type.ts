import { AppConfig } from './app/app-config.type';
import { DbConfig } from './postgres/db-config.type';
import { RedisConfig } from './redis/redis-config.type';
import { RabbitmqConfig } from './rabbitmq/rabbitmq-config.type';
import { FewsApiConfig } from './fews-api/fews-api-config.type';
import { SftpApiConfig } from './sftp-api/sftp-api-config.type';
import { WiskiApiConfig } from './wiski-api/wiski-api-config.type';

export type AllConfig = {
    app: AppConfig;
    'postgres-database': DbConfig;
    redis: RedisConfig;
    rabbitmq: RabbitmqConfig;
    'fews-api': FewsApiConfig;
    'sftp-api': SftpApiConfig;
    'wiski-api': WiskiApiConfig;
};
