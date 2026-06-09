import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';

// Database
import { PostgresDatabaseProviderModule } from '@app/infrastructure/persistence/postgres-database-provider.module';

// Domain Ports
import { IUserRepository } from '@domain/ports/user-repository.port';
import { IRoleRepository } from '@domain/ports/role-repository.port';
import { IUserRoleRepository } from '@domain/ports/user-role-repository.port';
import { IRolePermissionRepository } from '@domain/ports/role-permission-repository.port';
import { IPermissionRepository } from '@domain/ports/permission-repository.port';
import { IGroupRepository } from '@domain/ports/group-repository.port';
import { IGroupRoleRepository } from '@domain/ports/group-role-repository.port';
import { IUserGroupRepository } from '@domain/ports/user-group-repository.port';
import { INotificationService } from '@domain/ports/notification-service.port';
import { ICacheService } from '@domain/ports/cache-service.port';
import { IMessageBroker } from '@domain/ports/message-broker.port';
import { ITransactionManagerService } from '@domain/types/transaction-manager.type';

// Infrastructure Implementations
import { UserRepository } from '@infrastructure/persistence/user.repository';
import { RoleRepository } from '@infrastructure/persistence/role.repository';
import { UserRoleRepository } from '@infrastructure/persistence/user-role.repository';
import { RolePermissionRepository } from '@infrastructure/persistence/role-permission.repository';
import { PermissionRepository } from '@infrastructure/persistence/permission.repository';
import { GroupRepository } from '@infrastructure/persistence/group.repository';
import { GroupRoleRepository } from '@infrastructure/persistence/group-role.repository';
import { UserGroupRepository } from '@infrastructure/persistence/user-group.repository';
import { NotificationService } from '@infrastructure/services/notification.service';
import { TransactionManagerService } from '@infrastructure/services/transaction-manager.service';
import { RedisCacheService } from '@infrastructure/services/redis-cache.service';
import { RabbitmqService } from '@infrastructure/messaging/rabbitmq.service';

// Cache
import { CachingQueryBus } from '@infrastructure/cache/caching-query-bus.service';

// Config
import { RedisConfigModule } from '@config/redis/redis-config.module';
import { RabbitmqConfigModule } from '@config/rabbitmq/rabbitmq-config.module';

// Entities
import { User } from '@domain/entities/user.entity';
import { Role } from '@domain/entities/role.entity';
import { UserRole } from '@domain/entities/user-role.entity';
import { RolePermission } from '@domain/entities/role-permission.entity';
import { Permission } from '@domain/entities/permission.entity';
import { Group } from '@domain/entities/group.entity';
import { GroupRole } from '@domain/entities/group-role.entity';
import { UserGroup } from '@domain/entities/user-group.entity';

@Module({
    imports: [
        CqrsModule,
        PostgresDatabaseProviderModule,
        RedisConfigModule,
        RabbitmqConfigModule,
        TypeOrmModule.forFeature([User, Role, UserRole, RolePermission, Permission, Group, GroupRole, UserGroup]),
    ],
    controllers: [],
    providers: [
        {
            provide: IUserRepository,
            useClass: UserRepository,
        },
        {
            provide: IRoleRepository,
            useClass: RoleRepository,
        },
        {
            provide: IUserRoleRepository,
            useClass: UserRoleRepository,
        },
        {
            provide: IRolePermissionRepository,
            useClass: RolePermissionRepository,
        },
        {
            provide: IPermissionRepository,
            useClass: PermissionRepository,
        },
        {
            provide: IGroupRepository,
            useClass: GroupRepository,
        },
        {
            provide: IGroupRoleRepository,
            useClass: GroupRoleRepository,
        },
        {
            provide: IUserGroupRepository,
            useClass: UserGroupRepository,
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
    ],
    exports: [
        IUserRepository,
        IRoleRepository,
        IUserRoleRepository,
        IRolePermissionRepository,
        IPermissionRepository,
        IGroupRepository,
        IGroupRoleRepository,
        IUserGroupRepository,
        INotificationService,
        ITransactionManagerService,
        ICacheService,
        IMessageBroker,
        CachingQueryBus,
    ],
})
export class InfrastructureModule {}
