import { Inject, Injectable } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { Logger } from 'nestjs-pino';

import { ICacheService } from '@domain/ports/cache-service.port';
import { CACHE_REGISTRY } from './cache-config.registry';

@Injectable()
export class CachingQueryBus {
    constructor(
        @Inject(Logger)
        private readonly logger: Logger,
        private readonly queryBus: QueryBus,
        private readonly cacheService: ICacheService,
    ) {}

    async execute<T>(query: object): Promise<T> {
        const queryName = query.constructor.name;
        const config = CACHE_REGISTRY.get(queryName);

        // Not in registry → pass through to QueryBus
        if (!config) {
            return this.queryBus.execute(query);
        }

        const cacheKey = config.key(query);

        // Try cache first
        const cached = await this.cacheService.get<T>(cacheKey);
        if (cached) {
            this.logger.debug(`Cache HIT: ${cacheKey}`);
            return cached;
        }

        // Cache miss → execute query and store result
        const result = await this.queryBus.execute<object, T>(query);
        await this.cacheService.set(cacheKey, result, config.ttl);
        this.logger.debug(`Cache MISS → stored: ${cacheKey} (ttl=${config.ttl}s)`);

        return result;
    }
}
