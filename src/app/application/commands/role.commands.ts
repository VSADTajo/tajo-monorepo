import { HttpStatus, Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Logger } from 'nestjs-pino';

// Domain
import { Role } from '@domain/entities/role.entity';
import { UserRole } from '@domain/entities/user-role.entity';
import { IUserRepository } from '@domain/ports/user-repository.port';
import { IRoleRepository } from '@domain/ports/role-repository.port';
import { IUserRoleRepository } from '@domain/ports/user-role-repository.port';
import { IGroupRoleRepository } from '@domain/ports/group-role-repository.port';
import { CreateRoleResult } from '@domain/results/create-role.result';
import { AssignRoleResult } from '@domain/results/assign-role.result';
import { RemoveRoleFromUserResult } from '@domain/results/remove-role-from-user.result';
import { ApiError } from '@domain/errors/api.error';
import { RepositoryError } from '@domain/errors/repository.error';
import { ICacheService } from '@domain/ports/cache-service.port';
import { RoleCacheKeys, UserRoleCacheKeys, PermissionCacheKeys } from '@infrastructure/cache/cache-config.registry';

// ─────────────────────────────────────────────────────────────
// CreateRole
// ─────────────────────────────────────────────────────────────

export interface ICreateRoleCommand {
    name: string;
    description?: string;
}

export class CreateRoleCommand {
    constructor(private readonly parameters: ICreateRoleCommand) {}

    get name(): string {
        return this.parameters.name;
    }

    get description(): string | undefined {
        return this.parameters.description;
    }
}

@CommandHandler(CreateRoleCommand)
export class CreateRoleHandler implements ICommandHandler<CreateRoleCommand, CreateRoleResult> {
    constructor(
        @Inject(Logger)
        private readonly logger: Logger,
        private readonly roleRepository: IRoleRepository,
        private readonly cacheService: ICacheService,
    ) {}

    async execute(command: CreateRoleCommand): Promise<CreateRoleResult> {
        this.logger.log(`Creating role: ${command.name}`);

        // 1. Build entity and validate invariants
        const role = new Role({
            name: command.name,
            description: command.description ?? null,
        });
        role.validate();

        // 2. Check if role already exists (case-insensitive via normalized name)
        const existingRole = await this.roleRepository.findByName(role.name);
        if (existingRole) {
            throw new ApiError(HttpStatus.CONFLICT, `Role with name "${role.name}" already exists`);
        }

        // 3. Persist role
        const persistedRole = await this.roleRepository.create(role);

        this.logger.log(`Role created with id: ${persistedRole.id}`);

        await this.cacheService.delByPattern(RoleCacheKeys.pattern());

        return new CreateRoleResult({
            id: persistedRole.id,
            name: persistedRole.name,
            description: persistedRole.description,
        });
    }
}

// ─────────────────────────────────────────────────────────────
// DeleteRole
// ─────────────────────────────────────────────────────────────

export interface IDeleteRoleCommand {
    roleId: string;
}

export class DeleteRoleCommand {
    constructor(private readonly parameters: IDeleteRoleCommand) {}
    get roleId(): string {
        return this.parameters.roleId;
    }
}

@CommandHandler(DeleteRoleCommand)
export class DeleteRoleHandler implements ICommandHandler<DeleteRoleCommand, void> {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly roleRepository: IRoleRepository,
        private readonly userRoleRepository: IUserRoleRepository,
        private readonly groupRoleRepository: IGroupRoleRepository,
        private readonly cacheService: ICacheService,
    ) {}

    async execute(command: DeleteRoleCommand): Promise<void> {
        this.logger.log(`Deleting role: ${command.roleId}`);

        let role;
        try {
            role = await this.roleRepository.findById(command.roleId);
        } catch (error) {
            if (error instanceof RepositoryError) {
                throw new ApiError(HttpStatus.NOT_FOUND, `Role with id "${command.roleId}" not found`);
            }
            throw error;
        }

        // 1. Remove all user-role and group-role assignments (onDelete: RESTRICT requires manual cleanup)
        await this.userRoleRepository.deleteByRoleId(command.roleId);
        await this.groupRoleRepository.deleteByRoleId(command.roleId);

        // 2. Delete the role itself
        await this.roleRepository.delete(command.roleId);

        // 3. Invalidate caches
        await this.cacheService.delByPattern(RoleCacheKeys.pattern());
        await this.cacheService.del(PermissionCacheKeys.byRoleId(command.roleId));
        await this.cacheService.del(PermissionCacheKeys.byRoleName(role.name));

        this.logger.log(`Role "${role.name}" deleted`);
    }
}

// ─────────────────────────────────────────────────────────────
// AssignRoleToUser
// ─────────────────────────────────────────────────────────────

export interface IAssignRoleToUserCommand {
    userId: string;
    roleId: string;
}

export class AssignRoleToUserCommand {
    constructor(private readonly parameters: IAssignRoleToUserCommand) {}

    get userId(): string {
        return this.parameters.userId;
    }

    get roleId(): string {
        return this.parameters.roleId;
    }
}

@CommandHandler(AssignRoleToUserCommand)
export class AssignRoleToUserHandler implements ICommandHandler<AssignRoleToUserCommand, AssignRoleResult> {
    constructor(
        @Inject(Logger)
        private readonly logger: Logger,
        private readonly userRepository: IUserRepository,
        private readonly roleRepository: IRoleRepository,
        private readonly userRoleRepository: IUserRoleRepository,
        private readonly cacheService: ICacheService,
    ) {}

    async execute(command: AssignRoleToUserCommand): Promise<AssignRoleResult> {
        this.logger.log(`Assigning role ${command.roleId} to user ${command.userId}`);

        // 1. Verify user exists
        try {
            await this.userRepository.findById(command.userId);
        } catch (error) {
            if (error instanceof RepositoryError) {
                throw new ApiError(HttpStatus.NOT_FOUND, `User with id "${command.userId}" not found`);
            }
            throw error;
        }

        // 2. Verify role exists
        let role;
        try {
            role = await this.roleRepository.findById(command.roleId);
        } catch (error) {
            if (error instanceof RepositoryError) {
                throw new ApiError(HttpStatus.NOT_FOUND, `Role with id "${command.roleId}" not found`);
            }
            throw error;
        }

        // 3. Check for duplicate assignment
        const existingAssignment = await this.userRoleRepository.findByUserIdAndRoleId(command.userId, command.roleId);
        if (existingAssignment) {
            throw new ApiError(HttpStatus.CONFLICT, `User "${command.userId}" already has role "${role.name}"`);
        }

        // 4. Create user-role assignment
        const assignment = new UserRole({
            userId: command.userId,
            roleId: command.roleId,
        });
        assignment.validate();
        const userRole = await this.userRoleRepository.create(assignment);

        this.logger.log(`Role "${role.name}" assigned to user ${command.userId} (assignment id: ${userRole.id})`);

        await this.cacheService.del(UserRoleCacheKeys.byUser(command.userId));

        return new AssignRoleResult({
            id: userRole.id,
            userId: userRole.userId,
            roleId: userRole.roleId,
            roleName: role.name,
        });
    }
}

// ─────────────────────────────────────────────────────────────
// RemoveRoleFromUser
// ─────────────────────────────────────────────────────────────

export interface IRemoveRoleFromUserCommand {
    userId: string;
    roleId: string;
}

export class RemoveRoleFromUserCommand {
    constructor(private readonly parameters: IRemoveRoleFromUserCommand) {}

    get userId(): string {
        return this.parameters.userId;
    }

    get roleId(): string {
        return this.parameters.roleId;
    }
}

@CommandHandler(RemoveRoleFromUserCommand)
export class RemoveRoleFromUserHandler implements ICommandHandler<RemoveRoleFromUserCommand, RemoveRoleFromUserResult> {
    constructor(
        @Inject(Logger)
        private readonly logger: Logger,
        private readonly userRepository: IUserRepository,
        private readonly roleRepository: IRoleRepository,
        private readonly userRoleRepository: IUserRoleRepository,
        private readonly cacheService: ICacheService,
    ) {}

    async execute(command: RemoveRoleFromUserCommand): Promise<RemoveRoleFromUserResult> {
        this.logger.log(`Removing role ${command.roleId} from user ${command.userId}`);

        // 1. Verify user exists
        try {
            await this.userRepository.findById(command.userId);
        } catch (error) {
            if (error instanceof RepositoryError) {
                throw new ApiError(HttpStatus.NOT_FOUND, `User with id "${command.userId}" not found`);
            }
            throw error;
        }

        // 2. Verify role exists
        try {
            await this.roleRepository.findById(command.roleId);
        } catch (error) {
            if (error instanceof RepositoryError) {
                throw new ApiError(HttpStatus.NOT_FOUND, `Role with id "${command.roleId}" not found`);
            }
            throw error;
        }

        // 3. Find the assignment
        const assignment = await this.userRoleRepository.findByUserIdAndRoleId(command.userId, command.roleId);
        if (!assignment) {
            throw new ApiError(
                HttpStatus.NOT_FOUND,
                `User "${command.userId}" does not have role "${command.roleId}" assigned`,
            );
        }

        // 4. Delete the assignment
        await this.userRoleRepository.delete(assignment.id);

        this.logger.log(`Role ${command.roleId} removed from user ${command.userId}`);

        await this.cacheService.del(UserRoleCacheKeys.byUser(command.userId));

        return new RemoveRoleFromUserResult({ message: 'Role removed from user successfully' });
    }
}
