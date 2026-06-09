export interface IDeleteFileResult {
    deletedPath: string;
}

export class DeleteFileResult {
    readonly deletedPath: string;

    constructor(params: IDeleteFileResult) {
        this.deletedPath = params.deletedPath;
    }
}
