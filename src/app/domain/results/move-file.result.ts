export interface IMoveFileResult {
    sourcePath: string;
    destinationPath: string;
}

export class MoveFileResult {
    readonly sourcePath: string;
    readonly destinationPath: string;

    constructor(params: IMoveFileResult) {
        this.sourcePath = params.sourcePath;
        this.destinationPath = params.destinationPath;
    }
}
