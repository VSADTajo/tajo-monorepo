import { Readable } from 'node:stream';
import { ListFilesResult } from '@domain/results/list-files.result';
import { DownloadFileResult } from '@domain/results/download-file.result';
import { UploadFileResult } from '@domain/results/upload-file.result';
import { MoveFileResult } from '@domain/results/move-file.result';
import { DeleteFileResult } from '@domain/results/delete-file.result';
import { CreateFolderResult } from '@domain/results/create-folder.result';

export interface ReadFileTextResult {
    content: string;
    size: number;
    modifiedAt: string;
}

export abstract class IFileStorageService {
    abstract listFiles(directoryPath: string): Promise<ListFilesResult>;
    abstract downloadFile(filePath: string): Promise<DownloadFileResult>;
    abstract readFileText(filePath: string, maxBytes: number): Promise<ReadFileTextResult>;
    abstract uploadFile(filePath: string, fileStream: Readable, overwrite: boolean): Promise<UploadFileResult>;
    abstract moveFile(sourcePath: string, destPath: string, overwrite: boolean): Promise<MoveFileResult>;
    abstract deleteFile(filePath: string): Promise<DeleteFileResult>;
    abstract createFolder(folderPath: string): Promise<CreateFolderResult>;
    abstract fileExists(filePath: string): Promise<boolean>;
}
