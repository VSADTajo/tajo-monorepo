import { Simulation, SimulationStatus } from '@domain/entities/simulation.entity';

export interface PaginatedResult<T> {
    data: T[];
    total: number;
    page: number;
    limit: number;
}

export interface SimulationFilters {
    status?: string;
    startDate?: string;
    endDate?: string;
    modmeteo?: string;
    environment?: string;
    dataOrigin?: string;
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
