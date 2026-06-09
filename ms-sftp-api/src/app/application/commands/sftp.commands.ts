import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Logger } from 'nestjs-pino';

// Domain
import { ISftpClientService } from '@domain/ports/sftp-client-service.port';
import { SftpConnectionValueObject, ISftpConnection } from '@domain/value-objects/sftp-connection.value-object';
import { FilePathValueObject } from '@domain/value-objects/file-path.value-object';
import { SftpDownloadToLocalResult } from '@domain/results/sftp-download-to-local.result';
import { SftpMoveFileResult } from '@domain/results/sftp-move-file.result';
import { SftpDeleteFileResult } from '@domain/results/sftp-delete-file.result';
import { StorageConfigService } from '@config/storage/storage-config.service';

// ─────────────────────────────────────────────────────────────
// SftpDownloadToLocal
// ─────────────────────────────────────────────────────────────

export interface ISftpDownloadToLocalCommand {
    connection: ISftpConnection;
    remotePath: string;
    localPath: string;
    overwrite: boolean;
}

export class SftpDownloadToLocalCommand {
    constructor(private readonly parameters: ISftpDownloadToLocalCommand) {}

    get connection(): ISftpConnection {
        return this.parameters.connection;
    }

    get remotePath(): string {
        return this.parameters.remotePath;
    }

    get localPath(): string {
        return this.parameters.localPath;
    }

    get overwrite(): boolean {
        return this.parameters.overwrite;
    }
}

@CommandHandler(SftpDownloadToLocalCommand)
export class SftpDownloadToLocalHandler implements ICommandHandler<
    SftpDownloadToLocalCommand,
    SftpDownloadToLocalResult
> {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly sftpClientService: ISftpClientService,
        private readonly storageConfig: StorageConfigService,
    ) {}

    async execute(command: SftpDownloadToLocalCommand): Promise<SftpDownloadToLocalResult> {
        const startTime = Date.now();
        const connection = new SftpConnectionValueObject(command.connection);
        const localFilePath = new FilePathValueObject(command.localPath, this.storageConfig.basePath);

        const result = await this.sftpClientService.downloadToLocal(
            connection,
            command.remotePath,
            localFilePath.absolutePath,
            command.overwrite,
        );

        this.logger.log({
            msg: 'SFTP file downloaded to local',
            host: command.connection.host,
            remotePath: command.remotePath,
            localPath: command.localPath,
            sizeBytes: result.size,
            durationMs: Date.now() - startTime,
        });
        return result;
    }
}

// ─────────────────────────────────────────────────────────────
// SftpMoveFile
// ─────────────────────────────────────────────────────────────

export interface ISftpMoveFileCommand {
    connection: ISftpConnection;
    sourcePath: string;
    destinationPath: string;
}

export class SftpMoveFileCommand {
    constructor(private readonly parameters: ISftpMoveFileCommand) {}

    get connection(): ISftpConnection {
        return this.parameters.connection;
    }

    get sourcePath(): string {
        return this.parameters.sourcePath;
    }

    get destinationPath(): string {
        return this.parameters.destinationPath;
    }
}

@CommandHandler(SftpMoveFileCommand)
export class SftpMoveFileHandler implements ICommandHandler<SftpMoveFileCommand, SftpMoveFileResult> {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly sftpClientService: ISftpClientService,
    ) {}

    async execute(command: SftpMoveFileCommand): Promise<SftpMoveFileResult> {
        const startTime = Date.now();
        const connection = new SftpConnectionValueObject(command.connection);
        const result = await this.sftpClientService.moveFile(connection, command.sourcePath, command.destinationPath);

        this.logger.log({
            msg: 'SFTP file moved',
            host: command.connection.host,
            sourcePath: command.sourcePath,
            destinationPath: command.destinationPath,
            durationMs: Date.now() - startTime,
        });
        return result;
    }
}

// ─────────────────────────────────────────────────────────────
// SftpDeleteFile
// ─────────────────────────────────────────────────────────────

export interface ISftpDeleteFileCommand {
    connection: ISftpConnection;
    path: string;
}

export class SftpDeleteFileCommand {
    constructor(private readonly parameters: ISftpDeleteFileCommand) {}

    get connection(): ISftpConnection {
        return this.parameters.connection;
    }

    get path(): string {
        return this.parameters.path;
    }
}

@CommandHandler(SftpDeleteFileCommand)
export class SftpDeleteFileHandler implements ICommandHandler<SftpDeleteFileCommand, SftpDeleteFileResult> {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly sftpClientService: ISftpClientService,
    ) {}

    async execute(command: SftpDeleteFileCommand): Promise<SftpDeleteFileResult> {
        const startTime = Date.now();
        const connection = new SftpConnectionValueObject(command.connection);
        const result = await this.sftpClientService.deleteFile(connection, command.path);

        this.logger.log({
            msg: 'SFTP file deleted',
            host: command.connection.host,
            path: command.path,
            durationMs: Date.now() - startTime,
        });
        return result;
    }
}
