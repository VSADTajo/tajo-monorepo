import { Readable } from 'node:stream';

export interface ISftpDownloadFileResult {
    stream: Readable;
    fileName: string;
    size: number;
}

export class SftpDownloadFileResult {
    readonly stream: Readable;
    readonly fileName: string;
    readonly size: number;

    constructor(params: ISftpDownloadFileResult) {
        this.stream = params.stream;
        this.fileName = params.fileName;
        this.size = params.size;
    }
}
