import { AppConfig } from './app/app-config.type';
import { ServicesConfig } from './services/services-config.type';
import { RedisConfig } from './redis/redis-config.type';

export type AllConfig = {
    app: AppConfig;
    services: ServicesConfig;
    redis: RedisConfig;
};
