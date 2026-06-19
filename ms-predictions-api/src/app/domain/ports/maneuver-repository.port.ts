import { Maneuver } from '@domain/entities/maneuver.entity';

export abstract class IManeuverRepository {
    abstract createMany(maneuvers: Maneuver[]): Promise<Maneuver[]>;
    abstract findBySimulationId(simulationId: string): Promise<Maneuver[]>;
}
