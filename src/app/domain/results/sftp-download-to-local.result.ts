export interface ISftpDownloadToLocalResult {
    remotePath: string;
    localPath: string;
    size: number;
}

export class SftpDownloadToLocalResult {
    readonly remotePath: string;
    readonly localPath: string;
    readonly size: number;

    constructor(params: ISftpDownloadToLocalResult) {
        this.remotePath = params.remotePath;
        this.localPath = params.localPath;
        this.size = params.size;
    }
}
