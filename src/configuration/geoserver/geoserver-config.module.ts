import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import configuration from '@config/geoserver/geoserver-config';
import { GeoserverDbConfigService } from '@config/geoserver/geoserver-config.service';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            load: [configuration],
        }),
    ],
    providers: [ConfigService, GeoserverDbConfigService],
    exports: [GeoserverDbConfigService],
})
export class GeoserverDbConfigModule {}
