import {
    CreatePermissionRequestDto,
    CreatePermissionResponseDto,
    ListPermissionsResponseDto,
    SyncPermissionsRequestDto,
    SyncPermissionsResponseDto,
} from '@api/dtos/permission.dtos';
import { CreatePermissionCommand, SyncPermissionsCommand } from '@application/commands/permission.commands';
import {
    CreatePermissionResult,
    ListPermissionsResult,
    SyncPermissionsResult,
} from '@domain/results/permission.result';

// ─────────────────────────────────────────────────────────────
// CreatePermission
// ─────────────────────────────────────────────────────────────

export class CreatePermissionMapper {
    static toCommand(dto: CreatePermissionRequestDto): CreatePermissionCommand {
        return new CreatePermissionCommand(dto);
    }

    static toResponseDto(result: CreatePermissionResult): CreatePermissionResponseDto {
        return {
            id: result.id,
            name: result.name,
            method: result.method,
            path: result.path,
        };
    }
}

// ─────────────────────────────────────────────────────────────
// ListPermissions
// ─────────────────────────────────────────────────────────────

export class ListPermissionsMapper {
    static toResponseDto(result: ListPermissionsResult): ListPermissionsResponseDto {
        return {
            permissions: result.permissions.map((p) => ({
                id: p.id,
                name: p.name,
                method: p.method,
                path: p.path,
                tag: p.tag,
            })),
        };
    }
}

// ─────────────────────────────────────────────────────────────
// SyncPermissions
// ─────────────────────────────────────────────────────────────

export class SyncPermissionsMapper {
    static toCommand(dto: SyncPermissionsRequestDto): SyncPermissionsCommand {
        return new SyncPermissionsCommand({
            routes: dto.routes.map((r) => ({
                method: r.method,
                path: r.path,
                name: r.name ?? null,
                tag: r.tag ?? null,
            })),
        });
    }

    static toResponseDto(result: SyncPermissionsResult): SyncPermissionsResponseDto {
        return {
            permissions: result.permissions.map((p) => ({
                id: p.id,
                name: p.name,
                method: p.method,
                path: p.path,
                tag: p.tag,
            })),
        };
    }
}
