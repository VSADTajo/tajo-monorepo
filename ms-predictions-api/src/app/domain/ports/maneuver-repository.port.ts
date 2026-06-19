import { Maneuver } from '@domain/entities/maneuver.entity';

export interface PaginatedManeuvers {
    data: Maneuver[];
    total: number;
    page: number;
    limit: number;
}

export interface ManeuverFilters {
    reservoirCode?: string;
}

export abstract class IManeuverRepository {
    abstract create(maneuver: Maneuver): Promise<Maneuver>;
    abstract createMany(maneuvers: Maneuver[]): Promise<Maneuver[]>;
    abstract findById(id: string): Promise<Maneuver | null>;
    abstract findByIds(ids: string[]): Promise<Maneuver[]>;
    abstract findAll(filters: ManeuverFilters, page: number, limit: number): Promise<PaginatedManeuvers>;
    abstract findBySimulationId(simulationId: string): Promise<Maneuver[]>;
    abstract update(maneuver: Maneuver): Promise<Maneuver>;
    abstract delete(id: string): Promise<void>;
}
