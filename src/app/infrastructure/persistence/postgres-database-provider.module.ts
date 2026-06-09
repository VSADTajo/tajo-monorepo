import { PostgresDbConfigModule } from '@config/postgres/db-config.module';
import { PostgresDbConfigService } from '@config/postgres/db-config.service';
import { Module } from '@nestjs/common';
import { TypeOrmModule, TypeOrmModuleAsyncOptions } from '@nestjs/typeorm';

@Module({
    imports: [
        TypeOrmModule.forRootAsync({
            imports: [PostgresDbConfigModule],
            useFactory: async (dbConfigService: PostgresDbConfigService) => dbConfigService.config,
            inject: [PostgresDbConfigService],
        } as TypeOrmModuleAsyncOptions),
    ],
})
export class PostgresDatabaseProviderModule {}
