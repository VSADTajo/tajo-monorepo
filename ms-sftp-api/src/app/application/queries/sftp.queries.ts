import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Logger } from 'nestjs-pino';

// Domain
import { ISftpClientService } from '@domain/ports/sftp-client-service.port';
import { SftpConnectionValueObject, ISftpConnection } from '@domain/value-objects/sftp-connection.value-object';
import { SftpListFilesResult } from '@domain/results/sftp-list-files.result';
import { SftpDownloadFileResult } from '@domain/results/sftp-download-file.result';

// ─────────────────────────────────────────────────────────────
// SftpListFiles
// ─────────────────────────────────────────────────────────────

export interface ISftpListFilesQuery {
    connection: ISftpConnection;
    directory: string;
}

export class SftpListFilesQuery {
    constructor(private readonly parameters: ISftpListFilesQuery) {}

    get connection(): ISftpConnection {
        return this.parameters.connection;
    }

    get directory(): string {
        return this.parameters.directory;
    }
}

@QueryHandler(SftpListFilesQuery)
export class SftpListFilesHandler implements IQueryHandler<SftpListFilesQuery, SftpListFilesResult> {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly sftpClientService: ISftpClientService,
    ) {}

    async execute(query: SftpListFilesQuery): Promise<SftpListFilesResult> {
        this.logger.debug(`SFTP list files: ${query.connection.host}:${query.directory}`);

        const connection = new SftpConnectionValueObject(query.connection);
        return this.sftpClientService.listFiles(connection, query.directory);
    }
}

// ─────────────────────────────────────────────────────────────
// SftpDownloadFile
// ─────────────────────────────────────────────────────────────

export interface ISftpDownloadFileQuery {
    connection: ISftpConnection;
    path: string;
}

export class SftpDownloadFileQuery {
    constructor(private readonly parameters: ISftpDownloadFileQuery) {}

    get connection(): ISftpConnection {
        return this.parameters.connection;
    }

    get path(): string {
        return this.parameters.path;
    }
}

@QueryHandler(SftpDownloadFileQuery)
export class SftpDownloadFileHandler implements IQueryHandler<SftpDownloadFileQuery, SftpDownloadFileResult> {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly sftpClientService: ISftpClientService,
    ) {}

    async execute(query: SftpDownloadFileQuery): Promise<SftpDownloadFileResult> {
        this.logger.debug(`SFTP download file: ${query.connection.host}:${query.path}`);

        const connection = new SftpConnectionValueObject(query.connection);
        return this.sftpClientService.downloadFile(connection, query.path);
    }
}
