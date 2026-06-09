import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import configuration from './redis-config';
import { RedisConfigService } from './redis-config.service';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            load: [configuration],
        }),
    ],
    providers: [ConfigService, RedisConfigService],
    exports: [RedisConfigService],
})
export class RedisConfigModule {}
