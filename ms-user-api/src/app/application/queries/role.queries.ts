import { HttpStatus, Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Logger } from 'nestjs-pino';

// Domain
import { IUserRepository } from '@domain/ports/user-repository.port';
import { IRoleRepository } from '@domain/ports/role-repository.port';
import { IUserRoleRepository } from '@domain/ports/user-role-repository.port';
import { IUserGroupRepository } from '@domain/ports/user-group-repository.port';
import { IGroupRoleRepository } from '@domain/ports/group-role-repository.port';
import { ListRolesResult } from '@domain/results/list-roles.result';
import { GetUserRolesResult } from '@domain/results/get-user-roles.result';
import { ApiError } from '@domain/errors/api.error';
import { RepositoryError } from '@domain/errors/repository.error';

// ─────────────────────────────────────────────────────────────
// ListRoles
// ─────────────────────────────────────────────────────────────

export class ListRolesQuery {}

@QueryHandler(ListRolesQuery)
export class ListRolesHandler implements IQueryHandler<ListRolesQuery, ListRolesResult> {
    constructor(
        @Inject(Logger)
        private readonly logger: Logger,
        private readonly roleRepository: IRoleRepository,
    ) {}

    async execute(): Promise<ListRolesResult> {
        this.logger.debug('Listing all roles');

        const roles = await this.roleRepository.findAll();

        return new ListRolesResult(
            roles.map((role) => ({
                id: role.id,
                name: role.name,
                description: role.description,
            })),
        );
    }
}

// ─────────────────────────────────────────────────────────────
// GetUserRoles
// ─────────────────────────────────────────────────────────────

export interface IGetUserRolesQuery {
    userId: string;
}

export class GetUserRolesQuery {
    constructor(private readonly parameters: IGetUserRolesQuery) {}

    get userId(): string {
        return this.parameters.userId;
    }
}

@QueryHandler(GetUserRolesQuery)
export class GetUserRolesHandler implements IQueryHandler<GetUserRolesQuery, GetUserRolesResult> {
    constructor(
        @Inject(Logger)
        private readonly logger: Logger,
        private readonly userRepository: IUserRepository,
        private readonly roleRepository: IRoleRepository,
        private readonly userRoleRepository: IUserRoleRepository,
        private readonly userGroupRepository: IUserGroupRepository,
        private readonly groupRoleRepository: IGroupRoleRepository,
    ) {}

    async execute(query: GetUserRolesQuery): Promise<GetUserRolesResult> {
        this.logger.debug(`Getting roles for user ${query.userId}`);

        // 1. Verify user exists
        try {
            await this.userRepository.findById(query.userId);
        } catch (error) {
            if (error instanceof RepositoryError) {
                throw new ApiError(HttpStatus.NOT_FOUND, `User with id "${query.userId}" not found`);
            }
            throw error;
        }

        // 2. Get direct role assignments
        const userRoles = await this.userRoleRepository.findByUserId(query.userId);
        const roleIds = new Set(userRoles.map((ur) => ur.roleId));

        // 3. Get roles from user's groups
        const userGroups = await this.userGroupRepository.findByUserId(query.userId);
        for (const ug of userGroups) {
            const groupRoles = await this.groupRoleRepository.findByGroupId(ug.groupId);
            for (const gr of groupRoles) {
                roleIds.add(gr.roleId);
            }
        }

        // 4. Load role details (deduplicated)
        const roles = await Promise.all(
            [...roleIds].map(async (roleId) => {
                const role = await this.roleRepository.findById(roleId);
                return {
                    id: role.id,
                    name: role.name,
                    description: role.description,
                };
            }),
        );

        return new GetUserRolesResult({ roles });
    }
}
