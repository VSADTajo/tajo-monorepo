import { UserStatus } from '@domain/entities/user.entity';

export interface IUserRoleItem {
    id: string;
    name: string;
    description: string | null;
}

export interface IGetUserByEmailResult {
    id: string;
    password: string;
    roles: IUserRoleItem[];
    status: UserStatus;
}

export class GetUserByEmailResult {
    readonly id: string;
    readonly password: string;
    readonly roles: IUserRoleItem[];
    readonly status: UserStatus;

    constructor(parameters: IGetUserByEmailResult) {
        this.id = parameters.id;
        this.password = parameters.password;
        this.roles = parameters.roles;
        this.status = parameters.status;
    }
}
