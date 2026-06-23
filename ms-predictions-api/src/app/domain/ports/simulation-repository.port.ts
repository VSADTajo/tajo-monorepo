import { Simulation, SimulationStatus } from '@domain/entities/simulation.entity';

export interface PaginatedResult<T> {
    data: T[];
    total: number;
    page: number;
    limit: number;
}

export type SimulationSortBy = 'createdAt' | 'updatedAt' | 'simulationDate' | 'status';
export type SortOrder = 'ASC' | 'DESC';

export interface SimulationFilters {
    status?: string;
    startDate?: string;
    endDate?: string;
    modmeteo?: string;
    environment?: string;
    dataOrigin?: string;
    /** Keep only simulations that have at least one prediction for this station code. */
    stationCode?: string;
    /** Column to order by. Whitelisted at the DTO and defended again in the repository. */
    sortBy?: SimulationSortBy;
    /** Order direction. Defaults to DESC. */
    sortOrder?: SortOrder;
}

export abstract class ISimulationRepository {
    abstract create(data: Simulation): Promise<Simulation>;
    abstract findById(id: string): Promise<Simulation>;
    abstract findByDate(simulationDate: string): Promise<Simulation | null>;
    abstract findByDateAndEnvAndModmeteo(
        simulationDate: string,
        environment: string | null,
        modmeteo: string | null,
    ): Promise<Simulation | null>;
    abstract findLatestFinalized(): Promise<Simulation | null>;
    abstract findAll(filters: SimulationFilters, page: number, limit: number): Promise<PaginatedResult<Simulation>>;
    abstract findHistorical(page: number, limit: number): Promise<PaginatedResult<Simulation>>;
    abstract update(data: Simulation): Promise<Simulation>;
    abstract findAvailableDates(dataOrigin?: string, predictionTypes?: string[]): Promise<string[]>;
    abstract deleteOlderThan(date: Date): Promise<number>;
    abstract findManual(status?: SimulationStatus, page?: number, limit?: number): Promise<PaginatedResult<Simulation>>;
}
