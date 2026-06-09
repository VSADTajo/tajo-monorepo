import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Logger } from 'nestjs-pino';

import { IPredictionTypeRepository } from '@domain/ports/prediction-type-repository.port';
import { PredictionType } from '@domain/entities/prediction-type.entity';
import { RepositoryError } from '@domain/errors/repository.error';

@Injectable()
export class PredictionTypeRepository implements IPredictionTypeRepository {
    constructor(
        @Inject(Logger)
        private readonly logger: Logger,
        @InjectRepository(PredictionType)
        private readonly predictionTypeRepository: Repository<PredictionType>,
    ) {}

    async create(data: PredictionType): Promise<PredictionType> {
        try {
            const predictionType = this.predictionTypeRepository.create(data);
            return await this.predictionTypeRepository.save(predictionType);
        } catch (error) {
            this.logger.error({
                msg: 'Error creating prediction type',
                entity: 'PredictionTypes',
                error: String(error),
            });
            throw new RepositoryError('Error creating prediction type', error);
        }
    }

    async findById(id: string): Promise<PredictionType> {
        try {
            return await this.predictionTypeRepository.findOneOrFail({ where: { id } });
        } catch (error) {
            this.logger.error({
                msg: 'Error finding prediction type by id',
                entity: 'PredictionTypes',
                error: String(error),
            });
            throw new RepositoryError('Prediction type not found', error);
        }
    }

    async findByName(name: string): Promise<PredictionType | null> {
        return this.predictionTypeRepository.findOne({ where: { name } });
    }

    async findAll(): Promise<PredictionType[]> {
        try {
            return await this.predictionTypeRepository.find();
        } catch (error) {
            this.logger.error({
                msg: 'Error listing prediction types',
                entity: 'PredictionTypes',
                error: String(error),
            });
            throw new RepositoryError('Error listing prediction types', error);
        }
    }

    async findOrCreateByName(name: string, unit: string): Promise<PredictionType> {
        try {
            const existing = await this.predictionTypeRepository.findOne({ where: { name } });
            if (existing) {
                return existing;
            }
            const predictionType = this.predictionTypeRepository.create({ name, unit });
            return await this.predictionTypeRepository.save(predictionType);
        } catch (error) {
            this.logger.error({ msg: 'Error in findOrCreateByName', entity: 'PredictionTypes', error: String(error) });
            throw new RepositoryError('Error in findOrCreateByName', error);
        }
    }
}
