export interface IChangePasswordResult {
    success: boolean;
}

export class ChangePasswordResult {
    readonly success: boolean;

    constructor(parameters: IChangePasswordResult) {
        this.success = parameters.success;
    }
}
