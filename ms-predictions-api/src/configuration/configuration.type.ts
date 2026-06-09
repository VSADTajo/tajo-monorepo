import { AppConfig } from './app/app-config.type';
import { DbConfig } from './postgres/db-config.type';
import { RedisConfig } from './redis/redis-config.type';
import { RabbitmqConfig } from './rabbitmq/rabbitmq-config.type';
import { HydroApiConfig } from './hydro-api/hydro-api-config.type';

export type AllConfig = {
    app: AppConfig;
    'postgres-database': DbConfig;
    redis: RedisConfig;
    rabbitmq: RabbitmqConfig;
    'hydro-api': HydroApiConfig;
};
