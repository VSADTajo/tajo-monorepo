import { Injectable, Inject } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import * as fs from 'node:fs/promises';
import * as fsSync from 'node:fs';
import * as path from 'node:path';
import { Readable } from 'node:stream';

import { IFileStorageService, ReadFileTextResult } from '@domain/ports/file-storage-service.port';
import { ListFilesResult, FileInfoResult } from '@domain/results/list-files.result';
import { DownloadFileResult } from '@domain/results/download-file.result';
import { UploadFileResult } from '@domain/results/upload-file.result';
import { MoveFileResult } from '@domain/results/move-file.result';
import { DeleteFileResult } from '@domain/results/delete-file.result';
import { CreateFolderResult } from '@domain/results/create-folder.result';
import { ApiError } from '@domain/errors/api.error';
import { ProviderError } from '@domain/errors/provider.error';
import { StorageConfigService } from '@config/storage/storage-config.service';

@Injectable()
export class LocalFileStorageService extends IFileStorageService {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly storageConfig: StorageConfigService,
    ) {
        super();
    }

    async listFiles(directoryPath: string): Promise<ListFilesResult> {
        this.logger.log(`Listing files in: ${directoryPath}`);

        try {
            const entries = await fs.readdir(directoryPath, { withFileTypes: true });
            const files: FileInfoResult[] = [];

            for (const entry of entries) {
                const fullPath = path.join(directoryPath, entry.name);
                const stats = await fs.stat(fullPath);
                const relativePath = path.relative(this.storageConfig.basePath, fullPath);

                files.push(
                    new FileInfoResult({
                        name: entry.name,
                        path: relativePath,
                        size: stats.size,
                        modifiedAt: stats.mtime.toISOString(),
                        isDirectory: entry.isDirectory(),
                    }),
                );
            }

            const relativeDir = path.relative(this.storageConfig.basePath, directoryPath);
            return new ListFilesResult({ directory: relativeDir || '.', files });
        } catch (error: unknown) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
                const relativeDir = path.relative(this.storageConfig.basePath, directoryPath);
                return new ListFilesResult({ directory: relativeDir || '.', files: [] });
            }
            this.handleFsError(error, directoryPath);
        }
    }

    async readFileText(filePath: string, maxBytes: number): Promise<ReadFileTextResult> {
        this.logger.log(`Reading text file: ${filePath} (max ${maxBytes} bytes)`);

        try {
            const stats = await fs.stat(filePath);

            if (stats.isDirectory()) {
                throw new ApiError(
                    400,
                    `Path is a directory, not a file: ${path.relative(this.storageConfig.basePath, filePath)}`,
                );
            }

            if (stats.size > maxBytes) {
                throw new ApiError(413, `File too large for text read: ${stats.size} bytes (max ${maxBytes})`);
            }

            const content = await fs.readFile(filePath, 'utf8');

            return {
                content,
                size: stats.size,
                modifiedAt: stats.mtime.toISOString(),
            };
        } catch (error: unknown) {
            if (error instanceof ApiError) {
                throw error;
            }
            this.handleFsError(error, filePath);
        }
    }

    async downloadFile(filePath: string): Promise<DownloadFileResult> {
        this.logger.log(`Downloading file: ${filePath}`);

        try {
            const stats = await fs.stat(filePath);

            if (stats.isDirectory()) {
                throw new ApiError(
                    400,
                    `Path is a directory, not a file: ${path.relative(this.storageConfig.basePath, filePath)}`,
                );
            }

            const stream = fsSync.createReadStream(filePath);
            const fileName = path.basename(filePath);

            return new DownloadFileResult({
                stream,
                fileName,
                size: stats.size,
            });
        } catch (error: unknown) {
            if (error instanceof ApiError) throw error;
            this.handleFsError(error, filePath);
        }
    }

    async uploadFile(filePath: string, fileStream: Readable, overwrite: boolean): Promise<UploadFileResult> {
        this.logger.log(`Uploading file to: ${filePath}`);

        if (!overwrite) {
            const exists = await this.fileExists(filePath);
            if (exists) {
                const relativePath = path.relative(this.storageConfig.basePath, filePath);
                throw new ApiError(409, `File already exists at path: ${relativePath}`);
            }
        }

        try {
            const dir = path.dirname(filePath);
            await fs.mkdir(dir, { recursive: true });

            const writeStream = fsSync.createWriteStream(filePath);
            await new Promise<void>((resolve, reject) => {
                fileStream.pipe(writeStream);
                writeStream.on('finish', resolve);
                writeStream.on('error', reject);
                fileStream.on('error', reject);
            });

            const stats = await fs.stat(filePath);
            const relativePath = path.relative(this.storageConfig.basePath, filePath);

            return new UploadFileResult({ path: relativePath, size: stats.size });
        } catch (error: unknown) {
            if (error instanceof ApiError) throw error;
            // Clean up partial file on error
            try {
                await fs.unlink(filePath);
            } catch {
                // Ignore cleanup errors
            }
            this.handleFsError(error, filePath);
        }
    }

    async moveFile(sourcePath: string, destPath: string, overwrite: boolean): Promise<MoveFileResult> {
        this.logger.log(`Moving file from ${sourcePath} to ${destPath}`);

        const sourceExists = await this.fileExists(sourcePath);
        if (!sourceExists) {
            const relativeSrc = path.relative(this.storageConfig.basePath, sourcePath);
            throw new ApiError(404, `Source file not found: ${relativeSrc}`);
        }

        if (!overwrite) {
            const destExists = await this.fileExists(destPath);
            if (destExists) {
                const relativeDest = path.relative(this.storageConfig.basePath, destPath);
                throw new ApiError(409, `File already exists at destination: ${relativeDest}`);
            }
        }

        try {
            const destDir = path.dirname(destPath);
            await fs.mkdir(destDir, { recursive: true });
            await fs.rename(sourcePath, destPath);

            const relativeSource = path.relative(this.storageConfig.basePath, sourcePath);
            const relativeDest = path.relative(this.storageConfig.basePath, destPath);

            return new MoveFileResult({ sourcePath: relativeSource, destinationPath: relativeDest });
        } catch (error: unknown) {
            if (error instanceof ApiError) throw error;
            this.handleFsError(error, sourcePath);
        }
    }

    async createFolder(folderPath: string): Promise<CreateFolderResult> {
        this.logger.log(`Creating folder: ${folderPath}`);

        try {
            // recursive mkdir is idempotent: no error if the folder already exists.
            await fs.mkdir(folderPath, { recursive: true });
            const relativePath = path.relative(this.storageConfig.basePath, folderPath);
            return new CreateFolderResult({ path: relativePath });
        } catch (error: unknown) {
            return this.handleFsError(error, folderPath);
        }
    }

    async deleteFile(filePath: string): Promise<DeleteFileResult> {
        this.logger.log(`Deleting file: ${filePath}`);

        const exists = await this.fileExists(filePath);
        if (!exists) {
            const relativePath = path.relative(this.storageConfig.basePath, filePath);
            throw new ApiError(404, `File not found: ${relativePath}`);
        }

        try {
            await fs.unlink(filePath);
            const relativePath = path.relative(this.storageConfig.basePath, filePath);
            return new DeleteFileResult({ deletedPath: relativePath });
        } catch (error: unknown) {
            if (error instanceof ApiError) throw error;
            this.handleFsError(error, filePath);
        }
    }

    async fileExists(filePath: string): Promise<boolean> {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    private handleFsError(error: unknown, filePath: string): never {
        const fsError = error as NodeJS.ErrnoException;
        const relativePath = path.relative(this.storageConfig.basePath, filePath);

        switch (fsError.code) {
            case 'ENOENT':
                throw new ApiError(404, `File or directory not found: ${relativePath}`);
            case 'EEXIST':
                throw new ApiError(409, `File already exists: ${relativePath}`);
            case 'EACCES':
                throw new ApiError(403, `Permission denied: ${relativePath}`);
            case 'ENOSPC':
                throw new ApiError(500, 'Disk full: unable to complete operation');
            default:
                this.logger.error(`Filesystem error: ${fsError.message}`, fsError.stack);
                throw new ProviderError(`Storage operation failed: ${fsError.message}`);
        }
    }
}
