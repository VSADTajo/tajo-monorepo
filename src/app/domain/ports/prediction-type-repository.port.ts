import { PredictionType } from '@domain/entities/prediction-type.entity';

export abstract class IPredictionTypeRepository {
    abstract create(data: PredictionType): Promise<PredictionType>;
    abstract findById(id: string): Promise<PredictionType>;
    abstract findByName(name: string): Promise<PredictionType | null>;
    abstract findAll(): Promise<PredictionType[]>;
    abstract findOrCreateByName(name: string, unit: string): Promise<PredictionType>;
}
