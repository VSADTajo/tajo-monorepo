import { SimulationRun } from '@domain/entities/simulation-run.entity';

export abstract class ISimulationRunRepository {
    abstract create(run: SimulationRun): Promise<SimulationRun>;
    abstract findBySimulationId(simulationId: string): Promise<SimulationRun | null>;
    abstract findWaitingResult(): Promise<SimulationRun[]>;
    abstract update(run: SimulationRun): Promise<SimulationRun>;
}
