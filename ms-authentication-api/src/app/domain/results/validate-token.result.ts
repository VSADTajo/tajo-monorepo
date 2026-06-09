export interface IValidateTokenResult {
    valid: boolean;
    userId: string;
    roles: string[];
    email?: string;
    name?: string;
}

export class ValidateTokenResult {
    readonly valid: boolean;
    readonly userId: string;
    readonly roles: string[];
    readonly email?: string;
    readonly name?: string;

    constructor(parameters: IValidateTokenResult) {
        this.valid = parameters.valid;
        this.userId = parameters.userId;
        this.roles = parameters.roles;
        this.email = parameters.email;
        this.name = parameters.name;
    }
}
