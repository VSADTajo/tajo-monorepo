import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

// Domain Ports
import { IUserApiClient } from '@domain/ports/user-api-client.port';
import { ICacheService } from '@domain/ports/cache-service.port';

// Infrastructure Implementations
import { UserApiClientService } from '@infrastructure/services/user-api-client.service';
import { RedisCacheService } from '@infrastructure/services/redis-cache.service';

// Cache
import { CachingQueryBus } from '@infrastructure/cache/caching-query-bus.service';

// Config
import { RedisConfigModule } from '@config/redis/redis-config.module';
import { UserApiConfigModule } from '@config/user-api/user-api-config.module';

@Module({
    imports: [CqrsModule, RedisConfigModule, UserApiConfigModule],
    controllers: [],
    providers: [
        {
            provide: IUserApiClient,
            useClass: UserApiClientService,
        },
        {
            provide: ICacheService,
            useClass: RedisCacheService,
        },
        CachingQueryBus,
    ],
    exports: [IUserApiClient, ICacheService, CachingQueryBus],
})
export class InfrastructureModule {}
