import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

const VALID_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

// ─────────────────────────────────────────────────────────────
// CreatePermission
// ─────────────────────────────────────────────────────────────

export class CreatePermissionRequestDto {
    @ApiProperty({ description: 'Optional permission name', example: 'View users', required: false })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    name?: string;

    @ApiProperty({ description: 'HTTP method', example: 'GET', enum: VALID_METHODS })
    @IsNotEmpty()
    @IsString()
    @IsIn(VALID_METHODS)
    method: string;

    @ApiProperty({ description: 'Route path in OpenAPI format', example: '/users/{id}' })
    @IsNotEmpty()
    @IsString()
    path: string;
}

export class CreatePermissionResponseDto {
    @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
    id: string;

    @ApiProperty({ example: 'View users', nullable: true })
    name: string | null;

    @ApiProperty({ example: 'GET' })
    method: string;

    @ApiProperty({ example: '/users/{id}' })
    path: string;
}

// ─────────────────────────────────────────────────────────────
// ListPermissions
// ─────────────────────────────────────────────────────────────

export class PermissionItemDto {
    @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
    id: string;

    @ApiProperty({ example: 'View users', nullable: true })
    name: string | null;

    @ApiProperty({ example: 'GET' })
    method: string;

    @ApiProperty({ example: '/users/{id}' })
    path: string;

    @ApiProperty({ example: 'Users', nullable: true })
    tag: string | null;
}

export class ListPermissionsResponseDto {
    @ApiProperty({ type: [PermissionItemDto] })
    permissions: PermissionItemDto[];
}

// ─────────────────────────────────────────────────────────────
// SyncPermissions (from gateway swagger routes)
// ─────────────────────────────────────────────────────────────

export class SyncPermissionRouteDto {
    @ApiProperty({ example: 'GET' })
    @IsNotEmpty()
    @IsString()
    @IsIn(VALID_METHODS)
    method: string;

    @ApiProperty({ example: '/users/{id}' })
    @IsNotEmpty()
    @IsString()
    path: string;

    @ApiProperty({ example: 'Get user by ID', required: false })
    @IsOptional()
    @IsString()
    name?: string;

    @ApiProperty({ example: 'Users', required: false })
    @IsOptional()
    @IsString()
    tag?: string;
}

export class SyncPermissionsRequestDto {
    @ApiProperty({ type: [SyncPermissionRouteDto] })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => SyncPermissionRouteDto)
    routes: SyncPermissionRouteDto[];
}

export class SyncPermissionsResponseDto {
    @ApiProperty({ type: [PermissionItemDto] })
    permissions: PermissionItemDto[];
}
