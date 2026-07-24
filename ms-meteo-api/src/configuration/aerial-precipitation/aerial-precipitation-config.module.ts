import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import configuration from './aerial-precipitation-config';
import { AerialPrecipitationConfigService } from './aerial-precipitation-config.service';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            load: [configuration],
        }),
    ],
    providers: [ConfigService, AerialPrecipitationConfigService],
    exports: [AerialPrecipitationConfigService],
})
export class AerialPrecipitationConfigModule {}
