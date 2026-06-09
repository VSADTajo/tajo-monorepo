import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

// ─────────────────────────────────────────────────────────────
// CreateRole
// ─────────────────────────────────────────────────────────────

export class CreateRoleRequestDto {
    @ApiProperty({
        description: 'Role name (alphanumeric, hyphens, underscores)',
        example: 'admin',
    })
    @IsNotEmpty()
    @IsString()
    @MaxLength(50)
    name: string;

    @ApiProperty({
        description: 'Optional role description',
        example: 'System administrator with full access',
        required: false,
    })
    @IsOptional()
    @IsString()
    @MaxLength(255)
    description?: string;
}

export class CreateRoleResponseDto {
    @ApiProperty({
        description: 'Role ID',
        example: '550e8400-e29b-41d4-a716-446655440000',
    })
    id: string;

    @ApiProperty({
        description: 'Role name',
        example: 'admin',
    })
    name: string;

    @ApiProperty({
        description: 'Role description',
        example: 'System administrator with full access',
        nullable: true,
    })
    description: string | null;
}

// ─────────────────────────────────────────────────────────────
// ListRoles
// ─────────────────────────────────────────────────────────────

export class RoleItemDto {
    @ApiProperty({
        description: 'Role ID',
        example: '550e8400-e29b-41d4-a716-446655440000',
    })
    id: string;

    @ApiProperty({
        description: 'Role name',
        example: 'admin',
    })
    name: string;

    @ApiProperty({
        description: 'Role description',
        example: 'System administrator with full access',
        nullable: true,
    })
    description: string | null;
}

export class ListRolesResponseDto {
    @ApiProperty({
        description: 'List of all roles',
        type: [RoleItemDto],
    })
    roles: RoleItemDto[];
}

// ─────────────────────────────────────────────────────────────
// AssignRole
// ─────────────────────────────────────────────────────────────

export class AssignRoleRequestDto {
    @ApiProperty({
        description: 'The ID of the role to assign',
        example: '550e8400-e29b-41d4-a716-446655440000',
    })
    @IsNotEmpty()
    @IsUUID()
    roleId: string;
}

export class AssignRoleResponseDto {
    @ApiProperty({
        description: 'User-role assignment ID',
        example: '550e8400-e29b-41d4-a716-446655440000',
    })
    id: string;

    @ApiProperty({
        description: 'User ID',
        example: '550e8400-e29b-41d4-a716-446655440001',
    })
    userId: string;

    @ApiProperty({
        description: 'Role ID',
        example: '550e8400-e29b-41d4-a716-446655440002',
    })
    roleId: string;

    @ApiProperty({
        description: 'Role name',
        example: 'admin',
    })
    roleName: string;
}

// ─────────────────────────────────────────────────────────────
// GetUserRoles
// ─────────────────────────────────────────────────────────────

export class UserRoleItemDto {
    @ApiProperty({
        description: 'Role ID',
        example: '550e8400-e29b-41d4-a716-446655440000',
    })
    id: string;

    @ApiProperty({
        description: 'Role name',
        example: 'admin',
    })
    name: string;

    @ApiProperty({
        description: 'Role description',
        example: 'System administrator',
        nullable: true,
    })
    description: string | null;
}

export class GetUserRolesResponseDto {
    @ApiProperty({
        description: 'List of roles assigned to the user',
        type: [UserRoleItemDto],
    })
    roles: UserRoleItemDto[];
}

// ─────────────────────────────────────────────────────────────
// RemoveUserRole
// ─────────────────────────────────────────────────────────────

export class RemoveUserRoleResponseDto {
    @ApiProperty({
        description: 'Success message',
        example: 'Role removed from user successfully',
    })
    message: string;
}
