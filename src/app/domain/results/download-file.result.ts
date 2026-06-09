import { Readable } from 'node:stream';

export interface IDownloadFileResult {
    stream: Readable;
    fileName: string;
    size: number;
}

export class DownloadFileResult {
    readonly stream: Readable;
    readonly fileName: string;
    readonly size: number;

    constructor(params: IDownloadFileResult) {
        this.stream = params.stream;
        this.fileName = params.fileName;
        this.size = params.size;
    }
}
