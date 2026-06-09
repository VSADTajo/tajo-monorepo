export interface IRemoteFileInfoResult {
    name: string;
    path: string;
    size: number;
    modifiedAt: string;
    isDirectory: boolean;
}

export class RemoteFileInfoResult {
    readonly name: string;
    readonly path: string;
    readonly size: number;
    readonly modifiedAt: string;
    readonly isDirectory: boolean;

    constructor(params: IRemoteFileInfoResult) {
        this.name = params.name;
        this.path = params.path;
        this.size = params.size;
        this.modifiedAt = params.modifiedAt;
        this.isDirectory = params.isDirectory;
    }
}

export interface ISftpListFilesResult {
    directory: string;
    files: RemoteFileInfoResult[];
}

export class SftpListFilesResult {
    readonly directory: string;
    readonly files: RemoteFileInfoResult[];

    constructor(params: ISftpListFilesResult) {
        this.directory = params.directory;
        this.files = params.files;
    }
}
