import { UserStatus } from '@domain/entities/user.entity';

export interface IRegisterUserResult {
    id: string;
    name: string;
    email: string;
    status: UserStatus;
    welcomeEmailId: string;
}

export class RegisterUserResult {
    readonly id: string;
    readonly name: string;
    readonly email: string;
    readonly status: UserStatus;
    readonly welcomeEmailId: string;

    constructor(parameters: IRegisterUserResult) {
        this.id = parameters.id;
        this.name = parameters.name;
        this.email = parameters.email;
        this.status = parameters.status;
        this.welcomeEmailId = parameters.welcomeEmailId;
    }
}
