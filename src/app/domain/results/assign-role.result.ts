export interface IAssignRoleResult {
    id: string;
    userId: string;
    roleId: string;
    roleName: string;
}

export class AssignRoleResult {
    readonly id: string;
    readonly userId: string;
    readonly roleId: string;
    readonly roleName: string;

    constructor(parameters: IAssignRoleResult) {
        this.id = parameters.id;
        this.userId = parameters.userId;
        this.roleId = parameters.roleId;
        this.roleName = parameters.roleName;
    }
}
