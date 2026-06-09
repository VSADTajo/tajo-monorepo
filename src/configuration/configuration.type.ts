import { AppConfig } from './app/app-config.type';
import { RedisConfig } from './redis/redis-config.type';
import { JwtConfig } from './jwt/jwt-config.type';
import { UserApiConfig } from './user-api/user-api-config.type';

export type AllConfig = {
    app: AppConfig;
    redis: RedisConfig;
    jwt: JwtConfig;
    'user-api': UserApiConfig;
};
