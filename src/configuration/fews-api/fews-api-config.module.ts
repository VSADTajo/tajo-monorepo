import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import configuration from './fews-api-config';
import { FewsApiConfigService } from './fews-api-config.service';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            load: [configuration],
        }),
    ],
    providers: [ConfigService, FewsApiConfigService],
    exports: [FewsApiConfigService],
})
export class FewsApiConfigModule {}
