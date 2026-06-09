import { AppConfig } from './app/app-config.type';
import { DbConfig } from './postgres/db-config.type';
import { GeoserverDbConfig } from './geoserver/geoserver-config.type';
import { RedisConfig } from './redis/redis-config.type';
import { RabbitmqConfig } from './rabbitmq/rabbitmq-config.type';

export type AllConfig = {
    app: AppConfig;
    'postgres-database': DbConfig;
    'geoserver-database': GeoserverDbConfig;
    redis: RedisConfig;
    rabbitmq: RabbitmqConfig;
};
