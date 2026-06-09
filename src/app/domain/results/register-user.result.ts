export interface IRegisterUserResult {
    userId: string;
}

export class RegisterUserResult {
    readonly userId: string;

    constructor(parameters: IRegisterUserResult) {
        this.userId = parameters.userId;
    }
}
