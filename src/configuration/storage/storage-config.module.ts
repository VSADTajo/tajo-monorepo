import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import configuration from './storage-config';
import { StorageConfigService } from './storage-config.service';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            load: [configuration],
        }),
    ],
    providers: [ConfigService, StorageConfigService],
    exports: [StorageConfigService],
})
export class StorageConfigModule {}
