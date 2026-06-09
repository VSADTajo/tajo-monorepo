import {
    CreateGroupRequestDto,
    CreateGroupResponseDto,
    ListGroupsResponseDto,
    AssignRoleToGroupResponseDto,
    AssignGroupToUserResponseDto,
    GetUserGroupsResponseDto,
} from '@api/dtos/group.dtos';
import { CreateGroupCommand } from '@application/commands/group.commands';
import {
    CreateGroupResult,
    ListGroupsResult,
    AssignRoleToGroupResult,
    AssignGroupToUserResult,
    GetUserGroupsResult,
} from '@domain/results/group.result';

// ─────────────────────────────────────────────────────────────
// CreateGroup
// ─────────────────────────────────────────────────────────────

export class CreateGroupMapper {
    static toCommand(dto: CreateGroupRequestDto): CreateGroupCommand {
        return new CreateGroupCommand(dto);
    }

    static toResponseDto(result: CreateGroupResult): CreateGroupResponseDto {
        return { id: result.id, name: result.name, description: result.description };
    }
}

// ─────────────────────────────────────────────────────────────
// ListGroups
// ─────────────────────────────────────────────────────────────

export class ListGroupsMapper {
    static toResponseDto(result: ListGroupsResult): ListGroupsResponseDto {
        return {
            groups: result.groups.map((g) => ({
                id: g.id,
                name: g.name,
                description: g.description,
                roles: g.roles.map((r) => ({
                    id: r.id,
                    name: r.name,
                    description: r.description,
                })),
            })),
        };
    }
}

// ─────────────────────────────────────────────────────────────
// AssignRoleToGroup
// ─────────────────────────────────────────────────────────────

export class AssignRoleToGroupMapper {
    static toResponseDto(result: AssignRoleToGroupResult): AssignRoleToGroupResponseDto {
        return { id: result.id, groupId: result.groupId, roleId: result.roleId, roleName: result.roleName };
    }
}

// ─────────────────────────────────────────────────────────────
// AssignGroupToUser
// ─────────────────────────────────────────────────────────────

export class AssignGroupToUserMapper {
    static toResponseDto(result: AssignGroupToUserResult): AssignGroupToUserResponseDto {
        return { id: result.id, userId: result.userId, groupId: result.groupId, groupName: result.groupName };
    }
}

// ─────────────────────────────────────────────────────────────
// GetUserGroups
// ─────────────────────────────────────────────────────────────

export class GetUserGroupsMapper {
    static toResponseDto(result: GetUserGroupsResult): GetUserGroupsResponseDto {
        return {
            groups: result.groups.map((g) => ({
                id: g.id,
                name: g.name,
                description: g.description,
            })),
        };
    }
}
