export interface IRemoveRoleFromUserResult {
    message: string;
}

export class RemoveRoleFromUserResult {
    readonly message: string;

    constructor(parameters: IRemoveRoleFromUserResult) {
        this.message = parameters.message;
    }
}
