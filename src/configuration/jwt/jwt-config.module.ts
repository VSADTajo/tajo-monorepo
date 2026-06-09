import { Module } from '@nestjs/common';
import configuration from './jwt-config';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtConfigService } from './jwt-config.service';

@Module({
    imports: [ConfigModule.forFeature(configuration)],
    providers: [ConfigService, JwtConfigService],
    exports: [JwtConfigService],
})
export class JwtConfigModule {}
