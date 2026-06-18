import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import * as nodePath from 'node:path';
import { Logger } from 'nestjs-pino';

import { ICleanupScheduler } from '@domain/ports/cleanup-scheduler.port';
import { ICleanupJobRepository } from '@domain/ports/cleanup-job-repository.port';
import { IFileStorageService } from '@domain/ports/file-storage-service.port';
import { CleanupJob } from '@domain/entities/cleanup-job.entity';
import { CleanupFrequency, FREQUENCY_CRON_MAP } from '@domain/types/cleanup-frequency.enum';

@Injectable()
export class CleanupSchedulerService implements ICleanupScheduler, OnModuleInit {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly schedulerRegistry: SchedulerRegistry,
        private readonly cleanupJobRepository: ICleanupJobRepository,
        private readonly fileStorageService: IFileStorageService,
    ) {}

    async onModuleInit(): Promise<void> {
        this.logger.log('CleanupSchedulerService: loading active jobs from database');
        const activeJobs = await this.cleanupJobRepository.findAllActive();
        for (const job of activeJobs) {
            this.scheduleJob(job);
        }
        this.logger.log({ msg: 'Cleanup jobs scheduled', entity: 'CleanupJob', jobCount: activeJobs.length });
    }

    scheduleJob(job: CleanupJob): void {
        const cronExpression = FREQUENCY_CRON_MAP[job.frequency as CleanupFrequency];
        if (!cronExpression) {
            this.logger.error({ msg: 'Invalid cleanup job frequency', entity: 'CleanupJob', jobId: job.id, frequency: job.frequency });
            return;
        }

        const cronJob = new CronJob(cronExpression, () => {
            void this.executeCleanup(job.id, job.directoryPath, job.extensions);
        });

        this.schedulerRegistry.addCronJob(job.id, cronJob);
        cronJob.start();
        this.logger.log({ msg: 'Cleanup job scheduled', entity: 'CleanupJob', jobId: job.id, directoryPath: job.directoryPath, cronExpression });
    }

    unscheduleJob(jobId: string): void {
        if (!this.isScheduled(jobId)) return;
        this.schedulerRegistry.deleteCronJob(jobId);
        this.logger.log(`Unscheduled cleanup job ${jobId}`);
    }

    rescheduleJob(job: CleanupJob): void {
        this.unscheduleJob(job.id);
        this.scheduleJob(job);
    }

    getNextExecution(frequency: CleanupFrequency): Date {
        const cronExpression = FREQUENCY_CRON_MAP[frequency];
        const tempJob = new CronJob(cronExpression, () => {});
        return tempJob.nextDate().toJSDate();
    }

    isScheduled(jobId: string): boolean {
        try {
            this.schedulerRegistry.getCronJob(jobId);
            return true;
        } catch {
            return false;
        }
    }

    private async executeCleanup(jobId: string, directoryPath: string, extensions: string[]): Promise<void> {
        this.logger.log({ msg: 'Cleanup job execution started', entity: 'CleanupJob', jobId, directoryPath, extensions: extensions.join(',') });

        let filesDeleted = 0;
        let executionError: string | undefined;

        try {
            const fileList = await this.fileStorageService.listFiles(directoryPath);
            const toDelete = fileList.files.filter(
                (f) => !f.isDirectory && extensions.some((ext) => f.name.toLowerCase().endsWith(ext)),
            );

            for (const file of toDelete) {
                try {
                    const absolutePath = nodePath.join(directoryPath, file.name);
                    await this.fileStorageService.deleteFile(absolutePath);
                    filesDeleted++;
                } catch (err) {
                    this.logger.error({
                        msg: 'Failed to delete file',
                        entity: 'CleanupJob',
                        fileName: file.name,
                        error: String(err),
                    });
                    executionError = String(err);
                }
            }
        } catch (err) {
            this.logger.error({ msg: 'Cleanup job failed during file listing', entity: 'CleanupJob', jobId, error: String(err) });
            executionError = String(err);
        }

        // Persist execution result
        try {
            const job = await this.cleanupJobRepository.findById(jobId);
            if (job) {
                job.lastExecutedAt = new Date();
                job.lastExecutionResult = { filesDeleted, error: executionError };
                job.nextExecutionAt = this.getNextExecution(job.frequency as CleanupFrequency);
                await this.cleanupJobRepository.update(job);
            }
        } catch (err) {
            this.logger.error({ msg: 'Failed to persist cleanup job execution result', entity: 'CleanupJob', jobId, error: String(err) });
        }

        this.logger.log({ msg: 'Cleanup job completed', entity: 'CleanupJob', jobId, filesDeleted });
    }
}
