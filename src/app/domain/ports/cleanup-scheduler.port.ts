import { CleanupJob } from '@domain/entities/cleanup-job.entity';
import { CleanupFrequency } from '@domain/types/cleanup-frequency.enum';

export abstract class ICleanupScheduler {
    abstract scheduleJob(job: CleanupJob): void;
    abstract unscheduleJob(jobId: string): void;
    abstract rescheduleJob(job: CleanupJob): void;
    abstract getNextExecution(frequency: CleanupFrequency): Date;
    abstract isScheduled(jobId: string): boolean;
}
