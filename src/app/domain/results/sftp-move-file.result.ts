export interface ISftpMoveFileResult {
    sourcePath: string;
    destinationPath: string;
}

export class SftpMoveFileResult {
    readonly sourcePath: string;
    readonly destinationPath: string;

    constructor(params: ISftpMoveFileResult) {
        this.sourcePath = params.sourcePath;
        this.destinationPath = params.destinationPath;
    }
}
