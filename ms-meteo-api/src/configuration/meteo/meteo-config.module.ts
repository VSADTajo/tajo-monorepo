import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import configuration from './meteo-config';
import { MeteoConfigService } from './meteo-config.service';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            load: [configuration],
        }),
    ],
    providers: [ConfigService, MeteoConfigService],
    exports: [MeteoConfigService],
})
export class MeteoConfigModule {}
