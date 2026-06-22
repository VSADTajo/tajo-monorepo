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
 * Lightweight list item: carries the maneuver COUNT instead of the full
 * maneuver rows, so listing N simulations costs a single aggregate query
 * instead of N per-simulation lookups.
 */
export class ManualSimulationListItem {
    readonly simulation: Simulation;
    readonly maneuverCount: number;

    constructor(params: { simulation: Simulation; maneuverCount: number }) {
        this.simulation = params.simulation;
        this.maneuverCount = params.maneuverCount;
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
