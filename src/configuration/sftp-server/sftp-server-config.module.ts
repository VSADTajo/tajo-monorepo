import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import configuration from './sftp-server-config';
import { SftpServerConfigService } from './sftp-server-config.service';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            load: [configuration],
        }),
    ],
    providers: [ConfigService, SftpServerConfigService],
    exports: [SftpServerConfigService],
})
export class SftpServerConfigModule {}
