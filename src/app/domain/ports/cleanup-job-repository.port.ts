import { CleanupJob } from '@domain/entities/cleanup-job.entity';

export abstract class ICleanupJobRepository {
    abstract findAll(): Promise<CleanupJob[]>;
    abstract findAllActive(): Promise<CleanupJob[]>;
    abstract findById(id: string): Promise<CleanupJob | null>;
    abstract findByDirectoryPath(path: string): Promise<CleanupJob | null>;
    abstract findByDirectoryPaths(paths: string[]): Promise<CleanupJob[]>;
    abstract create(job: CleanupJob): Promise<CleanupJob>;
    abstract update(job: CleanupJob): Promise<CleanupJob>;
    abstract delete(id: string): Promise<void>;
}
