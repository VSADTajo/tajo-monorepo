import { Readable } from 'node:stream';
import {
    UploadFileResponseDto,
    ListFilesResponseDto,
    FileInfoDto,
    MoveFileRequestDto,
    MoveFileResponseDto,
    DeleteFileResponseDto,
    ListPathsOverviewResponseDto,
    PathOverviewDto,
    PathSchemaInfoDto,
    PathCleanupJobInfoDto,
    ReadFileTextResponseDto,
} from '@api/dtos/file.dtos';
import { UploadFileCommand } from '@application/commands/file.commands';
import { MoveFileCommand } from '@application/commands/file.commands';
import { DeleteFileCommand } from '@application/commands/file.commands';
import {
    ListFilesQuery,
    DownloadFileQuery,
    ReadFileTextQuery,
    IReadFileTextResult,
    ListPathsOverviewQuery,
    IListPathsOverviewResult,
} from '@application/queries/file.queries';
import { UploadFileResult } from '@domain/results/upload-file.result';
import { ListFilesResult } from '@domain/results/list-files.result';
import { MoveFileResult } from '@domain/results/move-file.result';
import { DeleteFileResult } from '@domain/results/delete-file.result';

// ─────────────────────────────────────────────────────────────
// ListPathsOverview
// ─────────────────────────────────────────────────────────────

export class ListPathsOverviewMapper {
    static toQuery(): ListPathsOverviewQuery {
        return new ListPathsOverviewQuery();
    }

    static toResponseDto(result: IListPathsOverviewResult): ListPathsOverviewResponseDto {
        return {
            paths: result.paths.map(
                (p): PathOverviewDto => ({
                    path: p.path,
                    displayPath: p.displayPath,
                    canListFiles: p.canListFiles,
                    schema: p.schema
                        ? ({
                              id: p.schema.id,
                              name: p.schema.name,
                              isActive: p.schema.isActive,
                              inputFormat: p.schema.inputFormat,
                              outputFormat: p.schema.outputFormat,
                          } as PathSchemaInfoDto)
                        : null,
                    cleanupJob: p.cleanupJob
                        ? ({
                              id: p.cleanupJob.id,
                              extensions: p.cleanupJob.extensions,
                              frequency: p.cleanupJob.frequency,
                              frequencyLabel: p.cleanupJob.frequencyLabel,
                              isActive: p.cleanupJob.isActive,
                              nextExecutionAt: p.cleanupJob.nextExecutionAt
                                  ? p.cleanupJob.nextExecutionAt instanceof Date
                                      ? p.cleanupJob.nextExecutionAt.toISOString()
                                      : String(p.cleanupJob.nextExecutionAt)
                                  : null,
                              lastExecutedAt: p.cleanupJob.lastExecutedAt
                                  ? p.cleanupJob.lastExecutedAt instanceof Date
                                      ? p.cleanupJob.lastExecutedAt.toISOString()
                                      : String(p.cleanupJob.lastExecutedAt)
                                  : null,
                              lastExecutionResult: p.cleanupJob.lastExecutionResult ?? null,
                          } as PathCleanupJobInfoDto)
                        : null,
                }),
            ),
        };
    }
}

// ─────────────────────────────────────────────────────────────
// UploadFile
// ─────────────────────────────────────────────────────────────

export class UploadFileMapper {
    static toCommand(path: string, fileStream: Readable, overwrite: boolean): UploadFileCommand {
        return new UploadFileCommand({ path, fileStream, overwrite });
    }

    static toResponseDto(result: UploadFileResult): UploadFileResponseDto {
        return { path: result.path, size: result.size };
    }
}

// ─────────────────────────────────────────────────────────────
// ListFiles
// ─────────────────────────────────────────────────────────────

export class ListFilesMapper {
    static toQuery(directory: string): ListFilesQuery {
        return new ListFilesQuery(directory);
    }

    static toResponseDto(result: ListFilesResult): ListFilesResponseDto {
        return {
            directory: result.directory,
            files: result.files.map(
                (f): FileInfoDto => ({
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
// DownloadFile
// ─────────────────────────────────────────────────────────────

export class DownloadFileMapper {
    static toQuery(path: string): DownloadFileQuery {
        return new DownloadFileQuery(path);
    }
}

// ─────────────────────────────────────────────────────────────
// ReadFileText
// ─────────────────────────────────────────────────────────────

export class ReadFileTextMapper {
    static toQuery(path: string): ReadFileTextQuery {
        return new ReadFileTextQuery(path);
    }

    static toResponseDto(result: IReadFileTextResult): ReadFileTextResponseDto {
        return {
            path: result.path,
            size: result.size,
            modifiedAt: result.modifiedAt,
            content: result.content,
        };
    }
}

// ─────────────────────────────────────────────────────────────
// MoveFile
// ─────────────────────────────────────────────────────────────

export class MoveFileMapper {
    static toCommand(dto: MoveFileRequestDto): MoveFileCommand {
        return new MoveFileCommand({
            sourcePath: dto.sourcePath,
            destinationPath: dto.destinationPath,
            overwrite: dto.overwrite ?? false,
        });
    }

    static toResponseDto(result: MoveFileResult): MoveFileResponseDto {
        return { sourcePath: result.sourcePath, destinationPath: result.destinationPath };
    }
}

// ─────────────────────────────────────────────────────────────
// DeleteFile
// ─────────────────────────────────────────────────────────────

export class DeleteFileMapper {
    static toCommand(path: string): DeleteFileCommand {
        return new DeleteFileCommand({ path });
    }

    static toResponseDto(result: DeleteFileResult): DeleteFileResponseDto {
        return { deletedPath: result.deletedPath };
    }
}
