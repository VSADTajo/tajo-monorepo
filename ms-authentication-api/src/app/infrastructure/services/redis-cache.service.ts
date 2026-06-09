import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import Redis from 'ioredis';

import { ICacheService } from '@domain/ports/cache-service.port';
import { RedisConfigService } from '@config/redis/redis-config.service';

@Injectable()
export class RedisCacheService implements ICacheService, OnModuleDestroy {
    private readonly redis: Redis;
    private readonly defaultTtl: number;

    constructor(
        @Inject(Logger)
        private readonly logger: Logger,
        private readonly redisConfig: RedisConfigService,
    ) {
        this.redis = new Redis({
            host: this.redisConfig.host,
            port: this.redisConfig.port,
            lazyConnect: true,
        });
        this.defaultTtl = this.redisConfig.defaultTtl;

        this.redis.connect().catch((err: Error) => {
            this.logger.warn({ msg: 'Redis connection failed', entity: 'Cache', error: err.message });
        });
    }

    async get<T>(key: string): Promise<T | null> {
        try {
            const data = await this.redis.get(key);
            if (!data) return null;
            return JSON.parse(data) as T;
        } catch {
            this.logger.warn({ msg: 'GET failed', entity: 'Cache', key });
            return null;
        }
    }

    async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
        try {
            const ttl = ttlSeconds ?? this.defaultTtl;
            await this.redis.set(key, JSON.stringify(value), 'EX', ttl);
        } catch {
            this.logger.warn({ msg: 'SET failed', entity: 'Cache', key });
        }
    }

    async del(key: string): Promise<void> {
        try {
            await this.redis.del(key);
        } catch {
            this.logger.warn({ msg: 'DEL failed', entity: 'Cache', key });
        }
    }

    async delByPattern(pattern: string): Promise<void> {
        try {
            let cursor = '0';
            do {
                const [nextCursor, keys] = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
                cursor = nextCursor;
                if (keys.length > 0) {
                    await this.redis.del(...keys);
                }
            } while (cursor !== '0');
        } catch {
            this.logger.warn({ msg: 'DEL by pattern failed', entity: 'Cache', key: pattern });
        }
    }

    async onModuleDestroy(): Promise<void> {
        await this.redis.quit();
    }
}
