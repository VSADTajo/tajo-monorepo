import { AppConfig } from './app/app-config.type';
import { DbConfig } from './postgres/db-config.type';
import { RedisConfig } from './redis/redis-config.type';
import { RabbitmqConfig } from './rabbitmq/rabbitmq-config.type';
import { MeteoConfig } from './meteo/meteo-config.type';
import { AerialPrecipitationConfig } from './aerial-precipitation/aerial-precipitation-config.type';

export type AllConfig = {
    app: AppConfig;
    'postgres-database': DbConfig;
    redis: RedisConfig;
    rabbitmq: RabbitmqConfig;
    meteo: MeteoConfig;
    'aerial-precipitation': AerialPrecipitationConfig;
};
