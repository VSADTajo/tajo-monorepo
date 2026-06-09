import {
    CreateRoleRequestDto,
    CreateRoleResponseDto,
    AssignRoleRequestDto,
    AssignRoleResponseDto,
    ListRolesResponseDto,
    GetUserRolesResponseDto,
    RemoveUserRoleResponseDto,
} from '@api/dtos/role.dtos';
import {
    CreateRoleCommand,
    AssignRoleToUserCommand,
    RemoveRoleFromUserCommand,
    DeleteRoleCommand,
} from '@application/commands/role.commands';
import { CreateRoleResult } from '@domain/results/create-role.result';
import { AssignRoleResult } from '@domain/results/assign-role.result';
import { ListRolesResult } from '@domain/results/list-roles.result';
import { GetUserRolesResult } from '@domain/results/get-user-roles.result';

// ─────────────────────────────────────────────────────────────
// CreateRole
// ─────────────────────────────────────────────────────────────

export class CreateRoleMapper {
    static toCommand(dto: CreateRoleRequestDto): CreateRoleCommand {
        return new CreateRoleCommand(dto);
    }

    static toResponseDto(result: CreateRoleResult): CreateRoleResponseDto {
        return {
            id: result.id,
            name: result.name,
            description: result.description,
        };
    }
}

// ─────────────────────────────────────────────────────────────
// AssignRoleToUser
// ─────────────────────────────────────────────────────────────

export class AssignRoleToUserMapper {
    static toCommand(userId: string, dto: AssignRoleRequestDto): AssignRoleToUserCommand {
        return new AssignRoleToUserCommand({ userId, roleId: dto.roleId });
    }

    static toResponseDto(result: AssignRoleResult): AssignRoleResponseDto {
        return {
            id: result.id,
            userId: result.userId,
            roleId: result.roleId,
            roleName: result.roleName,
        };
    }
}

// ─────────────────────────────────────────────────────────────
// ListRoles
// ─────────────────────────────────────────────────────────────

export class ListRolesMapper {
    static toResponseDto(result: ListRolesResult): ListRolesResponseDto {
        return {
            roles: result.roles.map((role) => ({
                id: role.id,
                name: role.name,
                description: role.description,
            })),
        };
    }
}

// ─────────────────────────────────────────────────────────────
// GetUserRoles
// ─────────────────────────────────────────────────────────────

export class GetUserRolesMapper {
    static toResponseDto(result: GetUserRolesResult): GetUserRolesResponseDto {
        return {
            roles: result.roles.map((role) => ({
                id: role.id,
                name: role.name,
                description: role.description,
            })),
        };
    }
}

// ─────────────────────────────────────────────────────────────
// RemoveRoleFromUser
// ─────────────────────────────────────────────────────────────

export class RemoveRoleFromUserMapper {
    static toCommand(userId: string, roleId: string): RemoveRoleFromUserCommand {
        return new RemoveRoleFromUserCommand({ userId, roleId });
    }

    static toResponseDto(): RemoveUserRoleResponseDto {
        return { message: 'Role removed from user successfully' };
    }
}

// ─────────────────────────────────────────────────────────────
// DeleteRole
// ─────────────────────────────────────────────────────────────

export class DeleteRoleMapper {
    static toCommand(roleId: string): DeleteRoleCommand {
        return new DeleteRoleCommand({ roleId });
    }
}
