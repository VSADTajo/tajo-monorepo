import { Simulation } from '@domain/entities/simulation.entity';
import { Maneuver } from '@domain/entities/maneuver.entity';

export class ManualSimulationResult {
    readonly simulation: Simulation;
    readonly maneuvers: Maneuver[];

    constructor(params: { simulation: Simulation; maneuvers: Maneuver[] }) {
        this.simulation = params.simulation;
        this.maneuvers = params.maneuvers;
    }
}

export class PaginatedManualSimulationResult {
    readonly data: ManualSimulationResult[];
    readonly total: number;
    readonly page: number;
    readonly limit: number;

    constructor(params: { data: ManualSimulationResult[]; total: number; page: number; limit: number }) {
        this.data = params.data;
        this.total = params.total;
        this.page = params.page;
        this.limit = params.limit;
    }
}
