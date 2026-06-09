import { StationThreshold } from '@domain/entities/station-threshold.entity';

export abstract class IStationThresholdRepository {
    abstract findByStationId(stationId: string): Promise<StationThreshold | null>;
    abstract upsert(data: StationThreshold): Promise<StationThreshold>;
    abstract deleteByStationId(stationId: string): Promise<void>;
}
