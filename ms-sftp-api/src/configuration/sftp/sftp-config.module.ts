import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import configuration from './sftp-config';
import { SftpConfigService } from './sftp-config.service';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            load: [configuration],
        }),
    ],
    providers: [ConfigService, SftpConfigService],
    exports: [SftpConfigService],
})
export class SftpConfigModule {}
