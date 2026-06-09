import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';

// Database
import { PostgresDatabaseProviderModule } from '@app/infrastructure/persistence/postgres-database-provider.module';

// Domain Ports
import { INotificationService } from '@domain/ports/notification-service.port';
import { ICacheService } from '@domain/ports/cache-service.port';
import { IMessageBroker } from '@domain/ports/message-broker.port';
import { ITransactionManagerService } from '@domain/types/transaction-manager.type';
import { ISftpFileClient } from '@domain/ports/sftp-file-client.port';
import { IGeoserverImageMosaicClient } from '@domain/ports/geoserver-image-mosaic-client.port';
import { IRasterConverter } from '@domain/ports/raster-converter.port';
import { IFileSystem } from '@domain/ports/file-system.port';
import { IMeteoIngestRunRepository } from '@domain/ports/meteo-ingest-run-repository.port';
import { IAemetClient } from '@domain/ports/aemet-client.port';

// Infrastructure Implementations
import { NotificationService } from '@infrastructure/services/notification.service';
import { TransactionManagerService } from '@infrastructure/services/transaction-manager.service';
import { RedisCacheService } from '@infrastructure/services/redis-cache.service';
import { RabbitmqService } from '@infrastructure/messaging/rabbitmq.service';
import { SftpFileClient } from '@infrastructure/sftp/sftp-file.client';
import { GeoserverImageMosaicClient } from '@infrastructure/geoserver/geoserver-image-mosaic.client';
import { GdalRasterConverter } from '@infrastructure/gdal/gdal-raster-converter';
import { NodeFileSystem } from '@infrastructure/file-system/node-file-system';
import { MeteoIngestRunRepository } from '@infrastructure/persistence/meteo-ingest-run.repository';
import { AemetClientService } from '@infrastructure/services/aemet-client.service';

// Cache
import { CachingQueryBus } from '@infrastructure/cache/caching-query-bus.service';

// Config
import { RedisConfigModule } from '@config/redis/redis-config.module';
import { RabbitmqConfigModule } from '@config/rabbitmq/rabbitmq-config.module';
import { MeteoConfigModule } from '@config/meteo/meteo-config.module';

// Entities
import { MeteoIngestRun } from '@domain/entities/meteo-ingest-run.entity';

@Module({
    imports: [
        CqrsModule,
        PostgresDatabaseProviderModule,
        RedisConfigModule,
        RabbitmqConfigModule,
        MeteoConfigModule,
        TypeOrmModule.forFeature([MeteoIngestRun]),
    ],
    controllers: [],
    providers: [
        { provide: INotificationService, useClass: NotificationService },
        { provide: ITransactionManagerService, useClass: TransactionManagerService },
        { provide: ICacheService, useClass: RedisCacheService },
        { provide: IMessageBroker, useClass: RabbitmqService },
        { provide: ISftpFileClient, useClass: SftpFileClient },
        { provide: IGeoserverImageMosaicClient, useClass: GeoserverImageMosaicClient },
        { provide: IRasterConverter, useClass: GdalRasterConverter },
        { provide: IFileSystem, useClass: NodeFileSystem },
        { provide: IMeteoIngestRunRepository, useClass: MeteoIngestRunRepository },
        { provide: IAemetClient, useClass: AemetClientService },
        CachingQueryBus,
    ],
    exports: [
        INotificationService,
        ITransactionManagerService,
        ICacheService,
        IMessageBroker,
        ISftpFileClient,
        IGeoserverImageMosaicClient,
        IRasterConverter,
        IFileSystem,
        IMeteoIngestRunRepository,
        IAemetClient,
        CachingQueryBus,
        MeteoConfigModule,
    ],
})
export class InfrastructureModule {}
