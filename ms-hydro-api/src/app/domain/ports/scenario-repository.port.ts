import { Scenario } from '@domain/entities/scenario.entity';

export abstract class IScenarioRepository {
    abstract create(data: Scenario): Promise<Scenario>;
    abstract findById(id: string): Promise<Scenario>;
    abstract findAllMetadata(options: {
        page?: number;
        limit?: number;
    }): Promise<{ items: Scenario[]; total: number }>;
    abstract delete(id: string): Promise<void>;
}
