import { Inject, HttpStatus } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Logger } from 'nestjs-pino';

// Domain
import { ISftpUserRepository } from '@domain/ports/sftp-user-repository.port';
import { SftpUserResult, ListSftpUsersResult } from '@domain/results/sftp-user.result';
import { ApiError } from '@domain/errors/api.error';

// ─────────────────────────────────────────────────────────────
// ListSftpUsers
// ─────────────────────────────────────────────────────────────

export class ListSftpUsersQuery {}

@QueryHandler(ListSftpUsersQuery)
export class ListSftpUsersHandler implements IQueryHandler<ListSftpUsersQuery, ListSftpUsersResult> {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly sftpUserRepository: ISftpUserRepository,
    ) {}

    async execute(_query: ListSftpUsersQuery): Promise<ListSftpUsersResult> {
        this.logger.debug('Listing all SFTP users');
        _query;
        const users = await this.sftpUserRepository.findAll();
        const results = users.map((u) => new SftpUserResult(u));
        return new ListSftpUsersResult(results);
    }
}

// ─────────────────────────────────────────────────────────────
// GetSftpUserById
// ─────────────────────────────────────────────────────────────

export interface IGetSftpUserByIdQuery {
    id: string;
}

export class GetSftpUserByIdQuery {
    constructor(private readonly parameters: IGetSftpUserByIdQuery) {}

    get id(): string {
        return this.parameters.id;
    }
}

@QueryHandler(GetSftpUserByIdQuery)
export class GetSftpUserByIdHandler implements IQueryHandler<GetSftpUserByIdQuery, SftpUserResult> {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly sftpUserRepository: ISftpUserRepository,
    ) {}

    async execute(query: GetSftpUserByIdQuery): Promise<SftpUserResult> {
        this.logger.debug(`Getting SFTP user by id: ${query.id}`);

        const user = await this.sftpUserRepository.findById(query.id);
        if (!user) {
            throw new ApiError(HttpStatus.NOT_FOUND, `SFTP user not found: ${query.id}`);
        }

        return new SftpUserResult(user);
    }
}
