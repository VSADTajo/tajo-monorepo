export interface ISftpDeleteFileResult {
    deletedPath: string;
}

export class SftpDeleteFileResult {
    readonly deletedPath: string;

    constructor(params: ISftpDeleteFileResult) {
        this.deletedPath = params.deletedPath;
    }
}
