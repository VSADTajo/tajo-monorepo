import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

// ─────────────────────────────────────────────────────────────
// CreateGroup
// ─────────────────────────────────────────────────────────────

export class CreateGroupRequestDto {
    @ApiProperty({ description: 'Group name (alphanumeric, hyphens, underscores)', example: 'field-supervisors' })
    @IsNotEmpty()
    @IsString()
    @MaxLength(50)
    name: string;

    @ApiProperty({
        description: 'Optional description',
        example: 'Supervisors with full field access',
        required: false,
    })
    @IsOptional()
    @IsString()
    @MaxLength(255)
    description?: string;
}

export class CreateGroupResponseDto {
    @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
    id: string;

    @ApiProperty({ example: 'field-supervisors' })
    name: string;

    @ApiProperty({ example: 'Supervisors with full field access', nullable: true })
    description: string | null;
}

// ─────────────────────────────────────────────────────────────
// ListGroups
// ─────────────────────────────────────────────────────────────

export class GroupRoleItemDto {
    @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
    id: string;

    @ApiProperty({ example: 'editor' })
    name: string;

    @ApiProperty({ example: 'Can edit content', nullable: true })
    description: string | null;
}

export class GroupItemDto {
    @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
    id: string;

    @ApiProperty({ example: 'field-supervisors' })
    name: string;

    @ApiProperty({ example: 'Supervisors with full field access', nullable: true })
    description: string | null;

    @ApiProperty({ type: [GroupRoleItemDto] })
    roles: GroupRoleItemDto[];
}

export class ListGroupsResponseDto {
    @ApiProperty({ type: [GroupItemDto] })
    groups: GroupItemDto[];
}

// ─────────────────────────────────────────────────────────────
// AssignRoleToGroup
// ─────────────────────────────────────────────────────────────

export class AssignRoleToGroupRequestDto {
    @ApiProperty({ description: 'Role ID to assign', example: '550e8400-e29b-41d4-a716-446655440000' })
    @IsNotEmpty()
    @IsUUID()
    roleId: string;
}

export class AssignRoleToGroupResponseDto {
    @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
    id: string;

    @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440001' })
    groupId: string;

    @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440002' })
    roleId: string;

    @ApiProperty({ example: 'editor' })
    roleName: string;
}

// ─────────────────────────────────────────────────────────────
// AssignGroupToUser
// ─────────────────────────────────────────────────────────────

export class AssignGroupToUserRequestDto {
    @ApiProperty({ description: 'Group ID to assign', example: '550e8400-e29b-41d4-a716-446655440000' })
    @IsNotEmpty()
    @IsUUID()
    groupId: string;
}

export class AssignGroupToUserResponseDto {
    @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
    id: string;

    @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440001' })
    userId: string;

    @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440002' })
    groupId: string;

    @ApiProperty({ example: 'field-supervisors' })
    groupName: string;
}

// ─────────────────────────────────────────────────────────────
// GetUserGroups
// ─────────────────────────────────────────────────────────────

export class UserGroupItemDto {
    @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
    id: string;

    @ApiProperty({ example: 'field-supervisors' })
    name: string;

    @ApiProperty({ example: 'Supervisors with full field access', nullable: true })
    description: string | null;
}

export class GetUserGroupsResponseDto {
    @ApiProperty({ type: [UserGroupItemDto] })
    groups: UserGroupItemDto[];
}

// ─────────────────────────────────────────────────────────────
// RemoveRoleFromGroup / RemoveGroupFromUser
// ─────────────────────────────────────────────────────────────

export class MessageResponseDto {
    @ApiProperty({ example: 'Operation completed successfully' })
    message: string;
}
