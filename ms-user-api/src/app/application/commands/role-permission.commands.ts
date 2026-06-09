import { HttpStatus, Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Logger } from 'nestjs-pino';

import { IRoleRepository } from '@domain/ports/role-repository.port';
import { IRolePermissionRepository } from '@domain/ports/role-permission-repository.port';
import { ICacheService } from '@domain/ports/cache-service.port';
import { SyncRolePermissionsResult } from '@domain/results/role-permission.result';
import { ApiError } from '@domain/errors/api.error';
import { RepositoryError } from '@domain/errors/repository.error';
import { PermissionCacheKeys } from '@infrastructure/cache/cache-config.registry';

// ─────────────────────────────────────────────────────────────
// SyncRolePermissions
// ─────────────────────────────────────────────────────────────

export interface ISyncRolePermissionsCommand {
    roleId: string;
    permissionIds: string[];
}

export class SyncRolePermissionsCommand {
    constructor(private readonly parameters: ISyncRolePermissionsCommand) {}
    get roleId(): string {
        return this.parameters.roleId;
    }
    get permissionIds(): string[] {
        return this.parameters.permissionIds;
    }
}

@CommandHandler(SyncRolePermissionsCommand)
export class SyncRolePermissionsHandler implements ICommandHandler<
    SyncRolePermissionsCommand,
    SyncRolePermissionsResult
> {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly roleRepository: IRoleRepository,
        private readonly rolePermissionRepository: IRolePermissionRepository,
        private readonly cacheService: ICacheService,
    ) {}

    async execute(command: SyncRolePermissionsCommand): Promise<SyncRolePermissionsResult> {
        this.logger.log(`Syncing ${command.permissionIds.length} permissions for role ${command.roleId}`);

        let role;
        try {
            role = await this.roleRepository.findById(command.roleId);
        } catch (error) {
            if (error instanceof RepositoryError) {
                throw new ApiError(HttpStatus.NOT_FOUND, `Role with id "${command.roleId}" not found`);
            }
            throw error;
        }

        const saved = await this.rolePermissionRepository.syncForRole(command.roleId, command.permissionIds);

        // Invalidate ms-user-api read cache for this role
        await this.cacheService.del(PermissionCacheKeys.byRoleId(command.roleId));
        // Invalidate gateway permission cache for this role by name
        await this.cacheService.del(PermissionCacheKeys.byRoleName(role.name));

        this.logger.log(`Synced ${saved.length} permissions for role "${role.name}"`);
        return new SyncRolePermissionsResult({ roleId: command.roleId, count: saved.length });
    }
}
