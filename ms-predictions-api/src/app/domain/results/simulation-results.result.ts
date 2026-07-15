import { Simulation } from '@domain/entities/simulation.entity';
import { Prediction } from '@domain/entities/prediction.entity';
import { FullStationCatalogItem } from '@domain/ports/station-catalog-service.port';

export class SimulationResultsResult {
    readonly simulation: Simulation;
    readonly predictions: Prediction[];
    // Snapshot of the full stations catalog indexed by lowercased stationCode.
    // Empty map when the hydro-api catalog fetch failed — the mapper falls back to null.
    readonly stationsByCode: Map<string, FullStationCatalogItem>;

    constructor(params: {
        simulation: Simulation;
        predictions: Prediction[];
        stationsByCode?: Map<string, FullStationCatalogItem>;
    }) {
        this.simulation = params.simulation;
        this.predictions = params.predictions;
        this.stationsByCode = params.stationsByCode ?? new Map();
    }
}
