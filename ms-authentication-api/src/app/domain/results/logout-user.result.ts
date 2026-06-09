export interface ILogoutUserResult {
    success: boolean;
}

export class LogoutUserResult {
    readonly success: boolean;

    constructor(parameters: ILogoutUserResult) {
        this.success = parameters.success;
    }
}
