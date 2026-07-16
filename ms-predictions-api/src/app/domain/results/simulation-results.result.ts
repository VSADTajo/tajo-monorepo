import { Simulation } from '@domain/entities/simulation.entity';
import { Prediction } from '@domain/entities/prediction.entity';
import { FullStationCatalogItem } from '@domain/ports/station-catalog-service.port';

export class SimulationResultsResult {
    readonly simulation: Simulation;
    readonly predictions: Prediction[];
    // Snapshot of the full stations catalog indexed by lowercased stationCode.
    // Plain Record (not Map) so it survives JSON roundtrip through Redis cache.
    // Empty when the hydro-api catalog fetch failed — mapper falls back to null.
    readonly stationsByCode: Record<string, FullStationCatalogItem>;

    constructor(params: {
        simulation: Simulation;
        predictions: Prediction[];
        stationsByCode?: Record<string, FullStationCatalogItem>;
    }) {
        this.simulation = params.simulation;
        this.predictions = params.predictions;
        this.stationsByCode = params.stationsByCode ?? {};
    }
}
