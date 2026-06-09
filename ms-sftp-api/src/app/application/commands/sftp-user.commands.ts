import { Inject, HttpStatus } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Logger } from 'nestjs-pino';
import * as bcrypt from 'bcryptjs';

// Domain
import { ISftpUserRepository } from '@domain/ports/sftp-user-repository.port';
import { ICacheService } from '@domain/ports/cache-service.port';
import { SftpUser } from '@domain/entities/sftp-user.entity';
import { SftpUserResult, DeleteSftpUserResult } from '@domain/results/sftp-user.result';
import { ApiError } from '@domain/errors/api.error';

// Cache
import { SftpUserCacheKeys } from '@infrastructure/cache/cache-config.registry';

// ─────────────────────────────────────────────────────────────
// CreateSftpUser
// ─────────────────────────────────────────────────────────────

export interface ICreateSftpUserCommand {
    username: string;
    password: string;
    rootDirectory: string;
}

export class CreateSftpUserCommand {
    constructor(private readonly parameters: ICreateSftpUserCommand) {}

    get username(): string {
        return this.parameters.username;
    }

    get password(): string {
        return this.parameters.password;
    }

    get rootDirectory(): string {
        return this.parameters.rootDirectory;
    }
}

@CommandHandler(CreateSftpUserCommand)
export class CreateSftpUserHandler implements ICommandHandler<CreateSftpUserCommand, SftpUserResult> {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly sftpUserRepository: ISftpUserRepository,
        private readonly cacheService: ICacheService,
    ) {}

    async execute(command: CreateSftpUserCommand): Promise<SftpUserResult> {
        this.logger.log(`Creating SFTP user: ${command.username}`);

        const user = new SftpUser({
            username: command.username,
            password: command.password,
            rootDirectory: command.rootDirectory,
            isActive: true,
        });
        user.validate();

        const existing = await this.sftpUserRepository.findByUsername(user.username);
        if (existing) {
            throw new ApiError(HttpStatus.CONFLICT, `An SFTP user already exists with username: ${user.username}`);
        }

        user.password = await bcrypt.hash(command.password, 10);

        const persisted = await this.sftpUserRepository.create(user);

        await this.cacheService.del(SftpUserCacheKeys.list());
        await this.cacheService.delByPattern(SftpUserCacheKeys.pattern());

        return new SftpUserResult(persisted);
    }
}

// ─────────────────────────────────────────────────────────────
// UpdateSftpUser
// ─────────────────────────────────────────────────────────────

export interface IUpdateSftpUserCommand {
    id: string;
    password?: string;
    rootDirectory?: string;
}

export class UpdateSftpUserCommand {
    constructor(private readonly parameters: IUpdateSftpUserCommand) {}

    get id(): string {
        return this.parameters.id;
    }

    get password(): string | undefined {
        return this.parameters.password;
    }

    get rootDirectory(): string | undefined {
        return this.parameters.rootDirectory;
    }
}

@CommandHandler(UpdateSftpUserCommand)
export class UpdateSftpUserHandler implements ICommandHandler<UpdateSftpUserCommand, SftpUserResult> {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly sftpUserRepository: ISftpUserRepository,
        private readonly cacheService: ICacheService,
    ) {}

    async execute(command: UpdateSftpUserCommand): Promise<SftpUserResult> {
        this.logger.log(`Updating SFTP user: ${command.id}`);

        const user = await this.sftpUserRepository.findById(command.id);
        if (!user) {
            throw new ApiError(HttpStatus.NOT_FOUND, `SFTP user not found: ${command.id}`);
        }

        if (command.password !== undefined) {
            user.password = await bcrypt.hash(command.password, 10);
        }
        if (command.rootDirectory !== undefined) {
            user.rootDirectory = command.rootDirectory;
        }

        user.validate();

        const updated = await this.sftpUserRepository.update(user);

        await this.cacheService.del(SftpUserCacheKeys.list());
        await this.cacheService.del(SftpUserCacheKeys.byId(command.id));
        await this.cacheService.delByPattern(SftpUserCacheKeys.pattern());

        return new SftpUserResult(updated);
    }
}

// ─────────────────────────────────────────────────────────────
// DeleteSftpUser
// ─────────────────────────────────────────────────────────────

export interface IDeleteSftpUserCommand {
    id: string;
}

export class DeleteSftpUserCommand {
    constructor(private readonly parameters: IDeleteSftpUserCommand) {}

    get id(): string {
        return this.parameters.id;
    }
}

@CommandHandler(DeleteSftpUserCommand)
export class DeleteSftpUserHandler implements ICommandHandler<DeleteSftpUserCommand, DeleteSftpUserResult> {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly sftpUserRepository: ISftpUserRepository,
        private readonly cacheService: ICacheService,
    ) {}

    async execute(command: DeleteSftpUserCommand): Promise<DeleteSftpUserResult> {
        this.logger.log(`Deleting SFTP user: ${command.id}`);

        const user = await this.sftpUserRepository.findById(command.id);
        if (!user) {
            throw new ApiError(HttpStatus.NOT_FOUND, `SFTP user not found: ${command.id}`);
        }

        await this.sftpUserRepository.delete(command.id);

        await this.cacheService.del(SftpUserCacheKeys.list());
        await this.cacheService.del(SftpUserCacheKeys.byId(command.id));
        await this.cacheService.delByPattern(SftpUserCacheKeys.pattern());

        return new DeleteSftpUserResult({
            deletedId: user.id,
            username: user.username,
        });
    }
}

// ─────────────────────────────────────────────────────────────
// ToggleSftpUser
// ─────────────────────────────────────────────────────────────

export interface IToggleSftpUserCommand {
    id: string;
    isActive: boolean;
}

export class ToggleSftpUserCommand {
    constructor(private readonly parameters: IToggleSftpUserCommand) {}

    get id(): string {
        return this.parameters.id;
    }

    get isActive(): boolean {
        return this.parameters.isActive;
    }
}

@CommandHandler(ToggleSftpUserCommand)
export class ToggleSftpUserHandler implements ICommandHandler<ToggleSftpUserCommand, SftpUserResult> {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly sftpUserRepository: ISftpUserRepository,
        private readonly cacheService: ICacheService,
    ) {}

    async execute(command: ToggleSftpUserCommand): Promise<SftpUserResult> {
        this.logger.log(`Toggling SFTP user ${command.id} to isActive=${command.isActive}`);

        const user = await this.sftpUserRepository.findById(command.id);
        if (!user) {
            throw new ApiError(HttpStatus.NOT_FOUND, `SFTP user not found: ${command.id}`);
        }

        user.isActive = command.isActive;
        const updated = await this.sftpUserRepository.update(user);

        await this.cacheService.del(SftpUserCacheKeys.list());
        await this.cacheService.del(SftpUserCacheKeys.byId(command.id));
        await this.cacheService.delByPattern(SftpUserCacheKeys.pattern());

        return new SftpUserResult(updated);
    }
}
