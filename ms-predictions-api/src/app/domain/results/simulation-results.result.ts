import { Simulation } from '@domain/entities/simulation.entity';
import { Prediction } from '@domain/entities/prediction.entity';

export class SimulationResultsResult {
    readonly simulation: Simulation;
    readonly predictions: Prediction[];

    constructor(params: { simulation: Simulation; predictions: Prediction[] }) {
        this.simulation = params.simulation;
        this.predictions = params.predictions;
    }
}
