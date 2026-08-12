import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';

// Database
import { PostgresDatabaseProviderModule } from '@app/infrastructure/persistence/postgres-database-provider.module';
import { GeoserverDatabaseProviderModule } from '@app/infrastructure/persistence/geoserver-database-provider.module';

// Domain Ports
import { IBasinRepository } from '@domain/ports/basin-repository.port';
import { ISubBasinRepository } from '@domain/ports/sub-basin-repository.port';
import { IStationRepository } from '@domain/ports/station-repository.port';
import { IStationThresholdRepository } from '@domain/ports/station-threshold-repository.port';
import { IStationResguardoRepository } from '@domain/ports/station-resguardo-repository.port';
import { IScenarioRepository } from '@domain/ports/scenario-repository.port';
import { IScenarioFileRepository } from '@domain/ports/scenario-file-repository.port';
import { IGeoserverRepository } from '@domain/ports/geoserver-repository.port';
import { IGeoDataRepository } from '@domain/ports/geo-data-repository.port';
import { IDownstreamStationsRepository } from '@domain/ports/downstream-stations-repository.port';
import { INotificationService } from '@domain/ports/notification-service.port';
import { ICacheService } from '@domain/ports/cache-service.port';
import { IMessageBroker } from '@domain/ports/message-broker.port';
import { ITransactionManagerService } from '@domain/types/transaction-manager.type';

// Infrastructure Implementations
import { BasinRepository } from '@infrastructure/persistence/basin.repository';
import { SubBasinRepository } from '@infrastructure/persistence/sub-basin.repository';
import { StationRepository } from '@infrastructure/persistence/station.repository';
import { StationThresholdRepository } from '@infrastructure/persistence/station-threshold.repository';
import { StationResguardoRepository } from '@infrastructure/persistence/station-resguardo.repository';
import { GeoserverRepository } from '@infrastructure/persistence/geoserver.repository';
import { GeoDataRepository } from '@infrastructure/persistence/geo-data.repository';
import { DownstreamStationsRepository } from '@infrastructure/persistence/downstream-stations.repository';
import { NotificationService } from '@infrastructure/services/notification.service';
import { TransactionManagerService } from '@infrastructure/services/transaction-manager.service';
import { RedisCacheService } from '@infrastructure/services/redis-cache.service';
import { RabbitmqService } from '@infrastructure/messaging/rabbitmq.service';
import { ResguardoImportService } from '@infrastructure/services/resguardo-import.service';
import { ScenarioRepository } from '@infrastructure/persistence/scenario.repository';
import { ScenarioFileRepository } from '@infrastructure/persistence/scenario-file.repository';

// Cache
import { CachingQueryBus } from '@infrastructure/cache/caching-query-bus.service';

// Config
import { RedisConfigModule } from '@config/redis/redis-config.module';
import { RabbitmqConfigModule } from '@config/rabbitmq/rabbitmq-config.module';

// Entities
import { Basin } from '@domain/entities/basin.entity';
import { SubBasin } from '@domain/entities/sub-basin.entity';
import { Station } from '@domain/entities/station.entity';
import { StationThreshold } from '@domain/entities/station-threshold.entity';
import { StationResguardo } from '@domain/entities/station-resguardo.entity';
import { Scenario } from '@domain/entities/scenario.entity';
import { ScenarioFile } from '@domain/entities/scenario-file.entity';

@Module({
    imports: [
        CqrsModule,
        PostgresDatabaseProviderModule,
        GeoserverDatabaseProviderModule,
        RedisConfigModule,
        RabbitmqConfigModule,
        TypeOrmModule.forFeature([Basin, SubBasin, Station, StationThreshold, StationResguardo, Scenario, ScenarioFile]),
    ],
    controllers: [],
    providers: [
        {
            provide: INotificationService,
            useClass: NotificationService,
        },
        {
            provide: ITransactionManagerService,
            useClass: TransactionManagerService,
        },
        {
            provide: ICacheService,
            useClass: RedisCacheService,
        },
        {
            provide: IBasinRepository,
            useClass: BasinRepository,
        },
        {
            provide: ISubBasinRepository,
            useClass: SubBasinRepository,
        },
        {
            provide: IStationRepository,
            useClass: StationRepository,
        },
        {
            provide: IStationThresholdRepository,
            useClass: StationThresholdRepository,
        },
        {
            provide: IGeoserverRepository,
            useClass: GeoserverRepository,
        },
        {
            provide: IGeoDataRepository,
            useClass: GeoDataRepository,
        },
        {
            provide: IDownstreamStationsRepository,
            useClass: DownstreamStationsRepository,
        },
        {
            provide: IStationResguardoRepository,
            useClass: StationResguardoRepository,
        },
        {
            provide: IScenarioRepository,
            useClass: ScenarioRepository,
        },
        {
            provide: IScenarioFileRepository,
            useClass: ScenarioFileRepository,
        },
        {
            provide: IMessageBroker,
            useClass: RabbitmqService,
        },
        ResguardoImportService,
        CachingQueryBus,
    ],
    exports: [
        IBasinRepository,
        ISubBasinRepository,
        IStationRepository,
        IStationThresholdRepository,
        IGeoserverRepository,
        IGeoDataRepository,
        IDownstreamStationsRepository,
        INotificationService,
        ITransactionManagerService,
        ICacheService,
        IStationResguardoRepository,
        IScenarioRepository,
        IScenarioFileRepository,
        IMessageBroker,
        ResguardoImportService,
        CachingQueryBus,
    ],
})
export class InfrastructureModule {}
