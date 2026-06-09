import { HttpStatus, Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Logger } from 'nestjs-pino';

// Domain
import { IUserRepository } from '@domain/ports/user-repository.port';
import { IRoleRepository } from '@domain/ports/role-repository.port';
import { IUserRoleRepository } from '@domain/ports/user-role-repository.port';
import { User } from '@domain/entities/user.entity';
import { GetUserByEmailResult } from '@domain/results/get-user-by-email.result';
import { ListUsersResult } from '@domain/results/list-users.result';
import { ApiError } from '@domain/errors/api.error';
import { RepositoryError } from '@domain/errors/repository.error';

// ─────────────────────────────────────────────────────────────
// ListUsers
// ─────────────────────────────────────────────────────────────

export class ListUsersQuery {}

@QueryHandler(ListUsersQuery)
export class ListUsersHandler implements IQueryHandler<ListUsersQuery, ListUsersResult> {
    constructor(
        @Inject(Logger)
        private readonly logger: Logger,
        private readonly userRepository: IUserRepository,
    ) {}

    async execute(): Promise<ListUsersResult> {
        this.logger.debug('Listing all users');

        const users = await this.userRepository.findAll();

        return new ListUsersResult(
            users.map((user) => ({
                id: user.id,
                name: user.name,
                email: user.email,
                status: user.status,
            })),
        );
    }
}

// ─────────────────────────────────────────────────────────────
// GetUserByEmail (una sola llamada para AUTH-API: id, password, roles, status)
// ─────────────────────────────────────────────────────────────

export class GetUserByEmailQuery {
    constructor(public readonly email: string) {}
}

@QueryHandler(GetUserByEmailQuery)
export class GetUserByEmailHandler implements IQueryHandler<GetUserByEmailQuery, GetUserByEmailResult> {
    constructor(
        @Inject(Logger)
        private readonly logger: Logger,
        private readonly userRepository: IUserRepository,
        private readonly userRoleRepository: IUserRoleRepository,
        private readonly roleRepository: IRoleRepository,
    ) {}

    async execute(query: GetUserByEmailQuery): Promise<GetUserByEmailResult> {
        this.logger.debug(`Getting user by email (AUTH-API): ${query.email}`);

        const user = await this.userRepository.findByEmail(query.email);
        if (!user) {
            throw new ApiError(HttpStatus.NOT_FOUND, `User with email "${query.email}" not found`);
        }

        const userRoles = await this.userRoleRepository.findByUserId(user.id);
        const roles = await Promise.all(
            userRoles.map(async (ur) => {
                const role = await this.roleRepository.findById(ur.roleId);
                return {
                    id: role.id,
                    name: role.name,
                    description: role.description,
                };
            }),
        );

        return new GetUserByEmailResult({
            id: user.id,
            password: user.password,
            roles,
            status: user.status,
        });
    }
}

// ─────────────────────────────────────────────────────────────
// GetUserById
// ─────────────────────────────────────────────────────────────

export class GetUserByIdQuery {
    constructor(public readonly id: string) {}
}

@QueryHandler(GetUserByIdQuery)
export class GetUserByIdHandler implements IQueryHandler<GetUserByIdQuery, User> {
    constructor(
        @Inject(Logger)
        private readonly logger: Logger,
        private readonly userRepository: IUserRepository,
    ) {}

    async execute(query: GetUserByIdQuery): Promise<User> {
        this.logger.debug(`Executing get user by id query: ${query.id}`);
        try {
            return await this.userRepository.findById(query.id);
        } catch (error) {
            if (error instanceof RepositoryError) {
                throw new ApiError(HttpStatus.NOT_FOUND, `User with id ${query.id} not found`);
            }
            throw error;
        }
    }
}
