import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import configuration from './hydro-api-config';
import { HydroApiConfigService } from './hydro-api-config.service';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            load: [configuration],
        }),
    ],
    providers: [ConfigService, HydroApiConfigService],
    exports: [HydroApiConfigService],
})
export class HydroApiConfigModule {}
