export interface IUploadFileResult {
    path: string;
    size: number;
}

export class UploadFileResult {
    readonly path: string;
    readonly size: number;

    constructor(params: IUploadFileResult) {
        this.path = params.path;
        this.size = params.size;
    }
}
