import { HttpStatus, Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Logger } from 'nestjs-pino';

import { IRoleRepository } from '@domain/ports/role-repository.port';
import { IRolePermissionRepository } from '@domain/ports/role-permission-repository.port';
import { GetRolePermissionsResult, GetBulkPermissionsResult } from '@domain/results/role-permission.result';
import { ApiError } from '@domain/errors/api.error';
import { RepositoryError } from '@domain/errors/repository.error';

// ─────────────────────────────────────────────────────────────
// GetRolePermissions
// ─────────────────────────────────────────────────────────────

export class GetRolePermissionsQuery {
    constructor(private readonly parameters: { roleId: string }) {}
    get roleId(): string {
        return this.parameters.roleId;
    }
}

@QueryHandler(GetRolePermissionsQuery)
export class GetRolePermissionsHandler implements IQueryHandler<GetRolePermissionsQuery, GetRolePermissionsResult> {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly roleRepository: IRoleRepository,
        private readonly rolePermissionRepository: IRolePermissionRepository,
    ) {}

    async execute(query: GetRolePermissionsQuery): Promise<GetRolePermissionsResult> {
        this.logger.debug(`Getting permissions for role ${query.roleId}`);

        try {
            await this.roleRepository.findById(query.roleId);
        } catch (error) {
            if (error instanceof RepositoryError) {
                throw new ApiError(HttpStatus.NOT_FOUND, `Role with id "${query.roleId}" not found`);
            }
            throw error;
        }

        const rolePermissions = await this.rolePermissionRepository.findByRoleId(query.roleId);

        return new GetRolePermissionsResult({
            roleId: query.roleId,
            permissions: rolePermissions.map((rp) => ({
                id: rp.permission.id,
                method: rp.permission.method,
                path: rp.permission.path,
            })),
        });
    }
}

// ─────────────────────────────────────────────────────────────
// GetBulkPermissions (used by gateway on cache miss)
// ─────────────────────────────────────────────────────────────

export class GetBulkPermissionsQuery {
    constructor(private readonly parameters: { roleNames: string[] }) {}
    get roleNames(): string[] {
        return this.parameters.roleNames;
    }
}

@QueryHandler(GetBulkPermissionsQuery)
export class GetBulkPermissionsHandler implements IQueryHandler<GetBulkPermissionsQuery, GetBulkPermissionsResult> {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly rolePermissionRepository: IRolePermissionRepository,
    ) {}

    async execute(query: GetBulkPermissionsQuery): Promise<GetBulkPermissionsResult> {
        this.logger.debug(`Getting bulk permissions for roles: ${query.roleNames.join(', ')}`);

        const rolePermissions = await this.rolePermissionRepository.findByRoleNames(query.roleNames);

        // Deduplicate method+path combinations via Permission entity
        const seen = new Set<string>();
        const unique = rolePermissions
            .filter((rp) => {
                const key = `${rp.permission.method}:${rp.permission.path}`;
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            })
            .map((rp) => ({ method: rp.permission.method, path: rp.permission.path }));

        return new GetBulkPermissionsResult({ permissions: unique });
    }
}
