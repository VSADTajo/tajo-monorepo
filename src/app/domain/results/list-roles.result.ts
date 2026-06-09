export interface IRoleItem {
    id: string;
    name: string;
    description: string | null;
}

export class ListRolesResult {
    readonly roles: IRoleItem[];

    constructor(roles: IRoleItem[]) {
        this.roles = roles;
    }
}
