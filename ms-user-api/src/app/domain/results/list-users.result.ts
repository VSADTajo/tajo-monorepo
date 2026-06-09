export interface IUserItem {
    id: string;
    name: string;
    email: string;
    status: string;
}

export class ListUsersResult {
    readonly users: IUserItem[];

    constructor(users: IUserItem[]) {
        this.users = users;
    }
}
