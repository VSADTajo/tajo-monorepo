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
import { IPredictionTypeRepository } from '@domain/ports/prediction-type-repository.port';
import { ISimulationRepository } from '@domain/ports/simulation-repository.port';
import { IPredictionRepository } from '@domain/ports/prediction-repository.port';
import { IPredictionResultRepository } from '@domain/ports/prediction-result-repository.port';
import { IStationThresholdService } from '@domain/ports/station-threshold-service.port';

// Infrastructure Implementations
import { PredictionTypeRepository } from '@infrastructure/persistence/prediction-type.repository';
import { SimulationRepository } from '@infrastructure/persistence/simulation.repository';
import { PredictionRepository } from '@infrastructure/persistence/prediction.repository';
import { PredictionResultRepository } from '@infrastructure/persistence/prediction-result.repository';
import { NotificationService } from '@infrastructure/services/notification.service';
import { TransactionManagerService } from '@infrastructure/services/transaction-manager.service';
import { RedisCacheService } from '@infrastructure/services/redis-cache.service';
import { RabbitmqService } from '@infrastructure/messaging/rabbitmq.service';
import { StationThresholdService } from '@infrastructure/services/station-threshold.service';

// Cache
import { CachingQueryBus } from '@infrastructure/cache/caching-query-bus.service';

// Config
import { RedisConfigModule } from '@config/redis/redis-config.module';
import { RabbitmqConfigModule } from '@config/rabbitmq/rabbitmq-config.module';
import { HydroApiConfigModule } from '@config/hydro-api/hydro-api-config.module';

// Entities
import { PredictionType } from '@domain/entities/prediction-type.entity';
import { Simulation } from '@domain/entities/simulation.entity';
import { Prediction } from '@domain/entities/prediction.entity';
import { PredictionResult } from '@domain/entities/prediction-result.entity';

@Module({
    imports: [
        CqrsModule,
        ScheduleModule.forRoot(),
        PostgresDatabaseProviderModule,
        RedisConfigModule,
        RabbitmqConfigModule,
        HydroApiConfigModule,
        TypeOrmModule.forFeature([PredictionType, Simulation, Prediction, PredictionResult]),
    ],
    controllers: [],
    providers: [
        {
            provide: IPredictionTypeRepository,
            useClass: PredictionTypeRepository,
        },
        {
            provide: ISimulationRepository,
            useClass: SimulationRepository,
        },
        {
            provide: IPredictionRepository,
            useClass: PredictionRepository,
        },
        {
            provide: IPredictionResultRepository,
            useClass: PredictionResultRepository,
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
        {
            provide: IStationThresholdService,
            useClass: StationThresholdService,
        },
        CachingQueryBus,
    ],
    exports: [
        IPredictionTypeRepository,
        ISimulationRepository,
        IPredictionRepository,
        IPredictionResultRepository,
        INotificationService,
        ITransactionManagerService,
        ICacheService,
        IMessageBroker,
        IStationThresholdService,
        CachingQueryBus,
    ],
})
export class InfrastructureModule {}
