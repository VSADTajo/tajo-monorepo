import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Logger } from 'nestjs-pino';

import { ICleanupJobRepository } from '@domain/ports/cleanup-job-repository.port';
import { CleanupJob } from '@domain/entities/cleanup-job.entity';
import { RepositoryError } from '@domain/errors/repository.error';

@Injectable()
export class CleanupJobRepository implements ICleanupJobRepository {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        @InjectRepository(CleanupJob)
        private readonly repository: Repository<CleanupJob>,
    ) {}

    async findAll(): Promise<CleanupJob[]> {
        try {
            return await this.repository.find({ order: { createdAt: 'DESC' } });
        } catch (error) {
            this.logger.error({ msg: 'Failed to list cleanup jobs', entity: 'CleanupJob', error: String(error) });
            throw new RepositoryError('Failed to list cleanup jobs', error);
        }
    }

    async findAllActive(): Promise<CleanupJob[]> {
        try {
            return await this.repository.find({ where: { isActive: true } });
        } catch (error) {
            this.logger.error({
                msg: 'Failed to list active cleanup jobs',
                entity: 'CleanupJob',
                error: String(error),
            });
            throw new RepositoryError('Failed to list active cleanup jobs', error);
        }
    }

    async findById(id: string): Promise<CleanupJob | null> {
        try {
            return await this.repository.findOne({ where: { id } });
        } catch (error) {
            this.logger.error({ msg: 'Failed to find cleanup job by id', entity: 'CleanupJob', error: String(error) });
            throw new RepositoryError('Failed to find cleanup job', error);
        }
    }

    async findByDirectoryPath(path: string): Promise<CleanupJob | null> {
        try {
            return await this.repository.findOne({ where: { directoryPath: path } });
        } catch (error) {
            this.logger.error({
                msg: 'Failed to find cleanup job by path',
                entity: 'CleanupJob',
                error: String(error),
            });
            throw new RepositoryError('Failed to find cleanup job by path', error);
        }
    }

    async findByDirectoryPaths(paths: string[]): Promise<CleanupJob[]> {
        if (paths.length === 0) return [];
        try {
            return await this.repository.find({ where: { directoryPath: In(paths) } });
        } catch (error) {
            this.logger.error({
                msg: 'Failed to find cleanup jobs by paths',
                entity: 'CleanupJob',
                error: String(error),
            });
            throw new RepositoryError('Failed to find cleanup jobs by paths', error);
        }
    }

    async create(job: CleanupJob): Promise<CleanupJob> {
        try {
            return await this.repository.save(job);
        } catch (error) {
            this.logger.error({ msg: 'Failed to create cleanup job', entity: 'CleanupJob', error: String(error) });
            throw new RepositoryError('Failed to create cleanup job', error);
        }
    }

    async update(job: CleanupJob): Promise<CleanupJob> {
        try {
            return await this.repository.save(job);
        } catch (error) {
            this.logger.error({ msg: 'Failed to update cleanup job', entity: 'CleanupJob', error: String(error) });
            throw new RepositoryError('Failed to update cleanup job', error);
        }
    }

    async delete(id: string): Promise<void> {
        try {
            await this.repository.delete(id);
        } catch (error) {
            this.logger.error({ msg: 'Failed to delete cleanup job', entity: 'CleanupJob', error: String(error) });
            throw new RepositoryError('Failed to delete cleanup job', error);
        }
    }
}
