import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Logger } from 'nestjs-pino';

import { IScenarioFileRepository } from '@domain/ports/scenario-file-repository.port';
import { ScenarioFile } from '@domain/entities/scenario-file.entity';
import { RepositoryError } from '@domain/errors/repository.error';

@Injectable()
export class ScenarioFileRepository implements IScenarioFileRepository {
    constructor(
        @Inject(Logger)
        private readonly logger: Logger,
        @InjectRepository(ScenarioFile)
        private readonly scenarioFileRepository: Repository<ScenarioFile>,
    ) {}

    async createMany(files: ScenarioFile[]): Promise<ScenarioFile[]> {
        try {
            const entities = this.scenarioFileRepository.create(files);
            return await this.scenarioFileRepository.save(entities);
        } catch (error) {
            this.logger.error({ msg: 'Error creating scenario files', entity: 'ScenarioFiles', error: String(error) });
            throw new RepositoryError('Error creating scenario files', error);
        }
    }

    /** Metadata only — the heavy `content` bytea is excluded from listings. */
    async findMetadataByScenario(scenarioId: string): Promise<ScenarioFile[]> {
        try {
            return await this.scenarioFileRepository.find({
                where: { scenarioId },
                select: ['id', 'scenarioId', 'filename', 'contentType', 'sizeBytes', 'createdAt', 'updatedAt'],
                order: { createdAt: 'ASC' },
            });
        } catch (error) {
            this.logger.error({ msg: 'Error listing scenario files', entity: 'ScenarioFiles', error: String(error) });
            throw new RepositoryError('Error listing scenario files', error);
        }
    }

    async findByScenarioAndId(scenarioId: string, fileId: string): Promise<ScenarioFile> {
        try {
            return await this.scenarioFileRepository.findOneOrFail({ where: { id: fileId, scenarioId } });
        } catch (error) {
            this.logger.error({ msg: 'Error finding scenario file', entity: 'ScenarioFiles', error: String(error) });
            throw new RepositoryError('Scenario file not found', error);
        }
    }

    async update(file: ScenarioFile): Promise<ScenarioFile> {
        try {
            return await this.scenarioFileRepository.save(file);
        } catch (error) {
            this.logger.error({ msg: 'Error updating scenario file', entity: 'ScenarioFiles', error: String(error) });
            throw new RepositoryError('Error updating scenario file', error);
        }
    }

    async delete(id: string): Promise<void> {
        try {
            await this.scenarioFileRepository.delete(id);
        } catch (error) {
            this.logger.error({ msg: 'Error deleting scenario file', entity: 'ScenarioFiles', error: String(error) });
            throw new RepositoryError('Error deleting scenario file', error);
        }
    }
}
