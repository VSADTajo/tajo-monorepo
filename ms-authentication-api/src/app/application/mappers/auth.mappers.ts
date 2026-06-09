import {
    ChangePasswordRequestDto,
    ChangePasswordResponseDto,
    LoginRequestDto,
    LoginResponseDto,
    LogoutRequestDto,
    LogoutResponseDto,
    RefreshTokenRequestDto,
    RegisterRequestDto,
    RegisterResponseDto,
    ValidateTokenRequestDto,
    ValidateTokenResponseDto,
} from '@api/dtos/auth.dtos';
import {
    ChangePasswordCommand,
    LoginUserCommand,
    LogoutCommand,
    RefreshTokenCommand,
    RegisterUserCommand,
    ValidateTokenCommand,
} from '@application/commands/auth.commands';
import { ChangePasswordResult } from '@domain/results/change-password.result';
import { LoginUserResult } from '@domain/results/login-user.result';
import { LogoutUserResult } from '@domain/results/logout-user.result';
import { RegisterUserResult } from '@domain/results/register-user.result';
import { ValidateTokenResult } from '@domain/results/validate-token.result';

// ─────────────────────────────────────────────────────────────
// Login
// ─────────────────────────────────────────────────────────────

export class LoginMapper {
    static toCommand(dto: LoginRequestDto, correlationId?: string): LoginUserCommand {
        return new LoginUserCommand({ ...dto, correlationId });
    }

    static toResponseDto(result: LoginUserResult): LoginResponseDto {
        return {
            accessToken: result.accessToken,
            expiresIn: result.expiresIn,
            tokenType: result.tokenType,
            refreshToken: result.refreshToken,
            refreshExpiresIn: result.refreshExpiresIn,
        };
    }
}

// ─────────────────────────────────────────────────────────────
// Register
// ─────────────────────────────────────────────────────────────

export class RegisterMapper {
    static toCommand(dto: RegisterRequestDto, correlationId?: string): RegisterUserCommand {
        return new RegisterUserCommand({
            name: dto.name,
            email: dto.email,
            password: dto.password,
            correlationId,
        });
    }

    static toResponseDto(result: RegisterUserResult): RegisterResponseDto {
        return {
            userId: result.userId,
        };
    }
}

// ─────────────────────────────────────────────────────────────
// Logout
// ─────────────────────────────────────────────────────────────

export class LogoutMapper {
    static toCommand(dto: LogoutRequestDto): LogoutCommand {
        return new LogoutCommand({ token: dto.token });
    }

    static toResponseDto(result: LogoutUserResult): LogoutResponseDto {
        return { success: result.success };
    }
}

// ─────────────────────────────────────────────────────────────
// RefreshToken
// ─────────────────────────────────────────────────────────────

export class RefreshTokenMapper {
    static toCommand(dto: RefreshTokenRequestDto): RefreshTokenCommand {
        return new RefreshTokenCommand({ refreshToken: dto.refreshToken });
    }

    static toResponseDto(result: LoginUserResult): LoginResponseDto {
        return LoginMapper.toResponseDto(result);
    }
}

// ─────────────────────────────────────────────────────────────
// ValidateToken
// ─────────────────────────────────────────────────────────────

export class ValidateTokenMapper {
    static toCommand(dto: ValidateTokenRequestDto): ValidateTokenCommand {
        return new ValidateTokenCommand(dto);
    }

    static toResponseDto(result: ValidateTokenResult): ValidateTokenResponseDto {
        return {
            valid: result.valid,
            userId: result.userId,
            roles: result.roles,
            ...(result.email !== undefined && { email: result.email }),
            ...(result.name !== undefined && { name: result.name }),
        };
    }
}

// ─────────────────────────────────────────────────────────────
// ChangePassword
// ─────────────────────────────────────────────────────────────

export class ChangePasswordMapper {
    static toCommand(dto: ChangePasswordRequestDto, correlationId?: string): ChangePasswordCommand {
        return new ChangePasswordCommand({
            email: dto.email,
            currentPassword: dto.currentPassword,
            newPassword: dto.newPassword,
            correlationId,
        });
    }

    static toResponseDto(result: ChangePasswordResult): ChangePasswordResponseDto {
        return { success: result.success };
    }
}
