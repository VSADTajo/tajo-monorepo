import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsUUID } from 'class-validator';

// ─────────────────────────────────────────────────────────────
// SyncRolePermissions
// ─────────────────────────────────────────────────────────────

export class SyncRolePermissionsRequestDto {
    @ApiProperty({ description: 'List of permission IDs to assign (replaces existing)', type: [String] })
    @IsArray()
    @IsUUID('4', { each: true })
    permissionIds: string[];
}

export class SyncRolePermissionsResponseDto {
    @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
    roleId: string;

    @ApiProperty({ example: 5 })
    count: number;
}

// ─────────────────────────────────────────────────────────────
// GetRolePermissions
// ─────────────────────────────────────────────────────────────

export class RolePermissionItemDto {
    @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
    id: string;

    @ApiProperty({ example: 'GET' })
    method: string;

    @ApiProperty({ example: '/users/{id}' })
    path: string;
}

export class GetRolePermissionsResponseDto {
    @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
    roleId: string;

    @ApiProperty({ type: [RolePermissionItemDto] })
    permissions: RolePermissionItemDto[];
}

// ─────────────────────────────────────────────────────────────
// GetBulkPermissions (gateway internal)
// ─────────────────────────────────────────────────────────────

export class BulkPermissionItemDto {
    @ApiProperty({ example: 'GET' })
    method: string;

    @ApiProperty({ example: '/users/{id}' })
    path: string;
}

export class GetBulkPermissionsResponseDto {
    @ApiProperty({ type: [BulkPermissionItemDto] })
    permissions: BulkPermissionItemDto[];
}
