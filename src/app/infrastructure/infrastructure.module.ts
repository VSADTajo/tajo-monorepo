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
import { INotificationRepository } from '@domain/ports/notification-repository.port';

// Infrastructure Implementations
import { NotificationService } from '@infrastructure/services/notification.service';
import { TransactionManagerService } from '@infrastructure/services/transaction-manager.service';
import { RedisCacheService } from '@infrastructure/services/redis-cache.service';
import { RabbitmqService } from '@infrastructure/messaging/rabbitmq.service';
import { NotificationRepository } from '@infrastructure/persistence/notification.repository';

// Cache
import { CachingQueryBus } from '@infrastructure/cache/caching-query-bus.service';

// Config
import { RedisConfigModule } from '@config/redis/redis-config.module';
import { RabbitmqConfigModule } from '@config/rabbitmq/rabbitmq-config.module';

// Entities
import { Notification } from '@domain/entities/notification.entity';

@Module({
    imports: [
        CqrsModule,
        PostgresDatabaseProviderModule,
        RedisConfigModule,
        RabbitmqConfigModule,
        TypeOrmModule.forFeature([Notification]),
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
            provide: IMessageBroker,
            useClass: RabbitmqService,
        },
        {
            provide: INotificationRepository,
            useClass: NotificationRepository,
        },
        CachingQueryBus,
    ],
    exports: [
        INotificationService,
        INotificationRepository,
        ITransactionManagerService,
        ICacheService,
        IMessageBroker,
        CachingQueryBus,
    ],
})
export class InfrastructureModule {}
