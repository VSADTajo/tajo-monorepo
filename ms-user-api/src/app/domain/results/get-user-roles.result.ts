export interface IUserRoleItem {
    id: string;
    name: string;
    description: string | null;
}

export interface IGetUserRolesResult {
    roles: IUserRoleItem[];
}

export class GetUserRolesResult {
    readonly roles: IUserRoleItem[];

    constructor(parameters: IGetUserRolesResult) {
        this.roles = parameters.roles;
    }
}
