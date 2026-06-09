import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import configuration from '@config/postgres/db-config';
import { PostgresDbConfigService } from '@config/postgres/db-config.service';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            load: [configuration],
        }),
    ],
    providers: [ConfigService, PostgresDbConfigService],
    exports: [PostgresDbConfigService],
})
export class PostgresDbConfigModule {}
