import { Inject, HttpStatus } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Logger } from 'nestjs-pino';

// Domain
import { ICleanupJobRepository } from '@domain/ports/cleanup-job-repository.port';
import { ICleanupScheduler } from '@domain/ports/cleanup-scheduler.port';
import { ICacheService } from '@domain/ports/cache-service.port';
import { CleanupJob } from '@domain/entities/cleanup-job.entity';
import { CleanupFrequency } from '@domain/types/cleanup-frequency.enum';
import { CleanupJobResult, DeleteCleanupJobResult } from '@domain/results/cleanup-job.result';
import { ApiError } from '@domain/errors/api.error';

// Cache
import { CleanupJobCacheKeys, FileCacheKeys } from '@infrastructure/cache/cache-config.registry';

// Helper
import { toCleanupJobResult } from '@application/queries/cleanup-job.queries';

// ─────────────────────────────────────────────────────────────
// CreateCleanupJob
// ─────────────────────────────────────────────────────────────

export interface ICreateCleanupJobCommand {
    directoryPath: string;
    extensions: string[];
    frequency: CleanupFrequency;
}

export class CreateCleanupJobCommand {
    constructor(private readonly parameters: ICreateCleanupJobCommand) {}

    get directoryPath(): string {
        return this.parameters.directoryPath;
    }
    get extensions(): string[] {
        return this.parameters.extensions;
    }
    get frequency(): CleanupFrequency {
        return this.parameters.frequency;
    }
}

@CommandHandler(CreateCleanupJobCommand)
export class CreateCleanupJobHandler implements ICommandHandler<CreateCleanupJobCommand, CleanupJobResult> {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly cleanupJobRepository: ICleanupJobRepository,
        private readonly cleanupScheduler: ICleanupScheduler,
        private readonly cacheService: ICacheService,
    ) {}

    async execute(command: CreateCleanupJobCommand): Promise<CleanupJobResult> {
        this.logger.log({ msg: 'Cleanup job created', entity: 'CleanupJob', directoryPath: command.directoryPath });

        const job = new CleanupJob({
            directoryPath: command.directoryPath,
            extensions: command.extensions,
            frequency: command.frequency,
            isActive: true,
            lastExecutedAt: null,
            lastExecutionResult: null,
            nextExecutionAt: null,
        });
        job.validate();

        const existing = await this.cleanupJobRepository.findByDirectoryPath(job.directoryPath);
        if (existing) {
            throw new ApiError(HttpStatus.CONFLICT, `A cleanup job already exists for path: ${job.directoryPath}`);
        }

        job.nextExecutionAt = this.cleanupScheduler.getNextExecution(job.frequency as CleanupFrequency);
        const persisted = await this.cleanupJobRepository.create(job);
        this.cleanupScheduler.scheduleJob(persisted);

        await this.cacheService.delByPattern(CleanupJobCacheKeys.pattern());
        await this.cacheService.del(FileCacheKeys.pathsOverview());

        return toCleanupJobResult(persisted);
    }
}

// ─────────────────────────────────────────────────────────────
// UpdateCleanupJob
// ─────────────────────────────────────────────────────────────

export interface IUpdateCleanupJobCommand {
    id: string;
    extensions?: string[];
    frequency?: CleanupFrequency;
}

export class UpdateCleanupJobCommand {
    constructor(private readonly parameters: IUpdateCleanupJobCommand) {}

    get id(): string {
        return this.parameters.id;
    }
    get extensions(): string[] | undefined {
        return this.parameters.extensions;
    }
    get frequency(): CleanupFrequency | undefined {
        return this.parameters.frequency;
    }
}

@CommandHandler(UpdateCleanupJobCommand)
export class UpdateCleanupJobHandler implements ICommandHandler<UpdateCleanupJobCommand, CleanupJobResult> {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly cleanupJobRepository: ICleanupJobRepository,
        private readonly cleanupScheduler: ICleanupScheduler,
        private readonly cacheService: ICacheService,
    ) {}

    async execute(command: UpdateCleanupJobCommand): Promise<CleanupJobResult> {
        this.logger.log(`Updating cleanup job: ${command.id}`);

        const job = await this.cleanupJobRepository.findById(command.id);
        if (!job) {
            throw new ApiError(HttpStatus.NOT_FOUND, `Cleanup job not found: ${command.id}`);
        }

        if (command.extensions !== undefined) job.extensions = command.extensions;
        if (command.frequency !== undefined) job.frequency = command.frequency;

        job.validate();

        if (job.isActive) {
            this.cleanupScheduler.rescheduleJob(job);
        }
        job.nextExecutionAt = job.isActive
            ? this.cleanupScheduler.getNextExecution(job.frequency as CleanupFrequency)
            : null;

        const updated = await this.cleanupJobRepository.update(job);

        await this.cacheService.delByPattern(CleanupJobCacheKeys.pattern());
        await this.cacheService.del(FileCacheKeys.pathsOverview());

        return toCleanupJobResult(updated);
    }
}

// ─────────────────────────────────────────────────────────────
// ToggleCleanupJob
// ─────────────────────────────────────────────────────────────

export interface IToggleCleanupJobCommand {
    id: string;
    isActive: boolean;
}

export class ToggleCleanupJobCommand {
    constructor(private readonly parameters: IToggleCleanupJobCommand) {}

    get id(): string {
        return this.parameters.id;
    }
    get isActive(): boolean {
        return this.parameters.isActive;
    }
}

@CommandHandler(ToggleCleanupJobCommand)
export class ToggleCleanupJobHandler implements ICommandHandler<ToggleCleanupJobCommand, CleanupJobResult> {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly cleanupJobRepository: ICleanupJobRepository,
        private readonly cleanupScheduler: ICleanupScheduler,
        private readonly cacheService: ICacheService,
    ) {}

    async execute(command: ToggleCleanupJobCommand): Promise<CleanupJobResult> {
        this.logger.log(`Toggling cleanup job ${command.id} to isActive=${command.isActive}`);

        const job = await this.cleanupJobRepository.findById(command.id);
        if (!job) {
            throw new ApiError(HttpStatus.NOT_FOUND, `Cleanup job not found: ${command.id}`);
        }

        job.isActive = command.isActive;

        if (command.isActive) {
            this.cleanupScheduler.scheduleJob(job);
            job.nextExecutionAt = this.cleanupScheduler.getNextExecution(job.frequency as CleanupFrequency);
        } else {
            this.cleanupScheduler.unscheduleJob(job.id);
            job.nextExecutionAt = null;
        }

        const updated = await this.cleanupJobRepository.update(job);

        await this.cacheService.delByPattern(CleanupJobCacheKeys.pattern());
        await this.cacheService.del(FileCacheKeys.pathsOverview());

        return toCleanupJobResult(updated);
    }
}

// ─────────────────────────────────────────────────────────────
// DeleteCleanupJob
// ─────────────────────────────────────────────────────────────

export interface IDeleteCleanupJobCommand {
    id: string;
}

export class DeleteCleanupJobCommand {
    constructor(private readonly parameters: IDeleteCleanupJobCommand) {}

    get id(): string {
        return this.parameters.id;
    }
}

@CommandHandler(DeleteCleanupJobCommand)
export class DeleteCleanupJobHandler implements ICommandHandler<DeleteCleanupJobCommand, DeleteCleanupJobResult> {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly cleanupJobRepository: ICleanupJobRepository,
        private readonly cleanupScheduler: ICleanupScheduler,
        private readonly cacheService: ICacheService,
    ) {}

    async execute(command: DeleteCleanupJobCommand): Promise<DeleteCleanupJobResult> {
        this.logger.log(`Deleting cleanup job: ${command.id}`);

        const job = await this.cleanupJobRepository.findById(command.id);
        if (!job) {
            throw new ApiError(HttpStatus.NOT_FOUND, `Cleanup job not found: ${command.id}`);
        }

        if (this.cleanupScheduler.isScheduled(job.id)) {
            this.cleanupScheduler.unscheduleJob(job.id);
        }

        await this.cleanupJobRepository.delete(job.id);

        await this.cacheService.delByPattern(CleanupJobCacheKeys.pattern());
        await this.cacheService.del(FileCacheKeys.pathsOverview());

        return new DeleteCleanupJobResult({ deletedId: job.id });
    }
}
