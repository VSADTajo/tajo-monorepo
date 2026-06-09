import {
    CreateSftpUserRequestDto,
    UpdateSftpUserRequestDto,
    SftpUserResponseDto,
    ListSftpUsersResponseDto,
    DeleteSftpUserResponseDto,
    ToggleSftpUserRequestDto,
} from '@api/dtos/sftp-user.dtos';
import {
    CreateSftpUserCommand,
    UpdateSftpUserCommand,
    DeleteSftpUserCommand,
    ToggleSftpUserCommand,
} from '@application/commands/sftp-user.commands';
import { ListSftpUsersQuery, GetSftpUserByIdQuery } from '@application/queries/sftp-user.queries';
import { SftpUserResult, ListSftpUsersResult, DeleteSftpUserResult } from '@domain/results/sftp-user.result';

// ─────────────────────────────────────────────────────────────
// Shared: Result -> ResponseDto
// ─────────────────────────────────────────────────────────────

function toSftpUserResponseDto(result: SftpUserResult): SftpUserResponseDto {
    return {
        id: result.id,
        username: result.username,
        rootDirectory: result.rootDirectory,
        isActive: result.isActive,
        createdAt: result.createdAt instanceof Date ? result.createdAt.toISOString() : String(result.createdAt),
        updatedAt: result.updatedAt instanceof Date ? result.updatedAt.toISOString() : String(result.updatedAt),
    };
}

// ─────────────────────────────────────────────────────────────
// CreateSftpUser
// ─────────────────────────────────────────────────────────────

export class CreateSftpUserMapper {
    static toCommand(dto: CreateSftpUserRequestDto): CreateSftpUserCommand {
        return new CreateSftpUserCommand({
            username: dto.username,
            password: dto.password,
            rootDirectory: dto.rootDirectory,
        });
    }

    static toResponseDto(result: SftpUserResult): SftpUserResponseDto {
        return toSftpUserResponseDto(result);
    }
}

// ─────────────────────────────────────────────────────────────
// UpdateSftpUser
// ─────────────────────────────────────────────────────────────

export class UpdateSftpUserMapper {
    static toCommand(id: string, dto: UpdateSftpUserRequestDto): UpdateSftpUserCommand {
        return new UpdateSftpUserCommand({
            id,
            password: dto.password,
            rootDirectory: dto.rootDirectory,
        });
    }

    static toResponseDto(result: SftpUserResult): SftpUserResponseDto {
        return toSftpUserResponseDto(result);
    }
}

// ─────────────────────────────────────────────────────────────
// DeleteSftpUser
// ─────────────────────────────────────────────────────────────

export class DeleteSftpUserMapper {
    static toCommand(id: string): DeleteSftpUserCommand {
        return new DeleteSftpUserCommand({ id });
    }

    static toResponseDto(result: DeleteSftpUserResult): DeleteSftpUserResponseDto {
        return {
            deletedId: result.deletedId,
            username: result.username,
        };
    }
}

// ─────────────────────────────────────────────────────────────
// ToggleSftpUser
// ─────────────────────────────────────────────────────────────

export class ToggleSftpUserMapper {
    static toCommand(id: string, dto: ToggleSftpUserRequestDto): ToggleSftpUserCommand {
        return new ToggleSftpUserCommand({ id, isActive: dto.isActive });
    }

    static toResponseDto(result: SftpUserResult): SftpUserResponseDto {
        return toSftpUserResponseDto(result);
    }
}

// ─────────────────────────────────────────────────────────────
// ListSftpUsers
// ─────────────────────────────────────────────────────────────

export class ListSftpUsersMapper {
    static toQuery(): ListSftpUsersQuery {
        return new ListSftpUsersQuery();
    }

    static toResponseDto(result: ListSftpUsersResult): ListSftpUsersResponseDto {
        return {
            users: result.users.map(toSftpUserResponseDto),
        };
    }
}

// ─────────────────────────────────────────────────────────────
// GetSftpUserById
// ─────────────────────────────────────────────────────────────

export class GetSftpUserByIdMapper {
    static toQuery(id: string): GetSftpUserByIdQuery {
        return new GetSftpUserByIdQuery({ id });
    }

    static toResponseDto(result: SftpUserResult): SftpUserResponseDto {
        return toSftpUserResponseDto(result);
    }
}
