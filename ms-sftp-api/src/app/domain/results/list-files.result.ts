export interface IFileInfoResult {
    name: string;
    path: string;
    size: number;
    modifiedAt: string;
    isDirectory: boolean;
}

export class FileInfoResult {
    readonly name: string;
    readonly path: string;
    readonly size: number;
    readonly modifiedAt: string;
    readonly isDirectory: boolean;

    constructor(params: IFileInfoResult) {
        this.name = params.name;
        this.path = params.path;
        this.size = params.size;
        this.modifiedAt = params.modifiedAt;
        this.isDirectory = params.isDirectory;
    }
}

export interface IListFilesResult {
    directory: string;
    files: FileInfoResult[];
}

export class ListFilesResult {
    readonly directory: string;
    readonly files: FileInfoResult[];

    constructor(params: IListFilesResult) {
        this.directory = params.directory;
        this.files = params.files;
    }
}
