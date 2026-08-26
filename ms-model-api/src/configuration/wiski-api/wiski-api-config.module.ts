import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import configuration from './wiski-api-config';
import { WiskiApiConfigService } from './wiski-api-config.service';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            load: [configuration],
        }),
    ],
    providers: [ConfigService, WiskiApiConfigService],
    exports: [WiskiApiConfigService],
})
export class WiskiApiConfigModule {}
