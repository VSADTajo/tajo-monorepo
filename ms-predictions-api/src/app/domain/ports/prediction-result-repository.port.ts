import { PredictionResult as PredictionResultEntity } from '@domain/entities/prediction-result.entity';

export abstract class IPredictionResultRepository {
    abstract bulkCreate(data: Partial<PredictionResultEntity>[]): Promise<PredictionResultEntity[]>;
    abstract findByPredictionId(
        predictionId: string,
        startDate?: Date,
        endDate?: Date,
    ): Promise<PredictionResultEntity[]>;
    abstract findByPredictionIds(predictionIds: string[]): Promise<PredictionResultEntity[]>;
}
