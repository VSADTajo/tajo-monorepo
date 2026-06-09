export interface IPermissionItem {
    id: string;
    name: string | null;
    method: string;
    path: string;
    tag: string | null;
}

export class ListPermissionsResult {
    readonly permissions: IPermissionItem[];
    constructor(params: { permissions: IPermissionItem[] }) {
        this.permissions = params.permissions;
    }
}

export class CreatePermissionResult {
    readonly id: string;
    readonly name: string | null;
    readonly method: string;
    readonly path: string;
    constructor(params: { id: string; name: string | null; method: string; path: string }) {
        this.id = params.id;
        this.name = params.name;
        this.method = params.method;
        this.path = params.path;
    }
}

export class SyncPermissionsResult {
    readonly permissions: IPermissionItem[];
    constructor(params: { permissions: IPermissionItem[] }) {
        this.permissions = params.permissions;
    }
}
