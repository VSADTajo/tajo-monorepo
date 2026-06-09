import { Module } from '@nestjs/common';

// Services
import { ProxyService } from '@infrastructure/services/proxy.service';
import { PermissionCacheService } from '@infrastructure/services/permission-cache.service';

// Config
import { ServicesConfigModule } from '@config/services/services-config.module';
import { RedisConfigModule } from '@config/redis/redis-config.module';

@Module({
    imports: [ServicesConfigModule, RedisConfigModule],
    controllers: [],
    providers: [ProxyService, PermissionCacheService],
    exports: [ProxyService, ServicesConfigModule, PermissionCacheService, RedisConfigModule],
})
export class InfrastructureModule {}
