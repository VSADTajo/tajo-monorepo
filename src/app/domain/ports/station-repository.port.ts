import { Station } from '@domain/entities/station.entity';

export abstract class IStationRepository {
    abstract create(data: Station): Promise<Station>;
    abstract findById(id: string): Promise<Station>;
    abstract findBySubBasinName(subBasinName: string): Promise<Station | null>;
    abstract findByStationCode(stationCode: string): Promise<Station | null>;
    abstract findAll(options: {
        page?: number;
        limit?: number;
        subBasinId?: string;
        stationType?: string;
        isActive?: boolean;
        zona?: string;
        zonaExplOgcFid?: number;
        zonaExplNombre?: string;
        subBasinName?: string;
        comarcaName?: string;
        sistemaName?: string;
        stationCode?: string;
    }): Promise<{ items: Station[]; total: number }>;
    abstract update(data: Station): Promise<Station>;
}
