export interface ICreateFolderResult {
    path: string;
}

export class CreateFolderResult {
    readonly path: string;

    constructor(params: ICreateFolderResult) {
        this.path = params.path;
    }
}
