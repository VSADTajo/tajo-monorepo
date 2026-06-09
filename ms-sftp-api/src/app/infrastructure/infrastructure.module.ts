import { Logger, Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';

// Database
import { PostgresDatabaseProviderModule } from '@app/infrastructure/persistence/postgres-database-provider.module';

// Domain Ports
import { INotificationService } from '@domain/ports/notification-service.port';
import { ICacheService } from '@domain/ports/cache-service.port';
import { IMessageBroker } from '@domain/ports/message-broker.port';
import { ITransactionManagerService } from '@domain/types/transaction-manager.type';
import { IFileStorageService } from '@domain/ports/file-storage-service.port';
import { ISftpClientService } from '@domain/ports/sftp-client-service.port';
import { IMappingSchemaRepository } from '@domain/ports/mapping-schema-repository.port';
import { ISftpUserRepository } from '@domain/ports/sftp-user-repository.port';
import { IFileTransformer } from '@domain/ports/file-transformer.port';
import { ICleanupJobRepository } from '@domain/ports/cleanup-job-repository.port';
import { ICleanupScheduler } from '@domain/ports/cleanup-scheduler.port';
import { IAuthValidationService } from '@domain/ports/auth-validation.port';

// Entities
import { MappingSchema } from '@domain/entities/mapping-schema.entity';
import { SftpUser } from '@domain/entities/sftp-user.entity';
import { CleanupJob } from '@domain/entities/cleanup-job.entity';

// Infrastructure Implementations
import { NotificationService } from '@infrastructure/services/notification.service';
import { TransactionManagerService } from '@infrastructure/services/transaction-manager.service';
import { RedisCacheService } from '@infrastructure/services/redis-cache.service';
import { RabbitmqService } from '@infrastructure/messaging/rabbitmq.service';
import { LocalFileStorageService } from '@infrastructure/services/local-file-storage.service';
import { SftpClientServiceImpl } from '@infrastructure/services/sftp-client.service';
import { MappingSchemaRepository } from '@infrastructure/persistence/mapping-schema.repository';
import { SftpUserRepository } from '@infrastructure/persistence/sftp-user.repository';
import { FileTransformerService } from '@infrastructure/services/file-transformer.service';
import { SftpServerService } from '@infrastructure/services/sftp-server.service';
import { CleanupJobRepository } from '@infrastructure/persistence/cleanup-job.repository';
import { CleanupSchedulerService } from '@infrastructure/services/cleanup-scheduler.service';
import { AuthValidationService } from '@infrastructure/services/auth-validation.service';
import { AuthMiddleware } from '@infrastructure/middleware/auth.middleware';

// Cache
import { CachingQueryBus } from '@infrastructure/cache/caching-query-bus.service';

// Config
import { RedisConfigModule } from '@config/redis/redis-config.module';
import { RabbitmqConfigModule } from '@config/rabbitmq/rabbitmq-config.module';
import { StorageConfigModule } from '@config/storage/storage-config.module';
import { SftpConfigModule } from '@config/sftp/sftp-config.module';
import { SftpServerConfigModule } from '@config/sftp-server/sftp-server-config.module';
import { AuthApiConfigModule } from '@config/auth-api/auth-api-config.module';

@Module({
    imports: [
        CqrsModule,
        PostgresDatabaseProviderModule,
        TypeOrmModule.forFeature([MappingSchema, SftpUser, CleanupJob]),
        RedisConfigModule,
        RabbitmqConfigModule,
        StorageConfigModule,
        SftpConfigModule,
        SftpServerConfigModule,
        AuthApiConfigModule,
    ],
    controllers: [],
    providers: [
        Logger,
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
        {
            provide: IFileStorageService,
            useClass: LocalFileStorageService,
        },
        {
            provide: ISftpClientService,
            useClass: SftpClientServiceImpl,
        },
        {
            provide: IMappingSchemaRepository,
            useClass: MappingSchemaRepository,
        },
        {
            provide: ISftpUserRepository,
            useClass: SftpUserRepository,
        },
        {
            provide: IFileTransformer,
            useClass: FileTransformerService,
        },
        {
            provide: ICleanupJobRepository,
            useClass: CleanupJobRepository,
        },
        {
            provide: ICleanupScheduler,
            useClass: CleanupSchedulerService,
        },
        {
            provide: IAuthValidationService,
            useClass: AuthValidationService,
        },
        CachingQueryBus,
        SftpServerService,
        AuthMiddleware,
    ],
    exports: [
        Logger,
        INotificationService,
        ITransactionManagerService,
        ICacheService,
        IMessageBroker,
        IFileStorageService,
        ISftpClientService,
        IMappingSchemaRepository,
        ISftpUserRepository,
        IFileTransformer,
        ICleanupJobRepository,
        ICleanupScheduler,
        IAuthValidationService,
        AuthMiddleware,
        CachingQueryBus,
        StorageConfigModule,
    ],
})
export class InfrastructureModule {}
