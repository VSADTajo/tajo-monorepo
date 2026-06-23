import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Logger } from 'nestjs-pino';
import { Readable } from 'node:stream';
import * as path from 'node:path';

// Domain
import { IFileStorageService } from '@domain/ports/file-storage-service.port';
import { ICacheService } from '@domain/ports/cache-service.port';
import { FilePathValueObject } from '@domain/value-objects/file-path.value-object';
import { UploadFileResult } from '@domain/results/upload-file.result';
import { MoveFileResult } from '@domain/results/move-file.result';
import { DeleteFileResult } from '@domain/results/delete-file.result';
import { CreateFolderResult } from '@domain/results/create-folder.result';
import { StorageConfigService } from '@config/storage/storage-config.service';

// Cache
import { FileCacheKeys } from '@infrastructure/cache/cache-config.registry';

// ─────────────────────────────────────────────────────────────
// UploadFile
// ─────────────────────────────────────────────────────────────

export interface IUploadFileCommand {
    path: string;
    fileStream: Readable;
    overwrite: boolean;
}

export class UploadFileCommand {
    constructor(private readonly parameters: IUploadFileCommand) {}

    get path(): string {
        return this.parameters.path;
    }

    get fileStream(): Readable {
        return this.parameters.fileStream;
    }

    get overwrite(): boolean {
        return this.parameters.overwrite;
    }
}

@CommandHandler(UploadFileCommand)
export class UploadFileHandler implements ICommandHandler<UploadFileCommand, UploadFileResult> {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly fileStorageService: IFileStorageService,
        private readonly storageConfig: StorageConfigService,
        private readonly cacheService: ICacheService,
    ) {}

    async execute(command: UploadFileCommand): Promise<UploadFileResult> {
        const startTime = Date.now();
        const filePath = new FilePathValueObject(command.path, this.storageConfig.basePath);
        const result = await this.fileStorageService.uploadFile(
            filePath.absolutePath,
            command.fileStream,
            command.overwrite,
        );

        // Invalidate directory listing cache
        const directory = path.dirname(command.path);
        await this.cacheService.del(FileCacheKeys.list(directory));

        this.logger.log({
            msg: 'File uploaded',
            path: command.path,
            sizeBytes: result.size,
            durationMs: Date.now() - startTime,
        });
        return result;
    }
}

// ─────────────────────────────────────────────────────────────
// MoveFile
// ─────────────────────────────────────────────────────────────

export interface IMoveFileCommand {
    sourcePath: string;
    destinationPath: string;
    overwrite: boolean;
}

export class MoveFileCommand {
    constructor(private readonly parameters: IMoveFileCommand) {}

    get sourcePath(): string {
        return this.parameters.sourcePath;
    }

    get destinationPath(): string {
        return this.parameters.destinationPath;
    }

    get overwrite(): boolean {
        return this.parameters.overwrite;
    }
}

@CommandHandler(MoveFileCommand)
export class MoveFileHandler implements ICommandHandler<MoveFileCommand, MoveFileResult> {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly fileStorageService: IFileStorageService,
        private readonly storageConfig: StorageConfigService,
        private readonly cacheService: ICacheService,
    ) {}

    async execute(command: MoveFileCommand): Promise<MoveFileResult> {
        const startTime = Date.now();
        const source = new FilePathValueObject(command.sourcePath, this.storageConfig.basePath);
        const dest = new FilePathValueObject(command.destinationPath, this.storageConfig.basePath);

        const result = await this.fileStorageService.moveFile(
            source.absolutePath,
            dest.absolutePath,
            command.overwrite,
        );

        // Invalidate directory listing cache for both source and destination
        const sourceDir = path.dirname(command.sourcePath);
        const destDir = path.dirname(command.destinationPath);
        await this.cacheService.del(FileCacheKeys.list(sourceDir));
        if (sourceDir !== destDir) {
            await this.cacheService.del(FileCacheKeys.list(destDir));
        }

        this.logger.log({
            msg: 'File moved',
            sourcePath: command.sourcePath,
            destinationPath: command.destinationPath,
            durationMs: Date.now() - startTime,
        });
        return result;
    }
}

// ─────────────────────────────────────────────────────────────
// DeleteFile
// ─────────────────────────────────────────────────────────────

export interface IDeleteFileCommand {
    path: string;
}

export class DeleteFileCommand {
    constructor(private readonly parameters: IDeleteFileCommand) {}

    get path(): string {
        return this.parameters.path;
    }
}

@CommandHandler(DeleteFileCommand)
export class DeleteFileHandler implements ICommandHandler<DeleteFileCommand, DeleteFileResult> {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly fileStorageService: IFileStorageService,
        private readonly storageConfig: StorageConfigService,
        private readonly cacheService: ICacheService,
    ) {}

    async execute(command: DeleteFileCommand): Promise<DeleteFileResult> {
        const startTime = Date.now();
        const filePath = new FilePathValueObject(command.path, this.storageConfig.basePath);
        const result = await this.fileStorageService.deleteFile(filePath.absolutePath);

        // Invalidate directory listing cache
        const directory = path.dirname(command.path);
        await this.cacheService.del(FileCacheKeys.list(directory));

        this.logger.log({
            msg: 'File deleted',
            path: command.path,
            durationMs: Date.now() - startTime,
        });
        return result;
    }
}

// ─────────────────────────────────────────────────────────────
// CreateFolder
// ─────────────────────────────────────────────────────────────

export interface ICreateFolderCommand {
    path: string;
}

export class CreateFolderCommand {
    constructor(private readonly parameters: ICreateFolderCommand) {}

    get path(): string {
        return this.parameters.path;
    }
}

@CommandHandler(CreateFolderCommand)
export class CreateFolderHandler implements ICommandHandler<CreateFolderCommand, CreateFolderResult> {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly fileStorageService: IFileStorageService,
        private readonly storageConfig: StorageConfigService,
        private readonly cacheService: ICacheService,
    ) {}

    async execute(command: CreateFolderCommand): Promise<CreateFolderResult> {
        const startTime = Date.now();
        const folder = new FilePathValueObject(command.path, this.storageConfig.basePath);
        const result = await this.fileStorageService.createFolder(folder.absolutePath);

        // Invalidate the parent directory listing + paths overview caches
        const parent = path.dirname(command.path);
        await this.cacheService.del(FileCacheKeys.list(parent));
        await this.cacheService.del(FileCacheKeys.pathsOverview());

        this.logger.log({
            msg: 'Folder created',
            path: command.path,
            durationMs: Date.now() - startTime,
        });
        return result;
    }
}
