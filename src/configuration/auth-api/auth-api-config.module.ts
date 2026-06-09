import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import configuration from './auth-api-config';
import { AuthApiConfigService } from './auth-api-config.service';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            load: [configuration],
        }),
    ],
    providers: [ConfigService, AuthApiConfigService],
    exports: [AuthApiConfigService],
})
export class AuthApiConfigModule {}
