import { StationResguardo } from '@domain/entities/station-resguardo.entity';

export abstract class IStationResguardoRepository {
    abstract bulkUpsert(items: StationResguardo[]): Promise<number>;

    abstract findByStationId(options: {
        stationId: string;
        year?: number;
        from?: string;
        to?: string;
    }): Promise<StationResguardo[]>;

    abstract findByStationIdAndDate(stationId: string, date: string): Promise<StationResguardo | null>;

    abstract update(item: StationResguardo): Promise<StationResguardo>;
}
