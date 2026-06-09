import { SftpConnectionValueObject } from '@domain/value-objects/sftp-connection.value-object';
import { SftpListFilesResult } from '@domain/results/sftp-list-files.result';
import { SftpDownloadFileResult } from '@domain/results/sftp-download-file.result';
import { SftpDownloadToLocalResult } from '@domain/results/sftp-download-to-local.result';
import { SftpMoveFileResult } from '@domain/results/sftp-move-file.result';
import { SftpDeleteFileResult } from '@domain/results/sftp-delete-file.result';

export abstract class ISftpClientService {
    abstract listFiles(connection: SftpConnectionValueObject, directoryPath: string): Promise<SftpListFilesResult>;
    abstract downloadFile(connection: SftpConnectionValueObject, filePath: string): Promise<SftpDownloadFileResult>;
    abstract downloadToLocal(
        connection: SftpConnectionValueObject,
        remotePath: string,
        localPath: string,
        overwrite: boolean,
    ): Promise<SftpDownloadToLocalResult>;
    abstract moveFile(
        connection: SftpConnectionValueObject,
        sourcePath: string,
        destPath: string,
    ): Promise<SftpMoveFileResult>;
    abstract deleteFile(connection: SftpConnectionValueObject, filePath: string): Promise<SftpDeleteFileResult>;
}
