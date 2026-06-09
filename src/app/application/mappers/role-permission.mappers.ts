import {
    SyncRolePermissionsRequestDto,
    SyncRolePermissionsResponseDto,
    GetRolePermissionsResponseDto,
    GetBulkPermissionsResponseDto,
} from '@api/dtos/role-permission.dtos';
import { SyncRolePermissionsCommand } from '@application/commands/role-permission.commands';
import { GetBulkPermissionsQuery, GetRolePermissionsQuery } from '@application/queries/role-permission.queries';
import {
    GetBulkPermissionsResult,
    GetRolePermissionsResult,
    SyncRolePermissionsResult,
} from '@domain/results/role-permission.result';

// ─────────────────────────────────────────────────────────────
// SyncRolePermissions
// ─────────────────────────────────────────────────────────────

export class SyncRolePermissionsMapper {
    static toCommand(roleId: string, dto: SyncRolePermissionsRequestDto): SyncRolePermissionsCommand {
        return new SyncRolePermissionsCommand({ roleId, permissionIds: dto.permissionIds });
    }

    static toResponseDto(result: SyncRolePermissionsResult): SyncRolePermissionsResponseDto {
        return { roleId: result.roleId, count: result.count };
    }
}

// ─────────────────────────────────────────────────────────────
// GetRolePermissions
// ─────────────────────────────────────────────────────────────

export class GetRolePermissionsMapper {
    static toQuery(roleId: string): GetRolePermissionsQuery {
        return new GetRolePermissionsQuery({ roleId });
    }

    static toResponseDto(result: GetRolePermissionsResult): GetRolePermissionsResponseDto {
        return {
            roleId: result.roleId,
            permissions: result.permissions.map((p) => ({ id: p.id, method: p.method, path: p.path })),
        };
    }
}

// ─────────────────────────────────────────────────────────────
// GetBulkPermissions
// ─────────────────────────────────────────────────────────────

export class GetBulkPermissionsMapper {
    static toQuery(roleNames: string[]): GetBulkPermissionsQuery {
        return new GetBulkPermissionsQuery({ roleNames });
    }

    static toResponseDto(result: GetBulkPermissionsResult): GetBulkPermissionsResponseDto {
        return { permissions: result.permissions };
    }
}
