import { MeteoalertaZoneThresholdResult } from '@domain/results/meteoalerta-zone-threshold.result';

export abstract class IMeteoalertaZoneRepository {
    /** Returns the meteoalerta zone containing the WGS84 point, or null when it falls outside every zone. */
    abstract findThresholdsByPoint(latitude: number, longitude: number): Promise<MeteoalertaZoneThresholdResult | null>;
}
