import { Basin } from '@domain/entities/basin.entity';

export abstract class IBasinRepository {
    abstract create(data: Basin): Promise<Basin>;
    abstract findById(id: string): Promise<Basin>;
    abstract findByIdWithSubBasins(id: string): Promise<Basin>;
    abstract findByName(name: string): Promise<Basin | null>;
    abstract findByCode(code: string): Promise<Basin | null>;
    abstract findAll(options: {
        page?: number;
        limit?: number;
        isActive?: boolean;
    }): Promise<{ items: Basin[]; total: number }>;
    abstract update(data: Basin): Promise<Basin>;
}
