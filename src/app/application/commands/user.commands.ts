import { HttpStatus, Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Logger } from 'nestjs-pino';

// Domain
import { User, UserStatus } from '@domain/entities/user.entity';
import { IUserRepository } from '@domain/ports/user-repository.port';
import { INotificationService } from '@domain/ports/notification-service.port';
import { RegisterUserResult } from '@domain/results/register-user.result';
import { UpdateUserResult } from '@domain/results/update-user.result';
import { ApiError } from '@domain/errors/api.error';
import { RepositoryError } from '@domain/errors/repository.error';
import { ICacheService } from '@domain/ports/cache-service.port';
import { UserCacheKeys } from '@infrastructure/cache/cache-config.registry';

// ─────────────────────────────────────────────────────────────
// RegisterUser (llamado por AUTH-API con password hasheada)
// ─────────────────────────────────────────────────────────────

export interface IRegisterUserCommand {
    name: string;
    email: string;
    password: string;
}

export class RegisterUserCommand {
    constructor(private readonly parameters: IRegisterUserCommand) {}

    get name(): string {
        return this.parameters.name;
    }

    get email(): string {
        return this.parameters.email;
    }

    get password(): string {
        return this.parameters.password;
    }
}

@CommandHandler(RegisterUserCommand)
export class RegisterUserHandler implements ICommandHandler<RegisterUserCommand, RegisterUserResult> {
    constructor(
        @Inject(Logger)
        private readonly logger: Logger,
        private readonly userRepository: IUserRepository,
        private readonly notificationService: INotificationService,
        private readonly cacheService: ICacheService,
    ) {}

    async execute(command: RegisterUserCommand): Promise<RegisterUserResult> {
        this.logger.log(`Registering user: ${command.email}`);

        // 1. Build entity and validate invariants
        const user = new User({
            name: command.name,
            email: command.email,
            status: UserStatus.PENDING,
            welcomeEmailId: null,
            password: command.password,
        });
        user.validate();

        // 2. Check if user already exists
        const existingUser = await this.userRepository.findByEmail(user.email);
        if (existingUser) {
            throw new ApiError(HttpStatus.CONFLICT, `User with email ${user.email} already exists`);
        }

        // 3. Persist user
        const persistedUser = await this.userRepository.create(user);

        this.logger.log({ msg: 'User created', entity: 'Users', userId: persistedUser.id, email: command.email });

        // 4. Send welcome email via external service
        let welcomeEmailId: string;
        try {
            const emailResult = await this.notificationService.sendWelcomeEmail(
                persistedUser.email,
                persistedUser.name,
            );
            welcomeEmailId = emailResult.emailId;
            this.logger.log({
                msg: 'Welcome email sent',
                entity: 'Users',
                userId: persistedUser.id,
                emailId: welcomeEmailId,
            });
        } catch (error) {
            this.logger.error({
                msg: 'Failed to send welcome email',
                entity: 'Users',
                userId: persistedUser.id,
                error: String(error),
            });
            throw new ApiError(
                HttpStatus.INTERNAL_SERVER_ERROR,
                'User created but welcome email failed. Please retry.',
                error,
            );
        }

        // 5. Update user with email id and mark as active
        persistedUser.markAsActive(welcomeEmailId);
        const updatedUser = await this.userRepository.update(persistedUser);

        this.logger.log(`User ${updatedUser.id} registered successfully`);

        await this.cacheService.del(UserCacheKeys.list());

        return new RegisterUserResult({
            id: updatedUser.id,
            name: updatedUser.name,
            email: updatedUser.email,
            status: updatedUser.status,
            welcomeEmailId: updatedUser.welcomeEmailId!,
        });
    }
}

// ─────────────────────────────────────────────────────────────
// UpdateUser
// ─────────────────────────────────────────────────────────────

export interface IUpdateUserCommand {
    id: string;
    name?: string;
    email?: string;
    status?: UserStatus;
}

export class UpdateUserCommand {
    constructor(private readonly parameters: IUpdateUserCommand) {}

    get id(): string {
        return this.parameters.id;
    }

    get name(): string | undefined {
        return this.parameters.name;
    }

    get email(): string | undefined {
        return this.parameters.email;
    }

    get status(): UserStatus | undefined {
        return this.parameters.status;
    }
}

@CommandHandler(UpdateUserCommand)
export class UpdateUserHandler implements ICommandHandler<UpdateUserCommand, UpdateUserResult> {
    constructor(
        @Inject(Logger)
        private readonly logger: Logger,
        private readonly userRepository: IUserRepository,
        private readonly cacheService: ICacheService,
    ) {}

    async execute(command: UpdateUserCommand): Promise<UpdateUserResult> {
        this.logger.log(`Updating user: ${command.id}`);

        let user: User;
        try {
            user = await this.userRepository.findById(command.id);
        } catch (error) {
            if (error instanceof RepositoryError) {
                throw new ApiError(HttpStatus.NOT_FOUND, `User with id ${command.id} not found`);
            }
            throw error;
        }

        if (command.name !== undefined) {
            user.name = command.name;
        }
        if (command.email !== undefined) {
            const existingByEmail = await this.userRepository.findByEmail(command.email);
            if (existingByEmail && existingByEmail.id !== user.id) {
                throw new ApiError(HttpStatus.CONFLICT, `User with email ${command.email} already exists`);
            }
            user.email = command.email;
        }
        if (command.status !== undefined) {
            user.status = command.status;
        }

        user.validate();
        const updated = await this.userRepository.update(user);
        await this.cacheService.del(UserCacheKeys.byId(updated.id));
        await this.cacheService.del(UserCacheKeys.list());

        this.logger.log(`User ${updated.id} updated successfully`);

        return new UpdateUserResult({
            id: updated.id,
            name: updated.name,
            email: updated.email,
            status: updated.status,
            welcomeEmailId: updated.welcomeEmailId,
        });
    }
}

// ─────────────────────────────────────────────────────────────
// DeleteUser
// ─────────────────────────────────────────────────────────────

export interface IDeleteUserCommand {
    id: string;
}

export class DeleteUserCommand {
    constructor(private readonly parameters: IDeleteUserCommand) {}

    get id(): string {
        return this.parameters.id;
    }
}

@CommandHandler(DeleteUserCommand)
export class DeleteUserHandler implements ICommandHandler<DeleteUserCommand, void> {
    constructor(
        @Inject(Logger)
        private readonly logger: Logger,
        private readonly userRepository: IUserRepository,
        private readonly cacheService: ICacheService,
    ) {}

    async execute(command: DeleteUserCommand): Promise<void> {
        this.logger.log(`Deleting user: ${command.id}`);

        try {
            await this.userRepository.findById(command.id);
        } catch (error) {
            if (error instanceof RepositoryError) {
                throw new ApiError(HttpStatus.NOT_FOUND, `User with id ${command.id} not found`);
            }
            throw error;
        }

        await this.userRepository.delete(command.id);
        await this.cacheService.del(UserCacheKeys.byId(command.id));
        await this.cacheService.del(UserCacheKeys.list());
        this.logger.log(`User ${command.id} deleted successfully`);
    }
}

// ─────────────────────────────────────────────────────────────
// UpdateUserPassword
// ─────────────────────────────────────────────────────────────

export interface IUpdateUserPasswordCommand {
    id: string;
    password: string;
}

export class UpdateUserPasswordCommand {
    constructor(private readonly parameters: IUpdateUserPasswordCommand) {}

    get id(): string {
        return this.parameters.id;
    }

    get password(): string {
        return this.parameters.password;
    }
}

@CommandHandler(UpdateUserPasswordCommand)
export class UpdateUserPasswordHandler implements ICommandHandler<UpdateUserPasswordCommand, void> {
    constructor(
        @Inject(Logger)
        private readonly logger: Logger,
        private readonly userRepository: IUserRepository,
        private readonly cacheService: ICacheService,
    ) {}

    async execute(command: UpdateUserPasswordCommand): Promise<void> {
        this.logger.log(`Updating password for user: ${command.id}`);

        let user: User;
        try {
            user = await this.userRepository.findById(command.id);
        } catch (error) {
            if (error instanceof RepositoryError) {
                throw new ApiError(HttpStatus.NOT_FOUND, `User with id ${command.id} not found`);
            }
            throw error;
        }
        user.password = command.password;
        await this.userRepository.update(user);
        await this.cacheService.del(UserCacheKeys.byId(command.id));

        this.logger.log(`Password updated for user ${command.id}`);
    }
}
