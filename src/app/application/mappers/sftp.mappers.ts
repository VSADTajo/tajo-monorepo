import {
    SftpListFilesRequestDto,
    SftpListFilesResponseDto,
    RemoteFileInfoDto,
    SftpDownloadFileRequestDto,
    SftpDownloadToLocalRequestDto,
    SftpDownloadToLocalResponseDto,
    SftpMoveFileRequestDto,
    SftpMoveFileResponseDto,
    SftpDeleteFileRequestDto,
    SftpDeleteFileResponseDto,
} from '@api/dtos/sftp.dtos';
import { SftpListFilesQuery, SftpDownloadFileQuery } from '@application/queries/sftp.queries';
import {
    SftpDownloadToLocalCommand,
    SftpMoveFileCommand,
    SftpDeleteFileCommand,
} from '@application/commands/sftp.commands';
import { SftpListFilesResult } from '@domain/results/sftp-list-files.result';
import { SftpDownloadToLocalResult } from '@domain/results/sftp-download-to-local.result';
import { SftpMoveFileResult } from '@domain/results/sftp-move-file.result';
import { SftpDeleteFileResult } from '@domain/results/sftp-delete-file.result';
import { StorageConfigService } from '@config/storage/storage-config.service';
import * as path from 'node:path';

// ─────────────────────────────────────────────────────────────
// SftpListFiles
// ─────────────────────────────────────────────────────────────

export class SftpListFilesMapper {
    static toQuery(dto: SftpListFilesRequestDto): SftpListFilesQuery {
        return new SftpListFilesQuery({ connection: dto.connection, directory: dto.directory });
    }

    static toResponseDto(result: SftpListFilesResult): SftpListFilesResponseDto {
        return {
            directory: result.directory,
            files: result.files.map(
                (f): RemoteFileInfoDto => ({
                    name: f.name,
                    path: f.path,
                    size: f.size,
                    modifiedAt: f.modifiedAt,
                    isDirectory: f.isDirectory,
                }),
            ),
        };
    }
}

// ─────────────────────────────────────────────────────────────
// SftpDownloadFile
// ─────────────────────────────────────────────────────────────

export class SftpDownloadFileMapper {
    static toQuery(dto: SftpDownloadFileRequestDto): SftpDownloadFileQuery {
        return new SftpDownloadFileQuery({ connection: dto.connection, path: dto.path });
    }
}

// ─────────────────────────────────────────────────────────────
// SftpDownloadToLocal
// ─────────────────────────────────────────────────────────────

export class SftpDownloadToLocalMapper {
    static toCommand(dto: SftpDownloadToLocalRequestDto): SftpDownloadToLocalCommand {
        return new SftpDownloadToLocalCommand({
            connection: dto.connection,
            remotePath: dto.remotePath,
            localPath: dto.localPath,
            overwrite: dto.overwrite ?? false,
        });
    }

    static toResponseDto(
        result: SftpDownloadToLocalResult,
        storageConfig: StorageConfigService,
    ): SftpDownloadToLocalResponseDto {
        return {
            remotePath: result.remotePath,
            localPath: path.relative(storageConfig.basePath, result.localPath),
            size: result.size,
        };
    }
}

// ─────────────────────────────────────────────────────────────
// SftpMoveFile
// ─────────────────────────────────────────────────────────────

export class SftpMoveFileMapper {
    static toCommand(dto: SftpMoveFileRequestDto): SftpMoveFileCommand {
        return new SftpMoveFileCommand({
            connection: dto.connection,
            sourcePath: dto.sourcePath,
            destinationPath: dto.destinationPath,
        });
    }

    static toResponseDto(result: SftpMoveFileResult): SftpMoveFileResponseDto {
        return { sourcePath: result.sourcePath, destinationPath: result.destinationPath };
    }
}

// ─────────────────────────────────────────────────────────────
// SftpDeleteFile
// ─────────────────────────────────────────────────────────────

export class SftpDeleteFileMapper {
    static toCommand(dto: SftpDeleteFileRequestDto): SftpDeleteFileCommand {
        return new SftpDeleteFileCommand({ connection: dto.connection, path: dto.path });
    }

    static toResponseDto(result: SftpDeleteFileResult): SftpDeleteFileResponseDto {
        return { deletedPath: result.deletedPath };
    }
}
