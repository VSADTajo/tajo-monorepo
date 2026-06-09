import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Logger } from 'nestjs-pino';

import { IPredictionResultRepository } from '@domain/ports/prediction-result-repository.port';
import { PredictionResult as PredictionResultEntity } from '@domain/entities/prediction-result.entity';
import { RepositoryError } from '@domain/errors/repository.error';

@Injectable()
export class PredictionResultRepository implements IPredictionResultRepository {
    constructor(
        @Inject(Logger)
        private readonly logger: Logger,
        @InjectRepository(PredictionResultEntity)
        private readonly predictionResultRepository: Repository<PredictionResultEntity>,
    ) {}

    async bulkCreate(data: Partial<PredictionResultEntity>[]): Promise<PredictionResultEntity[]> {
        try {
            const result = await this.predictionResultRepository
                .createQueryBuilder()
                .insert()
                .into(PredictionResultEntity)
                .values(data)
                .returning('*')
                .execute();
            return result.raw as PredictionResultEntity[];
        } catch (error) {
            this.logger.error({
                msg: 'Error bulk creating prediction results',
                entity: 'PredictionResults',
                error: String(error),
            });
            throw new RepositoryError('Error bulk creating prediction results', error);
        }
    }

    async findByPredictionId(
        predictionId: string,
        startDate?: Date,
        endDate?: Date,
    ): Promise<PredictionResultEntity[]> {
        try {
            const qb = this.predictionResultRepository.createQueryBuilder('result');
            qb.where('result.predictionId = :predictionId', { predictionId });

            if (startDate) {
                qb.andWhere('result.date >= :startDate', { startDate });
            }

            if (endDate) {
                qb.andWhere('result.date <= :endDate', { endDate });
            }

            qb.orderBy('result.date', 'ASC');

            return await qb.getMany();
        } catch (error) {
            this.logger.error({
                msg: 'Error finding prediction results by prediction id',
                entity: 'PredictionResults',
                error: String(error),
            });
            throw new RepositoryError('Error finding prediction results by prediction id', error);
        }
    }

    async findByPredictionIds(predictionIds: string[]): Promise<PredictionResultEntity[]> {
        try {
            return await this.predictionResultRepository.find({
                where: { predictionId: In(predictionIds) },
                order: { date: 'ASC' },
            });
        } catch (error) {
            this.logger.error({
                msg: 'Error finding prediction results by prediction ids',
                entity: 'PredictionResults',
                error: String(error),
            });
            throw new RepositoryError('Error finding prediction results by prediction ids', error);
        }
    }
}
