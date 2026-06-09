import { Module } from '@nestjs/common';
import configuration from './services-config';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ServicesConfigService } from './services-config.service';

@Module({
    imports: [ConfigModule.forFeature(configuration)],
    providers: [ConfigService, ServicesConfigService],
    exports: [ServicesConfigService],
})
export class ServicesConfigModule {}
