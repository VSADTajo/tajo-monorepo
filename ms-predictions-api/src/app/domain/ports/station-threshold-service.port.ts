export abstract class IStationThresholdService {
    abstract getThreshold(stationId: string): Promise<number | null>;
}
