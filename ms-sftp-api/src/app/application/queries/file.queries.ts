import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Logger } from 'nestjs-pino';
import * as nodePath from 'node:path';

// Domain
import { IFileStorageService } from '@domain/ports/file-storage-service.port';
import { FilePathValueObject } from '@domain/value-objects/file-path.value-object';
import { ListFilesResult } from '@domain/results/list-files.result';
import { DownloadFileResult } from '@domain/results/download-file.result';
import { StorageConfigService } from '@config/storage/storage-config.service';
import { ISftpUserRepository } from '@domain/ports/sftp-user-repository.port';
import { IMappingSchemaRepository } from '@domain/ports/mapping-schema-repository.port';
import { ICleanupJobRepository } from '@domain/ports/cleanup-job-repository.port';
import { MappingSchema } from '@domain/entities/mapping-schema.entity';
import { CleanupJob } from '@domain/entities/cleanup-job.entity';

// ─────────────────────────────────────────────────────────────
// ListPathsOverview
// ─────────────────────────────────────────────────────────────

export interface ICleanupJobOverviewInfo {
    id: string;
    extensions: string[];
    frequency: string;
    frequencyLabel: string;
    isActive: boolean;
    nextExecutionAt: Date | null;
    lastExecutedAt: Date | null;
    lastExecutionResult: { filesDeleted: number; error?: string } | null;
}

export interface IPathOverviewResult {
    path: string;
    displayPath: string;
    canListFiles: boolean;
    schema: MappingSchema | null;
    cleanupJob: ICleanupJobOverviewInfo | null;
}

export interface IListPathsOverviewResult {
    paths: IPathOverviewResult[];
}

export class ListPathsOverviewQuery {}

@QueryHandler(ListPathsOverviewQuery)
export class ListPathsOverviewHandler implements IQueryHandler<ListPathsOverviewQuery, IListPathsOverviewResult> {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly sftpUserRepository: ISftpUserRepository,
        private readonly mappingSchemaRepository: IMappingSchemaRepository,
        private readonly cleanupJobRepository: ICleanupJobRepository,
        private readonly storageConfig: StorageConfigService,
    ) {}

    async execute(_query: ListPathsOverviewQuery): Promise<IListPathsOverviewResult> {
        this.logger.debug('Listing paths overview');
        _query;

        const [users, schemas] = await Promise.all([
            this.sftpUserRepository.findAll(),
            this.mappingSchemaRepository.findAll(),
        ]);

        const basePath = this.storageConfig.basePath;

        // Build schema lookup by absolute directoryPath
        const schemaByAbsPath = new Map<string, MappingSchema>();
        schemas.forEach((s) => schemaByAbsPath.set(s.directoryPath, s));

        // Collect unique paths keyed by their normalized absolute form
        const pathMap = new Map<string, IPathOverviewResult>();

        // From mapping schemas (always absolute, always start with '/')
        schemas.forEach((s) => {
            if (!pathMap.has(s.directoryPath)) {
                const relative = nodePath.relative(basePath, s.directoryPath);
                const canListFiles = !relative.startsWith('..');
                pathMap.set(s.directoryPath, {
                    path: s.directoryPath,
                    displayPath: s.directoryPath,
                    canListFiles,
                    schema: s,
                    cleanupJob: null,
                });
            }
        });

        // From SFTP users (rootDirectory may be absolute or relative)
        users.forEach((u) => {
            const raw = u.rootDirectory;
            const absoluteKey = raw.startsWith('/') ? raw : nodePath.resolve(basePath, raw);

            if (!pathMap.has(absoluteKey)) {
                const relative = raw.startsWith('/') ? nodePath.relative(basePath, raw) : raw;
                const canListFiles = !relative.startsWith('..');
                pathMap.set(absoluteKey, {
                    path: absoluteKey,
                    displayPath: raw,
                    canListFiles,
                    schema: schemaByAbsPath.get(absoluteKey) ?? null,
                    cleanupJob: null,
                });
            }
        });

        // Attach cleanup job info to each path
        const absolutePaths = [...pathMap.keys()];
        if (absolutePaths.length > 0) {
            const cleanupJobs = await this.cleanupJobRepository.findByDirectoryPaths(absolutePaths);
            const jobByPath = new Map<string, CleanupJob>();
            cleanupJobs.forEach((j) => jobByPath.set(j.directoryPath, j));

            pathMap.forEach((entry, absPath) => {
                const job = jobByPath.get(absPath);
                if (job) {
                    entry.cleanupJob = {
                        id: job.id,
                        extensions: job.extensions,
                        frequency: job.frequency,
                        frequencyLabel: job.frequencyLabel,
                        isActive: job.isActive,
                        nextExecutionAt: job.nextExecutionAt ?? null,
                        lastExecutedAt: job.lastExecutedAt ?? null,
                        lastExecutionResult: job.lastExecutionResult ?? null,
                    };
                }
            });
        }

        const paths = [...pathMap.values()].sort((a, b) => a.displayPath.localeCompare(b.displayPath));

        return { paths };
    }
}

// ─────────────────────────────────────────────────────────────
// ListFiles
// ─────────────────────────────────────────────────────────────

export class ListFilesQuery {
    constructor(public readonly directory: string) {}
}

@QueryHandler(ListFilesQuery)
export class ListFilesHandler implements IQueryHandler<ListFilesQuery, ListFilesResult> {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly fileStorageService: IFileStorageService,
        private readonly storageConfig: StorageConfigService,
    ) {}

    async execute(query: ListFilesQuery): Promise<ListFilesResult> {
        this.logger.debug(`Listing files in directory: ${query.directory}`);

        const dirPath = new FilePathValueObject(query.directory, this.storageConfig.basePath);
        return this.fileStorageService.listFiles(dirPath.absolutePath);
    }
}

// ─────────────────────────────────────────────────────────────
// DownloadFile
// ─────────────────────────────────────────────────────────────

export class DownloadFileQuery {
    constructor(public readonly path: string) {}
}

@QueryHandler(DownloadFileQuery)
export class DownloadFileHandler implements IQueryHandler<DownloadFileQuery, DownloadFileResult> {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly fileStorageService: IFileStorageService,
        private readonly storageConfig: StorageConfigService,
    ) {}

    async execute(query: DownloadFileQuery): Promise<DownloadFileResult> {
        this.logger.debug(`Downloading file: ${query.path}`);

        const filePath = new FilePathValueObject(query.path, this.storageConfig.basePath);
        return this.fileStorageService.downloadFile(filePath.absolutePath);
    }
}

// ─────────────────────────────────────────────────────────────
// ReadFileText
// ─────────────────────────────────────────────────────────────

const READ_FILE_TEXT_MAX_BYTES = 1_048_576; // 1 MB

export interface IReadFileTextResult {
    path: string;
    content: string;
    size: number;
    modifiedAt: string;
}

export class ReadFileTextQuery {
    constructor(public readonly path: string) {}
}

@QueryHandler(ReadFileTextQuery)
export class ReadFileTextHandler implements IQueryHandler<ReadFileTextQuery, IReadFileTextResult> {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly fileStorageService: IFileStorageService,
        private readonly storageConfig: StorageConfigService,
    ) {}

    async execute(query: ReadFileTextQuery): Promise<IReadFileTextResult> {
        this.logger.debug(`Reading text file: ${query.path}`);

        const filePath = new FilePathValueObject(query.path, this.storageConfig.basePath);
        const result = await this.fileStorageService.readFileText(filePath.absolutePath, READ_FILE_TEXT_MAX_BYTES);

        return {
            path: nodePath.relative(this.storageConfig.basePath, filePath.absolutePath),
            content: result.content,
            size: result.size,
            modifiedAt: result.modifiedAt,
        };
    }
}
