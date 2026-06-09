import { HttpStatus, Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Logger } from 'nestjs-pino';

import { IGroupRepository } from '@domain/ports/group-repository.port';
import { IUserRepository } from '@domain/ports/user-repository.port';
import { IUserGroupRepository } from '@domain/ports/user-group-repository.port';
import { ListGroupsResult, GetUserGroupsResult } from '@domain/results/group.result';
import { ApiError } from '@domain/errors/api.error';
import { RepositoryError } from '@domain/errors/repository.error';

// ─────────────────────────────────────────────────────────────
// ListGroups
// ─────────────────────────────────────────────────────────────

export class ListGroupsQuery {}

@QueryHandler(ListGroupsQuery)
export class ListGroupsHandler implements IQueryHandler<ListGroupsQuery, ListGroupsResult> {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly groupRepository: IGroupRepository,
    ) {}

    async execute(): Promise<ListGroupsResult> {
        this.logger.debug('Listing all groups');
        const groups = await this.groupRepository.findAll();
        return new ListGroupsResult({
            groups: groups.map((g) => ({
                id: g.id,
                name: g.name,
                description: g.description,
                roles: (g.groupRoles ?? []).map((gr) => ({
                    id: gr.role.id,
                    name: gr.role.name,
                    description: gr.role.description,
                })),
            })),
        });
    }
}

// ─────────────────────────────────────────────────────────────
// GetUserGroups
// ─────────────────────────────────────────────────────────────

export interface IGetUserGroupsQuery {
    userId: string;
}

export class GetUserGroupsQuery {
    constructor(private readonly parameters: IGetUserGroupsQuery) {}
    get userId(): string {
        return this.parameters.userId;
    }
}

@QueryHandler(GetUserGroupsQuery)
export class GetUserGroupsHandler implements IQueryHandler<GetUserGroupsQuery, GetUserGroupsResult> {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly userRepository: IUserRepository,
        private readonly userGroupRepository: IUserGroupRepository,
    ) {}

    async execute(query: GetUserGroupsQuery): Promise<GetUserGroupsResult> {
        this.logger.debug(`Getting groups for user ${query.userId}`);

        try {
            await this.userRepository.findById(query.userId);
        } catch (error) {
            if (error instanceof RepositoryError) {
                throw new ApiError(HttpStatus.NOT_FOUND, `User with id "${query.userId}" not found`);
            }
            throw error;
        }

        const userGroups = await this.userGroupRepository.findByUserId(query.userId);

        return new GetUserGroupsResult({
            groups: userGroups.map((ug) => ({
                id: ug.group.id,
                name: ug.group.name,
                description: ug.group.description,
            })),
        });
    }
}
