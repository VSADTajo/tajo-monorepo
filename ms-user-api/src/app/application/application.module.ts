import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

// Infrastructure
import { InfrastructureModule } from '@infrastructure/infrastructure.module';

// Command Handlers
import {
    AssignRoleToUserHandler,
    CreateRoleHandler,
    DeleteRoleHandler,
    RemoveRoleFromUserHandler,
} from '@application/commands/role.commands';
import {
    RegisterUserHandler,
    UpdateUserHandler,
    UpdateUserPasswordHandler,
    DeleteUserHandler,
} from '@application/commands/user.commands';
import { SyncRolePermissionsHandler } from '@application/commands/role-permission.commands';
import {
    CreatePermissionHandler,
    DeletePermissionHandler,
    SyncPermissionsHandler,
} from '@application/commands/permission.commands';
import {
    CreateGroupHandler,
    DeleteGroupHandler,
    AssignRoleToGroupHandler,
    RemoveRoleFromGroupHandler,
    AssignGroupToUserHandler,
    RemoveGroupFromUserHandler,
} from '@application/commands/group.commands';

// Query Handlers
import { GetUserRolesHandler, ListRolesHandler } from '@application/queries/role.queries';
import { GetUserByIdHandler, GetUserByEmailHandler, ListUsersHandler } from '@application/queries/user.queries';
import { GetRolePermissionsHandler, GetBulkPermissionsHandler } from '@application/queries/role-permission.queries';
import { ListPermissionsHandler } from '@application/queries/permission.queries';
import { ListGroupsHandler, GetUserGroupsHandler } from '@application/queries/group.queries';

// Controllers
import { RoleController } from '@api/controllers/role.controller';
import { UserController } from '@api/controllers/user.controller';
import { PermissionController } from '@api/controllers/permission.controller';
import { GroupController } from '@api/controllers/group.controller';

// Consumers
import { ExampleConsumer } from '@application/consumers/example.consumer';

@Module({
    imports: [CqrsModule, InfrastructureModule],
    controllers: [UserController, RoleController, PermissionController, GroupController, ExampleConsumer],
    providers: [
        RegisterUserHandler,
        UpdateUserHandler,
        UpdateUserPasswordHandler,
        DeleteUserHandler,
        CreateRoleHandler,
        DeleteRoleHandler,
        AssignRoleToUserHandler,
        RemoveRoleFromUserHandler,
        SyncRolePermissionsHandler,
        CreatePermissionHandler,
        DeletePermissionHandler,
        SyncPermissionsHandler,
        CreateGroupHandler,
        DeleteGroupHandler,
        AssignRoleToGroupHandler,
        RemoveRoleFromGroupHandler,
        AssignGroupToUserHandler,
        RemoveGroupFromUserHandler,
        GetUserByIdHandler,
        GetUserByEmailHandler,
        ListUsersHandler,
        ListRolesHandler,
        GetUserRolesHandler,
        GetRolePermissionsHandler,
        GetBulkPermissionsHandler,
        ListPermissionsHandler,
        ListGroupsHandler,
        GetUserGroupsHandler,
    ],
})
export class ApplicationModule {}
