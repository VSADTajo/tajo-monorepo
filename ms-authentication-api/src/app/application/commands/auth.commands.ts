import { HttpStatus, Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { Logger } from 'nestjs-pino';
import * as bcrypt from 'bcrypt';
import { createHash, randomUUID } from 'crypto';

// Domain
import { ICacheService } from '@domain/ports/cache-service.port';
import { IUserApiClient } from '@domain/ports/user-api-client.port';
import { ChangePasswordResult } from '@domain/results/change-password.result';
import { LoginUserResult } from '@domain/results/login-user.result';
import { LogoutUserResult } from '@domain/results/logout-user.result';
import { RegisterUserResult } from '@domain/results/register-user.result';
import { ValidateTokenResult } from '@domain/results/validate-token.result';
import { ApiError } from '@domain/errors/api.error';
import { JwtPayload } from '@domain/types/jwt-payload.type';

// Config
import { JwtConfigService } from '@config/jwt/jwt-config.service';

const BLACKLIST_KEY_PREFIX = 'auth:blacklist:';

function blacklistKey(token: string): string {
    const hash = createHash('sha256').update(token).digest('hex');
    return `${BLACKLIST_KEY_PREFIX}${hash}`;
}

// ─────────────────────────────────────────────────────────────
// LoginUser
// ─────────────────────────────────────────────────────────────

export interface ILoginUserCommand {
    email: string;
    password: string;
    correlationId?: string;
}

export class LoginUserCommand {
    constructor(private readonly parameters: ILoginUserCommand) {}

    get email(): string {
        return this.parameters.email;
    }

    get password(): string {
        return this.parameters.password;
    }

    get correlationId(): string | undefined {
        return this.parameters.correlationId;
    }
}

@CommandHandler(LoginUserCommand)
export class LoginUserHandler implements ICommandHandler<LoginUserCommand, LoginUserResult> {
    constructor(
        @Inject(Logger)
        private readonly logger: Logger,
        private readonly userApiClient: IUserApiClient,
        private readonly jwtService: JwtService,
        private readonly jwtConfigService: JwtConfigService,
    ) {}

    async execute(command: LoginUserCommand): Promise<LoginUserResult> {
        this.logger.log(`Login attempt for email: ${command.email}`);
        const correlationId = command.correlationId ?? randomUUID();

        // 1. Fetch user from user-api by email (pass same x-correlation-id for tracing)
        const user = await this.userApiClient.getUserByEmail(command.email, correlationId);
        if (!user) {
            throw new ApiError(HttpStatus.UNAUTHORIZED, 'Invalid credentials');
        }

        // 2. Compare password
        const isPasswordValid = await bcrypt.compare(command.password, user.password);
        if (!isPasswordValid) {
            this.logger.warn({ msg: 'Login failed: invalid credentials', entity: 'Auth', email: command.email });
            throw new ApiError(HttpStatus.UNAUTHORIZED, 'Invalid credentials');
        }

        // 3. Build payload with roles
        const roles = user.roles?.map((r) => r.name) ?? [];
        const basePayload = { sub: user.id, roles };

        // 4. Sign access token (15m) and refresh token (15d)
        const accessSignOptions = {
            expiresIn: this.jwtConfigService.accessExpiration,
        } as JwtSignOptions;
        const refreshSignOptions = {
            expiresIn: this.jwtConfigService.refreshExpiration,
        } as JwtSignOptions;
        const accessToken = this.jwtService.sign({ ...basePayload, type: 'access' as const }, accessSignOptions);
        const refreshToken = this.jwtService.sign({ ...basePayload, type: 'refresh' as const }, refreshSignOptions);

        this.logger.log({ msg: 'User logged in', entity: 'Auth', userId: user.id });

        return new LoginUserResult({
            accessToken,
            expiresIn: this.jwtConfigService.accessExpiration,
            tokenType: 'Bearer',
            refreshToken,
            refreshExpiresIn: this.jwtConfigService.refreshExpiration,
        });
    }
}

// ─────────────────────────────────────────────────────────────
// RegisterUser
// ─────────────────────────────────────────────────────────────

export interface IRegisterUserCommand {
    name: string;
    email: string;
    password: string;
    correlationId?: string;
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

    get correlationId(): string | undefined {
        return this.parameters.correlationId;
    }
}

@CommandHandler(RegisterUserCommand)
export class RegisterUserHandler implements ICommandHandler<RegisterUserCommand, RegisterUserResult> {
    constructor(
        @Inject(Logger)
        private readonly logger: Logger,
        private readonly userApiClient: IUserApiClient,
    ) {}

    async execute(command: RegisterUserCommand): Promise<RegisterUserResult> {
        this.logger.log(`Register attempt for email: ${command.email}`);
        const correlationId = command.correlationId ?? randomUUID();

        // 1. Check if user with this email already exists
        const existingUser = await this.userApiClient.getUserByEmail(command.email, correlationId);
        if (existingUser) {
            throw new ApiError(HttpStatus.CONFLICT, 'User with this email already exists');
        }

        // 2. Hash password
        const hashedPassword = await bcrypt.hash(command.password, 10);

        // 3. Call user-api to register (pass same x-correlation-id for tracing)
        const response = await this.userApiClient.registerUser(
            {
                name: command.name,
                email: command.email,
                password: hashedPassword,
            },
            correlationId,
        );

        this.logger.log({ msg: 'User registered', entity: 'Auth', userId: response.id });

        return new RegisterUserResult({
            userId: response.id,
        });
    }
}

// ─────────────────────────────────────────────────────────────
// ValidateToken
// ─────────────────────────────────────────────────────────────

export interface IValidateTokenCommand {
    token: string;
}

export class ValidateTokenCommand {
    constructor(private readonly parameters: IValidateTokenCommand) {}

    get token(): string {
        return this.parameters.token;
    }
}

@CommandHandler(ValidateTokenCommand)
export class ValidateTokenHandler implements ICommandHandler<ValidateTokenCommand, ValidateTokenResult> {
    constructor(
        @Inject(Logger)
        private readonly logger: Logger,
        private readonly jwtService: JwtService,
        private readonly cacheService: ICacheService,
        private readonly userApiClient: IUserApiClient,
    ) {}

    async execute(command: ValidateTokenCommand): Promise<ValidateTokenResult> {
        try {
            const payload = this.jwtService.verify<JwtPayload>(command.token);

            const key = blacklistKey(command.token);
            const blacklisted = await this.cacheService.get<string>(key);
            if (blacklisted) {
                this.logger.warn({ msg: 'Token validation failed: revoked', entity: 'Tokens' });
                throw new ApiError(HttpStatus.UNAUTHORIZED, 'Token has been revoked');
            }

            const [user, roleNames] = await Promise.all([
                this.userApiClient.getUserById(payload.sub),
                this.userApiClient.getUserRoles(payload.sub),
            ]);

            return new ValidateTokenResult({
                valid: true,
                userId: payload.sub,
                roles: roleNames,
                email: user?.email,
                name: user?.name,
            });
        } catch (error) {
            if (error instanceof ApiError) {
                throw error;
            }
            this.logger.warn({ msg: 'Token validation failed: invalid or expired', entity: 'Tokens' });
            throw new ApiError(HttpStatus.UNAUTHORIZED, 'Invalid or expired token');
        }
    }
}

// ─────────────────────────────────────────────────────────────
// RefreshToken
// ─────────────────────────────────────────────────────────────

export interface IRefreshTokenCommand {
    refreshToken: string;
}

export class RefreshTokenCommand {
    constructor(private readonly parameters: IRefreshTokenCommand) {}

    get refreshToken(): string {
        return this.parameters.refreshToken;
    }
}

@CommandHandler(RefreshTokenCommand)
export class RefreshTokenHandler implements ICommandHandler<RefreshTokenCommand, LoginUserResult> {
    constructor(
        @Inject(Logger)
        private readonly logger: Logger,
        private readonly jwtService: JwtService,
        private readonly jwtConfigService: JwtConfigService,
    ) {}

    async execute(command: RefreshTokenCommand): Promise<LoginUserResult> {
        try {
            const payload = this.jwtService.verify<JwtPayload>(command.refreshToken);
            if (payload.type !== 'refresh') {
                this.logger.warn({ msg: 'Token refresh failed', entity: 'Tokens' });
                throw new ApiError(HttpStatus.UNAUTHORIZED, 'Invalid refresh token');
            }

            const basePayload = { sub: payload.sub, roles: payload.roles ?? [] };
            const accessSignOptions = {
                expiresIn: this.jwtConfigService.accessExpiration,
            } as JwtSignOptions;
            const refreshSignOptions = {
                expiresIn: this.jwtConfigService.refreshExpiration,
            } as JwtSignOptions;
            const accessToken = this.jwtService.sign({ ...basePayload, type: 'access' as const }, accessSignOptions);
            const newRefreshToken = this.jwtService.sign(
                { ...basePayload, type: 'refresh' as const },
                refreshSignOptions,
            );

            this.logger.log({ msg: 'Tokens refreshed', entity: 'Tokens', userId: payload.sub });

            return new LoginUserResult({
                accessToken,
                expiresIn: this.jwtConfigService.accessExpiration,
                tokenType: 'Bearer',
                refreshToken: newRefreshToken,
                refreshExpiresIn: this.jwtConfigService.refreshExpiration,
            });
        } catch (error) {
            if (error instanceof ApiError) {
                throw error;
            }
            this.logger.warn({ msg: 'Token refresh failed', entity: 'Tokens' });
            throw new ApiError(HttpStatus.UNAUTHORIZED, 'Invalid or expired refresh token');
        }
    }
}

// ─────────────────────────────────────────────────────────────
// Logout
// ─────────────────────────────────────────────────────────────

export interface ILogoutCommand {
    token: string;
}

export class LogoutCommand {
    constructor(private readonly parameters: ILogoutCommand) {}

    get token(): string {
        return this.parameters.token;
    }
}

@CommandHandler(LogoutCommand)
export class LogoutHandler implements ICommandHandler<LogoutCommand, LogoutUserResult> {
    constructor(
        @Inject(Logger)
        private readonly logger: Logger,
        private readonly jwtService: JwtService,
        private readonly cacheService: ICacheService,
    ) {}

    async execute(command: LogoutCommand): Promise<LogoutUserResult> {
        try {
            const payload = this.jwtService.verify<JwtPayload & { exp?: number }>(command.token);
            const nowSeconds = Math.floor(Date.now() / 1000);
            const ttlSeconds = payload.exp != null ? Math.max(0, payload.exp - nowSeconds) : 0;

            if (ttlSeconds > 0) {
                const key = blacklistKey(command.token);
                await this.cacheService.set(key, '1', ttlSeconds);
                this.logger.log({ msg: 'Token blacklisted', entity: 'Tokens', userId: payload.sub, ttl: ttlSeconds });
            }

            return new LogoutUserResult({ success: true });
        } catch {
            throw new ApiError(HttpStatus.UNAUTHORIZED, 'Invalid or expired token');
        }
    }
}

// ─────────────────────────────────────────────────────────────
// ChangePassword
// ─────────────────────────────────────────────────────────────

export interface IChangePasswordCommand {
    email: string;
    currentPassword: string;
    newPassword: string;
    correlationId?: string;
}

export class ChangePasswordCommand {
    constructor(private readonly parameters: IChangePasswordCommand) {}

    get email(): string {
        return this.parameters.email;
    }

    get currentPassword(): string {
        return this.parameters.currentPassword;
    }

    get newPassword(): string {
        return this.parameters.newPassword;
    }

    get correlationId(): string | undefined {
        return this.parameters.correlationId;
    }
}

@CommandHandler(ChangePasswordCommand)
export class ChangePasswordHandler implements ICommandHandler<ChangePasswordCommand, ChangePasswordResult> {
    constructor(
        @Inject(Logger)
        private readonly logger: Logger,
        private readonly userApiClient: IUserApiClient,
    ) {}

    async execute(command: ChangePasswordCommand): Promise<ChangePasswordResult> {
        this.logger.log(`Change password attempt for email: ${command.email}`);
        const correlationId = command.correlationId ?? randomUUID();

        // 1. Fetch user from user-api by email (pass same x-correlation-id for tracing)
        const user = await this.userApiClient.getUserByEmail(command.email, correlationId);
        if (!user) {
            throw new ApiError(HttpStatus.NOT_FOUND, 'User not found');
        }

        // 2. Verify current password matches
        const isCurrentPasswordValid = await bcrypt.compare(command.currentPassword, user.password);
        if (!isCurrentPasswordValid) {
            this.logger.warn({
                msg: 'Password change failed: incorrect password',
                entity: 'Auth',
                email: command.email,
            });
            throw new ApiError(HttpStatus.UNAUTHORIZED, 'Current password is incorrect');
        }

        // 3. Hash new password and update via user-api (same correlation id)
        const hashedNewPassword = await bcrypt.hash(command.newPassword, 10);
        await this.userApiClient.updatePassword(user.id, hashedNewPassword, correlationId);

        this.logger.log({ msg: 'Password updated', entity: 'Auth', userId: user.id });

        return new ChangePasswordResult({ success: true });
    }
}
