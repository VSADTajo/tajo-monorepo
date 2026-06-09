import { Inject, HttpStatus } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Logger } from 'nestjs-pino';

import { ICleanupJobRepository } from '@domain/ports/cleanup-job-repository.port';
import { CleanupJobResult, DeleteCleanupJobResult } from '@domain/results/cleanup-job.result';
import { ApiError } from '@domain/errors/api.error';
import { CleanupJob } from '@domain/entities/cleanup-job.entity';

// ─────────────────────────────────────────────────────────────
// GetCleanupJobById
// ─────────────────────────────────────────────────────────────

export class GetCleanupJobByIdQuery {
    constructor(public readonly id: string) {}
}

@QueryHandler(GetCleanupJobByIdQuery)
export class GetCleanupJobByIdHandler implements IQueryHandler<GetCleanupJobByIdQuery, CleanupJobResult> {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly cleanupJobRepository: ICleanupJobRepository,
    ) {}

    async execute(query: GetCleanupJobByIdQuery): Promise<CleanupJobResult> {
        this.logger.debug(`Getting cleanup job by id: ${query.id}`);

        const job = await this.cleanupJobRepository.findById(query.id);
        if (!job) {
            throw new ApiError(HttpStatus.NOT_FOUND, `Cleanup job not found: ${query.id}`);
        }

        return toCleanupJobResult(job);
    }
}

// ─────────────────────────────────────────────────────────────
// GetCleanupJobByPath
// ─────────────────────────────────────────────────────────────

export class GetCleanupJobByPathQuery {
    constructor(public readonly path: string) {}
}

@QueryHandler(GetCleanupJobByPathQuery)
export class GetCleanupJobByPathHandler implements IQueryHandler<GetCleanupJobByPathQuery, CleanupJobResult | null> {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly cleanupJobRepository: ICleanupJobRepository,
    ) {}

    async execute(query: GetCleanupJobByPathQuery): Promise<CleanupJobResult | null> {
        this.logger.debug(`Getting cleanup job by path: ${query.path}`);

        const job = await this.cleanupJobRepository.findByDirectoryPath(query.path);
        if (!job) return null;

        return toCleanupJobResult(job);
    }
}

// ─────────────────────────────────────────────────────────────
// ListCleanupJobs
// ─────────────────────────────────────────────────────────────

export class ListCleanupJobsQuery {}

@QueryHandler(ListCleanupJobsQuery)
export class ListCleanupJobsHandler implements IQueryHandler<ListCleanupJobsQuery, CleanupJobResult[]> {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly cleanupJobRepository: ICleanupJobRepository,
    ) {}

    async execute(_query: ListCleanupJobsQuery): Promise<CleanupJobResult[]> {
        this.logger.debug('Listing all cleanup jobs');
        _query;

        const jobs = await this.cleanupJobRepository.findAll();
        return jobs.map(toCleanupJobResult);
    }
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

export function toCleanupJobResult(job: CleanupJob): CleanupJobResult {
    return new CleanupJobResult({
        id: job.id,
        directoryPath: job.directoryPath,
        extensions: job.extensions,
        frequency: job.frequency,
        isActive: job.isActive,
        lastExecutedAt: job.lastExecutedAt ?? null,
        lastExecutionResult: job.lastExecutionResult ?? null,
        nextExecutionAt: job.nextExecutionAt ?? null,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
    });
}

// re-export for convenience
export { DeleteCleanupJobResult };
