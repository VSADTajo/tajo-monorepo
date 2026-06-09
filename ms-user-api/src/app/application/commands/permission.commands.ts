import { HttpStatus, Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Logger } from 'nestjs-pino';

import { IPermissionRepository } from '@domain/ports/permission-repository.port';
import { IRolePermissionRepository } from '@domain/ports/role-permission-repository.port';
import { ICacheService } from '@domain/ports/cache-service.port';
import { Permission } from '@domain/entities/permission.entity';
import { CreatePermissionResult, SyncPermissionsResult } from '@domain/results/permission.result';
import { ApiError } from '@domain/errors/api.error';
import { RepositoryError } from '@domain/errors/repository.error';
import { PermissionCacheKeys } from '@infrastructure/cache/cache-config.registry';

// ─────────────────────────────────────────────────────────────
// CreatePermission
// ─────────────────────────────────────────────────────────────

export interface ICreatePermissionCommand {
    name?: string;
    method: string;
    path: string;
}

export class CreatePermissionCommand {
    constructor(private readonly parameters: ICreatePermissionCommand) {}
    get name(): string | undefined {
        return this.parameters.name;
    }
    get method(): string {
        return this.parameters.method;
    }
    get path(): string {
        return this.parameters.path;
    }
}

@CommandHandler(CreatePermissionCommand)
export class CreatePermissionHandler implements ICommandHandler<CreatePermissionCommand, CreatePermissionResult> {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly permissionRepository: IPermissionRepository,
        private readonly cacheService: ICacheService,
    ) {}

    async execute(command: CreatePermissionCommand): Promise<CreatePermissionResult> {
        this.logger.log(`Creating permission: ${command.method} ${command.path}`);

        const permission = new Permission({
            name: command.name ?? null,
            method: command.method,
            path: command.path,
        });
        permission.validate();

        const existing = await this.permissionRepository.findByMethodAndPath(permission.method, permission.path);
        if (existing) {
            throw new ApiError(
                HttpStatus.CONFLICT,
                `Permission "${permission.method} ${permission.path}" already exists`,
            );
        }

        const persisted = await this.permissionRepository.create(permission);
        this.logger.log(`Permission created with id: ${persisted.id}`);

        await this.cacheService.delByPattern(PermissionCacheKeys.pattern());

        return new CreatePermissionResult({
            id: persisted.id,
            name: persisted.name,
            method: persisted.method,
            path: persisted.path,
        });
    }
}

// ─────────────────────────────────────────────────────────────
// DeletePermission
// ─────────────────────────────────────────────────────────────

export interface IDeletePermissionCommand {
    permissionId: string;
}

export class DeletePermissionCommand {
    constructor(private readonly parameters: IDeletePermissionCommand) {}
    get permissionId(): string {
        return this.parameters.permissionId;
    }
}

@CommandHandler(DeletePermissionCommand)
export class DeletePermissionHandler implements ICommandHandler<DeletePermissionCommand, void> {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly permissionRepository: IPermissionRepository,
        private readonly rolePermissionRepository: IRolePermissionRepository,
        private readonly cacheService: ICacheService,
    ) {}

    async execute(command: DeletePermissionCommand): Promise<void> {
        this.logger.log(`Deleting permission: ${command.permissionId}`);

        try {
            await this.permissionRepository.findById(command.permissionId);
        } catch (error) {
            if (error instanceof RepositoryError) {
                throw new ApiError(HttpStatus.NOT_FOUND, `Permission with id "${command.permissionId}" not found`);
            }
            throw error;
        }

        const hasAssignments = await this.rolePermissionRepository.hasAssignments(command.permissionId);
        if (hasAssignments) {
            throw new ApiError(
                HttpStatus.CONFLICT,
                'Cannot delete permission that is assigned to roles. Remove it from all roles first.',
            );
        }

        await this.permissionRepository.delete(command.permissionId);
        await this.cacheService.delByPattern(PermissionCacheKeys.pattern());

        this.logger.log(`Permission ${command.permissionId} deleted`);
    }
}

// ─────────────────────────────────────────────────────────────
// SyncPermissions (upsert from gateway routes)
// ─────────────────────────────────────────────────────────────

export interface ISyncPermissionsCommand {
    routes: Array<{ method: string; path: string; name: string | null; tag: string | null }>;
}

export class SyncPermissionsCommand {
    constructor(private readonly parameters: ISyncPermissionsCommand) {}
    get routes(): ISyncPermissionsCommand['routes'] {
        return this.parameters.routes;
    }
}

@CommandHandler(SyncPermissionsCommand)
export class SyncPermissionsHandler implements ICommandHandler<SyncPermissionsCommand, SyncPermissionsResult> {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly permissionRepository: IPermissionRepository,
        private readonly cacheService: ICacheService,
    ) {}

    async execute(command: SyncPermissionsCommand): Promise<SyncPermissionsResult> {
        this.logger.log(`Syncing ${command.routes.length} permissions from gateway`);

        const permissions = await this.permissionRepository.upsertMany(command.routes);

        await this.cacheService.delByPattern(PermissionCacheKeys.pattern());

        this.logger.log(`Synced ${permissions.length} permissions`);
        return new SyncPermissionsResult({
            permissions: permissions.map((p) => ({
                id: p.id,
                name: p.name,
                method: p.method,
                path: p.path,
                tag: p.tag,
            })),
        });
    }
}
