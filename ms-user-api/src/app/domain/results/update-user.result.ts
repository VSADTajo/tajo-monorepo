import { UserStatus } from '@domain/entities/user.entity';

export interface IUpdateUserResult {
    id: string;
    name: string;
    email: string;
    status: UserStatus;
    welcomeEmailId: string | null;
}

export class UpdateUserResult {
    readonly id: string;
    readonly name: string;
    readonly email: string;
    readonly status: UserStatus;
    readonly welcomeEmailId: string | null;

    constructor(parameters: IUpdateUserResult) {
        this.id = parameters.id;
        this.name = parameters.name;
        this.email = parameters.email;
        this.status = parameters.status;
        this.welcomeEmailId = parameters.welcomeEmailId;
    }
}
