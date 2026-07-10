export interface StationCatalogItem {
    code: string;
    name: string | null;
}

/**
 * Read-only access to the canonical station catalog owned by ms-hydro-api.
 * Predictions reference stations by their `stationCode` (== predictions.stationId).
 */
export abstract class IStationCatalogService {
    abstract listStations(): Promise<StationCatalogItem[]>;
}
