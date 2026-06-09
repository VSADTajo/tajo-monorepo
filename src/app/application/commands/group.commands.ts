import { HttpStatus, Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Logger } from 'nestjs-pino';

import { IGroupRepository } from '@domain/ports/group-repository.port';
import { IRoleRepository } from '@domain/ports/role-repository.port';
import { IGroupRoleRepository } from '@domain/ports/group-role-repository.port';
import { IUserRepository } from '@domain/ports/user-repository.port';
import { IUserGroupRepository } from '@domain/ports/user-group-repository.port';
import { ICacheService } from '@domain/ports/cache-service.port';
import { Group } from '@domain/entities/group.entity';
import { GroupRole } from '@domain/entities/group-role.entity';
import { UserGroup } from '@domain/entities/user-group.entity';
import { CreateGroupResult, AssignRoleToGroupResult, AssignGroupToUserResult } from '@domain/results/group.result';
import { RemoveRoleFromUserResult } from '@domain/results/remove-role-from-user.result';
import { ApiError } from '@domain/errors/api.error';
import { RepositoryError } from '@domain/errors/repository.error';
import { GroupCacheKeys, UserGroupCacheKeys, UserRoleCacheKeys } from '@infrastructure/cache/cache-config.registry';

// ─────────────────────────────────────────────────────────────
// CreateGroup
// ─────────────────────────────────────────────────────────────

export interface ICreateGroupCommand {
    name: string;
    description?: string;
}

export class CreateGroupCommand {
    constructor(private readonly parameters: ICreateGroupCommand) {}
    get name(): string {
        return this.parameters.name;
    }
    get description(): string | undefined {
        return this.parameters.description;
    }
}

@CommandHandler(CreateGroupCommand)
export class CreateGroupHandler implements ICommandHandler<CreateGroupCommand, CreateGroupResult> {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly groupRepository: IGroupRepository,
        private readonly cacheService: ICacheService,
    ) {}

    async execute(command: CreateGroupCommand): Promise<CreateGroupResult> {
        this.logger.log(`Creating group: ${command.name}`);

        const group = new Group({
            name: command.name,
            description: command.description ?? null,
        });
        group.validate();

        const existing = await this.groupRepository.findByName(group.name);
        if (existing) {
            throw new ApiError(HttpStatus.CONFLICT, `Group with name "${group.name}" already exists`);
        }

        const persisted = await this.groupRepository.create(group);
        this.logger.log(`Group created with id: ${persisted.id}`);

        await this.cacheService.delByPattern(GroupCacheKeys.pattern());

        return new CreateGroupResult({
            id: persisted.id,
            name: persisted.name,
            description: persisted.description,
        });
    }
}

// ─────────────────────────────────────────────────────────────
// DeleteGroup
// ─────────────────────────────────────────────────────────────

export interface IDeleteGroupCommand {
    groupId: string;
}

export class DeleteGroupCommand {
    constructor(private readonly parameters: IDeleteGroupCommand) {}
    get groupId(): string {
        return this.parameters.groupId;
    }
}

@CommandHandler(DeleteGroupCommand)
export class DeleteGroupHandler implements ICommandHandler<DeleteGroupCommand, void> {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly groupRepository: IGroupRepository,
        private readonly cacheService: ICacheService,
    ) {}

    async execute(command: DeleteGroupCommand): Promise<void> {
        this.logger.log(`Deleting group: ${command.groupId}`);

        try {
            await this.groupRepository.findById(command.groupId);
        } catch (error) {
            if (error instanceof RepositoryError) {
                throw new ApiError(HttpStatus.NOT_FOUND, `Group with id "${command.groupId}" not found`);
            }
            throw error;
        }

        // CASCADE deletes group_roles and user_groups
        await this.groupRepository.delete(command.groupId);
        await this.cacheService.delByPattern(GroupCacheKeys.pattern());
        await this.cacheService.delByPattern(UserGroupCacheKeys.pattern());

        this.logger.log(`Group ${command.groupId} deleted`);
    }
}

// ─────────────────────────────────────────────────────────────
// AssignRoleToGroup
// ─────────────────────────────────────────────────────────────

export interface IAssignRoleToGroupCommand {
    groupId: string;
    roleId: string;
}

export class AssignRoleToGroupCommand {
    constructor(private readonly parameters: IAssignRoleToGroupCommand) {}
    get groupId(): string {
        return this.parameters.groupId;
    }
    get roleId(): string {
        return this.parameters.roleId;
    }
}

@CommandHandler(AssignRoleToGroupCommand)
export class AssignRoleToGroupHandler implements ICommandHandler<AssignRoleToGroupCommand, AssignRoleToGroupResult> {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly groupRepository: IGroupRepository,
        private readonly roleRepository: IRoleRepository,
        private readonly groupRoleRepository: IGroupRoleRepository,
        private readonly cacheService: ICacheService,
    ) {}

    async execute(command: AssignRoleToGroupCommand): Promise<AssignRoleToGroupResult> {
        this.logger.log(`Assigning role ${command.roleId} to group ${command.groupId}`);

        try {
            await this.groupRepository.findById(command.groupId);
        } catch (error) {
            if (error instanceof RepositoryError) {
                throw new ApiError(HttpStatus.NOT_FOUND, `Group with id "${command.groupId}" not found`);
            }
            throw error;
        }

        let role;
        try {
            role = await this.roleRepository.findById(command.roleId);
        } catch (error) {
            if (error instanceof RepositoryError) {
                throw new ApiError(HttpStatus.NOT_FOUND, `Role with id "${command.roleId}" not found`);
            }
            throw error;
        }

        const existing = await this.groupRoleRepository.findByGroupIdAndRoleId(command.groupId, command.roleId);
        if (existing) {
            throw new ApiError(HttpStatus.CONFLICT, `Group already has role "${role.name}"`);
        }

        const assignment = new GroupRole({ groupId: command.groupId, roleId: command.roleId });
        assignment.validate();
        const saved = await this.groupRoleRepository.create(assignment);

        await this.cacheService.delByPattern(GroupCacheKeys.pattern());

        this.logger.log(`Role "${role.name}" assigned to group ${command.groupId}`);

        return new AssignRoleToGroupResult({
            id: saved.id,
            groupId: saved.groupId,
            roleId: saved.roleId,
            roleName: role.name,
        });
    }
}

// ─────────────────────────────────────────────────────────────
// RemoveRoleFromGroup
// ─────────────────────────────────────────────────────────────

export interface IRemoveRoleFromGroupCommand {
    groupId: string;
    roleId: string;
}

export class RemoveRoleFromGroupCommand {
    constructor(private readonly parameters: IRemoveRoleFromGroupCommand) {}
    get groupId(): string {
        return this.parameters.groupId;
    }
    get roleId(): string {
        return this.parameters.roleId;
    }
}

@CommandHandler(RemoveRoleFromGroupCommand)
export class RemoveRoleFromGroupHandler implements ICommandHandler<
    RemoveRoleFromGroupCommand,
    RemoveRoleFromUserResult
> {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly groupRoleRepository: IGroupRoleRepository,
        private readonly cacheService: ICacheService,
    ) {}

    async execute(command: RemoveRoleFromGroupCommand): Promise<RemoveRoleFromUserResult> {
        this.logger.log(`Removing role ${command.roleId} from group ${command.groupId}`);

        const assignment = await this.groupRoleRepository.findByGroupIdAndRoleId(command.groupId, command.roleId);
        if (!assignment) {
            throw new ApiError(HttpStatus.NOT_FOUND, 'Group does not have this role assigned');
        }

        await this.groupRoleRepository.delete(assignment.id);
        await this.cacheService.delByPattern(GroupCacheKeys.pattern());

        this.logger.log(`Role ${command.roleId} removed from group ${command.groupId}`);

        return new RemoveRoleFromUserResult({ message: 'Role removed from group successfully' });
    }
}

// ─────────────────────────────────────────────────────────────
// AssignGroupToUser
// ─────────────────────────────────────────────────────────────

export interface IAssignGroupToUserCommand {
    userId: string;
    groupId: string;
}

export class AssignGroupToUserCommand {
    constructor(private readonly parameters: IAssignGroupToUserCommand) {}
    get userId(): string {
        return this.parameters.userId;
    }
    get groupId(): string {
        return this.parameters.groupId;
    }
}

@CommandHandler(AssignGroupToUserCommand)
export class AssignGroupToUserHandler implements ICommandHandler<AssignGroupToUserCommand, AssignGroupToUserResult> {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly userRepository: IUserRepository,
        private readonly groupRepository: IGroupRepository,
        private readonly userGroupRepository: IUserGroupRepository,
        private readonly cacheService: ICacheService,
    ) {}

    async execute(command: AssignGroupToUserCommand): Promise<AssignGroupToUserResult> {
        this.logger.log(`Assigning group ${command.groupId} to user ${command.userId}`);

        try {
            await this.userRepository.findById(command.userId);
        } catch (error) {
            if (error instanceof RepositoryError) {
                throw new ApiError(HttpStatus.NOT_FOUND, `User with id "${command.userId}" not found`);
            }
            throw error;
        }

        let group;
        try {
            group = await this.groupRepository.findById(command.groupId);
        } catch (error) {
            if (error instanceof RepositoryError) {
                throw new ApiError(HttpStatus.NOT_FOUND, `Group with id "${command.groupId}" not found`);
            }
            throw error;
        }

        const existing = await this.userGroupRepository.findByUserIdAndGroupId(command.userId, command.groupId);
        if (existing) {
            throw new ApiError(HttpStatus.CONFLICT, `User already has group "${group.name}"`);
        }

        const assignment = new UserGroup({ userId: command.userId, groupId: command.groupId });
        assignment.validate();
        const saved = await this.userGroupRepository.create(assignment);

        await this.cacheService.del(UserRoleCacheKeys.byUser(command.userId));
        await this.cacheService.del(UserGroupCacheKeys.byUser(command.userId));

        this.logger.log(`Group "${group.name}" assigned to user ${command.userId}`);

        return new AssignGroupToUserResult({
            id: saved.id,
            userId: saved.userId,
            groupId: saved.groupId,
            groupName: group.name,
        });
    }
}

// ─────────────────────────────────────────────────────────────
// RemoveGroupFromUser
// ─────────────────────────────────────────────────────────────

export interface IRemoveGroupFromUserCommand {
    userId: string;
    groupId: string;
}

export class RemoveGroupFromUserCommand {
    constructor(private readonly parameters: IRemoveGroupFromUserCommand) {}
    get userId(): string {
        return this.parameters.userId;
    }
    get groupId(): string {
        return this.parameters.groupId;
    }
}

@CommandHandler(RemoveGroupFromUserCommand)
export class RemoveGroupFromUserHandler implements ICommandHandler<
    RemoveGroupFromUserCommand,
    RemoveRoleFromUserResult
> {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly userGroupRepository: IUserGroupRepository,
        private readonly cacheService: ICacheService,
    ) {}

    async execute(command: RemoveGroupFromUserCommand): Promise<RemoveRoleFromUserResult> {
        this.logger.log(`Removing group ${command.groupId} from user ${command.userId}`);

        const assignment = await this.userGroupRepository.findByUserIdAndGroupId(command.userId, command.groupId);
        if (!assignment) {
            throw new ApiError(HttpStatus.NOT_FOUND, 'User does not have this group assigned');
        }

        await this.userGroupRepository.delete(assignment.id);
        await this.cacheService.del(UserRoleCacheKeys.byUser(command.userId));
        await this.cacheService.del(UserGroupCacheKeys.byUser(command.userId));

        this.logger.log(`Group ${command.groupId} removed from user ${command.userId}`);

        return new RemoveRoleFromUserResult({ message: 'Group removed from user successfully' });
    }
}
