export interface RolePermissionItem {
    id: string;
    method: string;
    path: string;
}

export class GetRolePermissionsResult {
    readonly roleId: string;
    readonly permissions: RolePermissionItem[];

    constructor(params: { roleId: string; permissions: RolePermissionItem[] }) {
        this.roleId = params.roleId;
        this.permissions = params.permissions;
    }
}

export class GetBulkPermissionsResult {
    readonly permissions: Array<{ method: string; path: string }>;

    constructor(params: { permissions: Array<{ method: string; path: string }> }) {
        this.permissions = params.permissions;
    }
}

export class SyncRolePermissionsResult {
    readonly roleId: string;
    readonly count: number;

    constructor(params: { roleId: string; count: number }) {
        this.roleId = params.roleId;
        this.count = params.count;
    }
}
