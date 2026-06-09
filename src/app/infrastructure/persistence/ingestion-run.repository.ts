import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Logger } from 'nestjs-pino';

import { IIngestionRunRepository } from '@domain/ports/ingestion-run-repository.port';
import { IngestionRun } from '@domain/entities/ingestion-run.entity';
import { IngestionStatus } from '@domain/types/ingestion-status.enum';
import { RepositoryError } from '@domain/errors/repository.error';

@Injectable()
export class IngestionRunRepository implements IIngestionRunRepository {
    constructor(
        @Inject(Logger)
        private readonly logger: Logger,
        @InjectRepository(IngestionRun)
        private readonly ingestionRunRepository: Repository<IngestionRun>,
    ) {}

    async create(data: IngestionRun): Promise<IngestionRun> {
        try {
            const entity = this.ingestionRunRepository.create(data);
            return await this.ingestionRunRepository.save(entity);
        } catch (error) {
            this.logger.error({ msg: 'Error creating ingestion run', entity: 'IngestionRun', error: String(error) });
            throw new RepositoryError('Error creating ingestion run', error);
        }
    }

    async findById(id: string): Promise<IngestionRun | null> {
        try {
            return await this.ingestionRunRepository.findOne({ where: { id } });
        } catch (error) {
            this.logger.error({
                msg: 'Error finding ingestion run by id',
                entity: 'IngestionRun',
                error: String(error),
            });
            throw new RepositoryError('Error finding ingestion run', error);
        }
    }

    async findAll(): Promise<IngestionRun[]> {
        try {
            return await this.ingestionRunRepository.find({
                order: { startedAt: 'DESC' },
            });
        } catch (error) {
            this.logger.error({
                msg: 'Error finding all ingestion runs',
                entity: 'IngestionRun',
                error: String(error),
            });
            throw new RepositoryError('Error finding all ingestion runs', error);
        }
    }

    async findByProviderConfigId(providerConfigId: string): Promise<IngestionRun[]> {
        try {
            return await this.ingestionRunRepository.find({
                where: { providerConfigId },
                order: { startedAt: 'DESC' },
            });
        } catch (error) {
            this.logger.error({
                msg: 'Error finding ingestion runs by provider',
                entity: 'IngestionRun',
                error: String(error),
            });
            throw new RepositoryError('Error finding ingestion runs', error);
        }
    }

    async findRunningByProviderConfigId(providerConfigId: string): Promise<IngestionRun | null> {
        try {
            return await this.ingestionRunRepository.findOne({
                where: { providerConfigId, status: IngestionStatus.RUNNING },
            });
        } catch (error) {
            this.logger.error({
                msg: 'Error finding running ingestion run',
                entity: 'IngestionRun',
                error: String(error),
            });
            throw new RepositoryError('Error finding running ingestion run', error);
        }
    }

    async deleteOlderThan(date: Date): Promise<number> {
        try {
            const result = await this.ingestionRunRepository
                .createQueryBuilder()
                .delete()
                .from(IngestionRun)
                .where('"startedAt" < :date', { date })
                .andWhere('status != :status', { status: IngestionStatus.RUNNING })
                .execute();

            return result.affected ?? 0;
        } catch (error) {
            this.logger.error({
                msg: 'Error purging old ingestion runs',
                entity: 'IngestionRun',
                error: String(error),
            });
            throw new RepositoryError('Error purging old ingestion runs', error);
        }
    }

    async update(data: IngestionRun): Promise<IngestionRun> {
        try {
            return await this.ingestionRunRepository.save(data);
        } catch (error) {
            this.logger.error({ msg: 'Error updating ingestion run', entity: 'IngestionRun', error: String(error) });
            throw new RepositoryError('Error updating ingestion run', error);
        }
    }
}
