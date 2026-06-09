import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import configuration from './rabbitmq-config';
import { RabbitmqConfigService } from './rabbitmq-config.service';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            load: [configuration],
        }),
    ],
    providers: [ConfigService, RabbitmqConfigService],
    exports: [RabbitmqConfigService],
})
export class RabbitmqConfigModule {}
