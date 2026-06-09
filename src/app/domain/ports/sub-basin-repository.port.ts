import { SubBasin } from '@domain/entities/sub-basin.entity';

export abstract class ISubBasinRepository {
    abstract create(data: SubBasin): Promise<SubBasin>;
    abstract findById(id: string): Promise<SubBasin>;
    abstract findByIdWithStations(id: string): Promise<SubBasin>;
    abstract findByCode(code: string): Promise<SubBasin | null>;
    abstract findByNameAndBasinId(name: string, basinId: string): Promise<SubBasin | null>;
    abstract findAll(options: {
        page?: number;
        limit?: number;
        basinId?: string;
        isActive?: boolean;
    }): Promise<{ items: SubBasin[]; total: number }>;
    abstract update(data: SubBasin): Promise<SubBasin>;
}
