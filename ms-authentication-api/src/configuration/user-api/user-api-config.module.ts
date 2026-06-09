import { Module } from '@nestjs/common';
import configuration from './user-api-config';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UserApiConfigService } from './user-api-config.service';

@Module({
    imports: [ConfigModule.forFeature(configuration)],
    providers: [ConfigService, UserApiConfigService],
    exports: [UserApiConfigService],
})
export class UserApiConfigModule {}
