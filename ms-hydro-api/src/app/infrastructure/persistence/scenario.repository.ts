import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Logger } from 'nestjs-pino';

import { IScenarioRepository } from '@domain/ports/scenario-repository.port';
import { Scenario } from '@domain/entities/scenario.entity';
import { RepositoryError } from '@domain/errors/repository.error';

@Injectable()
export class ScenarioRepository implements IScenarioRepository {
    constructor(
        @Inject(Logger)
        private readonly logger: Logger,
        @InjectRepository(Scenario)
        private readonly scenarioRepository: Repository<Scenario>,
    ) {}

    async create(data: Scenario): Promise<Scenario> {
        try {
            const scenario = this.scenarioRepository.create(data);
            return await this.scenarioRepository.save(scenario);
        } catch (error) {
            this.logger.error({ msg: 'Error creating scenario', entity: 'Scenarios', error: String(error) });
            throw new RepositoryError('Error creating scenario', error);
        }
    }

    async findById(id: string): Promise<Scenario> {
        try {
            return await this.scenarioRepository.findOneOrFail({ where: { id } });
        } catch (error) {
            this.logger.error({ msg: 'Error finding scenario by id', entity: 'Scenarios', error: String(error) });
            throw new RepositoryError('Scenario not found', error);
        }
    }

    /**
     * List metadata only — the heavy `payload` column is intentionally excluded
     * so listing never ships megabytes of JSON per row.
     */
    async findAllMetadata(options: {
        page?: number;
        limit?: number;
    }): Promise<{ items: Scenario[]; total: number }> {
        try {
            const findOptions: Record<string, unknown> = {
                select: ['id', 'name', 'description', 'itemsCount', 'sizeBytes', 'createdAt', 'updatedAt'],
                order: { createdAt: 'DESC' },
            };
            if (options.page && options.limit) {
                findOptions.skip = (options.page - 1) * options.limit;
                findOptions.take = options.limit;
            }

            const [items, total] = await this.scenarioRepository.findAndCount(findOptions as any);

            return { items, total };
        } catch (error) {
            this.logger.error({ msg: 'Error listing scenarios', entity: 'Scenarios', error: String(error) });
            throw new RepositoryError('Error listing scenarios', error);
        }
    }

    async delete(id: string): Promise<void> {
        try {
            await this.scenarioRepository.delete(id);
        } catch (error) {
            this.logger.error({ msg: 'Error deleting scenario', entity: 'Scenarios', error: String(error) });
            throw new RepositoryError('Error deleting scenario', error);
        }
    }
}
