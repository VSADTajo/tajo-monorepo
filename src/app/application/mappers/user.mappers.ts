import {
    RegisterUserRequestDto,
    RegisterUserResponseDto,
    GetUserByIdResponseDto,
    UpdateUserRequestDto,
    UpdateUserResponseDto,
    GetUserByEmailResponseDto,
    GetUserStatusResponseDto,
    ListUsersResponseDto,
} from '@api/dtos/user.dtos';
import { RegisterUserCommand, UpdateUserCommand } from '@application/commands/user.commands';
import { RegisterUserResult } from '@domain/results/register-user.result';
import { UpdateUserResult } from '@domain/results/update-user.result';
import { GetUserByEmailResult } from '@domain/results/get-user-by-email.result';
import { ListUsersResult } from '@domain/results/list-users.result';
import { User } from '@domain/entities/user.entity';

// ─────────────────────────────────────────────────────────────
// RegisterUser
// ─────────────────────────────────────────────────────────────

export class RegisterUserMapper {
    static toCommand(dto: RegisterUserRequestDto): RegisterUserCommand {
        return new RegisterUserCommand(dto);
    }

    static toResponseDto(result: RegisterUserResult): RegisterUserResponseDto {
        return {
            id: result.id,
            name: result.name,
            email: result.email,
            status: result.status,
            welcomeEmailId: result.welcomeEmailId,
        };
    }
}

// ─────────────────────────────────────────────────────────────
// GetUserByEmail
// ─────────────────────────────────────────────────────────────

export class GetUserByEmailMapper {
    static toResponseDto(result: GetUserByEmailResult): GetUserByEmailResponseDto {
        return {
            id: result.id,
            password: result.password,
            roles: result.roles,
            status: result.status,
        };
    }
}

// ─────────────────────────────────────────────────────────────
// UpdateUser
// ─────────────────────────────────────────────────────────────

export class UpdateUserMapper {
    static toCommand(id: string, dto: UpdateUserRequestDto): UpdateUserCommand {
        return new UpdateUserCommand({
            id,
            name: dto.name,
            email: dto.email,
            status: dto.status,
        });
    }

    static toResponseDto(result: UpdateUserResult): UpdateUserResponseDto {
        return {
            id: result.id,
            name: result.name,
            email: result.email,
            status: result.status,
            welcomeEmailId: result.welcomeEmailId,
        };
    }
}

// ─────────────────────────────────────────────────────────────
// GetUserById
// ─────────────────────────────────────────────────────────────

export class GetUserByIdMapper {
    static toResponseDto(entity: User): GetUserByIdResponseDto {
        return {
            id: entity.id,
            name: entity.name,
            email: entity.email,
            status: entity.status,
            welcomeEmailId: entity.welcomeEmailId,
        };
    }
}

// ─────────────────────────────────────────────────────────────
// GetUserStatus
// ─────────────────────────────────────────────────────────────

export class GetUserStatusMapper {
    static toResponseDto(entity: User): GetUserStatusResponseDto {
        return { status: entity.status };
    }
}

// ─────────────────────────────────────────────────────────────
// ListUsers
// ─────────────────────────────────────────────────────────────

export class ListUsersMapper {
    static toResponseDto(result: ListUsersResult): ListUsersResponseDto {
        return {
            users: result.users.map((user) => ({
                id: user.id,
                name: user.name,
                email: user.email,
                status: user.status,
            })),
        };
    }
}
