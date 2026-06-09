export interface ILoginUserResult {
    accessToken: string;
    expiresIn: string;
    tokenType: string;
    refreshToken: string;
    refreshExpiresIn: string;
}

export class LoginUserResult {
    readonly accessToken: string;
    readonly expiresIn: string;
    readonly tokenType: string;
    readonly refreshToken: string;
    readonly refreshExpiresIn: string;

    constructor(parameters: ILoginUserResult) {
        this.accessToken = parameters.accessToken;
        this.expiresIn = parameters.expiresIn;
        this.tokenType = parameters.tokenType;
        this.refreshToken = parameters.refreshToken;
        this.refreshExpiresIn = parameters.refreshExpiresIn;
    }
}
