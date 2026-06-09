import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import Redis from 'ioredis';
import { RedisConfigService } from '@config/redis/redis-config.service';

export interface PermissionEntry {
    method: string;
    path: string;
}

const CACHE_KEY_PREFIX = 'permissions:role:';

@Injectable()
export class PermissionCacheService implements OnModuleDestroy {
    private readonly redis: Redis;

    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly redisConfig: RedisConfigService,
    ) {
        this.redis = new Redis({
            host: this.redisConfig.host,
            port: this.redisConfig.port,
            lazyConnect: true,
        });

        this.redis.connect().catch((err: Error) => {
            this.logger.warn({ msg: 'Redis connection failed', entity: 'Cache', error: err.message });
        });
    }

    async getPermissions(roleName: string): Promise<PermissionEntry[] | null> {
        try {
            const data = await this.redis.get(`${CACHE_KEY_PREFIX}${roleName}`);
            if (!data) return null;
            return JSON.parse(data) as PermissionEntry[];
        } catch {
            this.logger.warn({ msg: 'Permission cache GET failed', entity: 'Cache', roleName });
            return null;
        }
    }

    async setPermissions(roleName: string, permissions: PermissionEntry[], ttlSeconds: number): Promise<void> {
        try {
            await this.redis.set(`${CACHE_KEY_PREFIX}${roleName}`, JSON.stringify(permissions), 'EX', ttlSeconds);
        } catch {
            this.logger.warn({ msg: 'Permission cache SET failed', entity: 'Cache', roleName });
        }
    }

    async clearPermissions(roleName: string): Promise<void> {
        try {
            await this.redis.del(`${CACHE_KEY_PREFIX}${roleName}`);
        } catch {
            this.logger.warn({ msg: 'Permission cache DEL failed', entity: 'Cache', roleName });
        }
    }

    async onModuleDestroy(): Promise<void> {
        await this.redis.quit();
    }
}
