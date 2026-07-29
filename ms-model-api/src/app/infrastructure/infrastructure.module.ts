import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';

// Database
import { PostgresDatabaseProviderModule } from '@app/infrastructure/persistence/postgres-database-provider.module';

// Domain Ports
import { INotificationService } from '@domain/ports/notification-service.port';
import { ICacheService } from '@domain/ports/cache-service.port';
import { IMessageBroker } from '@domain/ports/message-broker.port';
import { ITransactionManagerService } from '@domain/types/transaction-manager.type';
import { IProviderConfigRepository } from '@domain/ports/provider-config-repository.port';
import { IIngestionRunRepository } from '@domain/ports/ingestion-run-repository.port';
import { ISimulationRunRepository } from '@domain/ports/simulation-run-repository.port';

// Infrastructure Implementations
import { ProviderConfigRepository } from '@infrastructure/persistence/provider-config.repository';
import { IngestionRunRepository } from '@infrastructure/persistence/ingestion-run.repository';
import { SimulationRunRepository } from '@infrastructure/persistence/simulation-run.repository';
import { NotificationService } from '@infrastructure/services/notification.service';
import { TransactionManagerService } from '@infrastructure/services/transaction-manager.service';
import { RedisCacheService } from '@infrastructure/services/redis-cache.service';
import { RabbitmqService } from '@infrastructure/messaging/rabbitmq.service';
import { FewsApiProviderService } from '@infrastructure/services/fews-api-provider.service';
import { SftpFileProviderService } from '@infrastructure/services/sftp-file-provider.service';
import { CsvFileProviderService } from '@infrastructure/services/csv-file-provider.service';
import { DataProviderFactoryService } from '@infrastructure/services/data-provider-factory.service';
import { ProviderSchedulerService } from '@infrastructure/services/provider-scheduler.service';
import { SimulationResultFetcherService } from '@infrastructure/services/simulation-result-fetcher.service';
import { FewsTargetResolverService } from '@infrastructure/services/fews-target-resolver.service';
import { MockFewsTaskStoreService } from '@infrastructure/services/mock-fews-task-store.service';
import { SimulationOutputArchiverService } from '@infrastructure/services/simulation-output-archiver.service';
import { FewsTaskClientService } from '@infrastructure/services/fews-task-client.service';
import { FewsSimulationLauncherService } from '@infrastructure/services/fews-simulation-launcher.service';
import { FewsResultFetcherService } from '@infrastructure/services/fews-result-fetcher.service';
import { SimulationDispatchedConsumerService } from '@infrastructure/services/simulation-dispatched-consumer.service';
import { SimulationRunPollerService } from '@infrastructure/services/simulation-run-poller.service';

// Cache
import { CachingQueryBus } from '@infrastructure/cache/caching-query-bus.service';

// Config
import { RedisConfigModule } from '@config/redis/redis-config.module';
import { RabbitmqConfigModule } from '@config/rabbitmq/rabbitmq-config.module';
import { FewsApiConfigModule } from '@config/fews-api/fews-api-config.module';
import { SftpApiConfigModule } from '@config/sftp-api/sftp-api-config.module';
import { AppConfigModule } from '@config/app/app-config.module';

// Entities
import { ProviderConfig } from '@domain/entities/provider-config.entity';
import { IngestionRun } from '@domain/entities/ingestion-run.entity';
import { SimulationRun } from '@domain/entities/simulation-run.entity';

@Module({
    imports: [
        CqrsModule,
        ScheduleModule.forRoot(),
        PostgresDatabaseProviderModule,
        RedisConfigModule,
        RabbitmqConfigModule,
        FewsApiConfigModule,
        SftpApiConfigModule,
        AppConfigModule,
        TypeOrmModule.forFeature([ProviderConfig, IngestionRun, SimulationRun]),
    ],
    controllers: [],
    providers: [
        {
            provide: IProviderConfigRepository,
            useClass: ProviderConfigRepository,
        },
        {
            provide: IIngestionRunRepository,
            useClass: IngestionRunRepository,
        },
        {
            provide: ISimulationRunRepository,
            useClass: SimulationRunRepository,
        },
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
            provide: IMessageBroker,
            useClass: RabbitmqService,
        },
        CachingQueryBus,
        FewsApiProviderService,
        SftpFileProviderService,
        CsvFileProviderService,
        DataProviderFactoryService,
        ProviderSchedulerService,
        SimulationResultFetcherService,
        FewsTargetResolverService,
        MockFewsTaskStoreService,
        SimulationOutputArchiverService,
        FewsTaskClientService,
        FewsSimulationLauncherService,
        FewsResultFetcherService,
        SimulationDispatchedConsumerService,
        SimulationRunPollerService,
    ],
    exports: [
        IProviderConfigRepository,
        IIngestionRunRepository,
        ISimulationRunRepository,
        INotificationService,
        ITransactionManagerService,
        ICacheService,
        IMessageBroker,
        CachingQueryBus,
        FewsApiProviderService,
        SftpFileProviderService,
        CsvFileProviderService,
        DataProviderFactoryService,
        ProviderSchedulerService,
        SimulationResultFetcherService,
        MockFewsTaskStoreService,
    ],
})
export class InfrastructureModule {}
