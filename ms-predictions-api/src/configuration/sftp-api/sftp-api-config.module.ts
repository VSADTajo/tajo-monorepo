import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import configuration from './sftp-api-config';
import { SftpApiConfigService } from './sftp-api-config.service';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            load: [configuration],
        }),
    ],
    providers: [ConfigService, SftpApiConfigService],
    exports: [SftpApiConfigService],
})
export class SftpApiConfigModule {}
