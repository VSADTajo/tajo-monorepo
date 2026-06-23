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

/**
 * List item carrying the full maneuvers of each simulation. The maneuvers for
 * a whole page are loaded with a single batched query (findBySimulationIds),
 * so listing N simulations stays at one lookup instead of N.
 */
export class ManualSimulationListItem {
    readonly simulation: Simulation;
    readonly maneuvers: Maneuver[];

    constructor(params: { simulation: Simulation; maneuvers: Maneuver[] }) {
        this.simulation = params.simulation;
        this.maneuvers = params.maneuvers;
    }
}

export class PaginatedManualSimulationResult {
    readonly data: ManualSimulationListItem[];
    readonly total: number;
    readonly page: number;
    readonly limit: number;

    constructor(params: { data: ManualSimulationListItem[]; total: number; page: number; limit: number }) {
        this.data = params.data;
        this.total = params.total;
        this.page = params.page;
        this.limit = params.limit;
    }
}
