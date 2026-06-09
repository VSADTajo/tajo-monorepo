import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import configuration from './redis-config';
import { RedisConfigService } from './redis-config.service';

@Module({
    imports: [ConfigModule.forFeature(configuration)],
    providers: [ConfigService, RedisConfigService],
    exports: [RedisConfigService],
})
export class RedisConfigModule {}
