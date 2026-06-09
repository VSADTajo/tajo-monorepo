export interface ICreateRoleResult {
    id: string;
    name: string;
    description: string | null;
}

export class CreateRoleResult {
    readonly id: string;
    readonly name: string;
    readonly description: string | null;

    constructor(parameters: ICreateRoleResult) {
        this.id = parameters.id;
        this.name = parameters.name;
        this.description = parameters.description;
    }
}
