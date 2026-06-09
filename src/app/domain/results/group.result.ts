export interface IGroupRoleItem {
    id: string;
    name: string;
    description: string | null;
}

export class CreateGroupResult {
    readonly id: string;
    readonly name: string;
    readonly description: string | null;
    constructor(params: { id: string; name: string; description: string | null }) {
        this.id = params.id;
        this.name = params.name;
        this.description = params.description;
    }
}

export class ListGroupsResult {
    readonly groups: Array<{
        id: string;
        name: string;
        description: string | null;
        roles: IGroupRoleItem[];
    }>;
    constructor(params: { groups: ListGroupsResult['groups'] }) {
        this.groups = params.groups;
    }
}

export class GetUserGroupsResult {
    readonly groups: Array<{
        id: string;
        name: string;
        description: string | null;
    }>;
    constructor(params: { groups: GetUserGroupsResult['groups'] }) {
        this.groups = params.groups;
    }
}

export class AssignRoleToGroupResult {
    readonly id: string;
    readonly groupId: string;
    readonly roleId: string;
    readonly roleName: string;
    constructor(params: { id: string; groupId: string; roleId: string; roleName: string }) {
        this.id = params.id;
        this.groupId = params.groupId;
        this.roleId = params.roleId;
        this.roleName = params.roleName;
    }
}

export class AssignGroupToUserResult {
    readonly id: string;
    readonly userId: string;
    readonly groupId: string;
    readonly groupName: string;
    constructor(params: { id: string; userId: string; groupId: string; groupName: string }) {
        this.id = params.id;
        this.userId = params.userId;
        this.groupId = params.groupId;
        this.groupName = params.groupName;
    }
}
