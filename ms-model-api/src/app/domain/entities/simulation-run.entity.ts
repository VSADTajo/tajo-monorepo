import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { BaseAuditEntity } from '@app/infrastructure/persistence/base-entity';
import { IValidable } from '@domain/types/validable.type';
import { EntityError } from '@domain/errors/entity.error';
import { SimulationRunStatus } from '@domain/types/simulation-run-status.enum';
import { DEFAULT_MODEL_SOURCE } from '@domain/types/model-source.type';
// Type-only: a decorated property's type must not be emitted as a runtime import.
import type { ModelSource } from '@domain/types/model-source.type';

@Entity('simulation_runs')
export class SimulationRun extends BaseAuditEntity implements IValidable {
    constructor(data: Partial<SimulationRun>) {
        super();
        Object.assign(this, data);
    }

    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column('uuid', { nullable: false, unique: true })
    simulationId: string;

    @Column('varchar', { length: 500, nullable: false })
    outputFolder: string;

    @Column('varchar', { length: 20, nullable: false, default: SimulationRunStatus.WAITING_RESULT })
    status: SimulationRunStatus;

    @Column('timestamp', { nullable: false })
    startedAt: Date;

    @Column('timestamp', { nullable: true })
    completedAt: Date | null;

    @Column('text', { nullable: true })
    errorMessage: string | null;

    /**
     * Task id returned by the PI REST service when the run was launched through
     * it. Null for the SFTP flow, where the result arrives as a file and there is
     * no task to follow.
     */
    @Column('varchar', { length: 200, nullable: true })
    fewsTaskId: string | null;

    /**
     * Which model source this run was launched against.
     *
     * Recorded because following a task means going back to the very same PI REST
     * service it was launched on, and the real FEWS and the local fake are
     * different services. Also makes the row self-describing: you can tell from
     * the database alone whether a result came from the model or from the mock.
     */
    @Column('varchar', { length: 20, nullable: false, default: DEFAULT_MODEL_SOURCE })
    modelSource: ModelSource;

    validate(): void {
        if (!this.simulationId) {
            throw new EntityError('simulationId is required', 'simulationId');
        }

        if (!this.outputFolder) {
            throw new EntityError('outputFolder is required', 'outputFolder');
        }

        if (!this.status) {
            throw new EntityError('status is required', 'status');
        }

        if (!this.startedAt) {
            throw new EntityError('startedAt is required', 'startedAt');
        }
    }

    complete(): void {
        this.status = SimulationRunStatus.COMPLETED;
        this.completedAt = new Date();
    }

    fail(error: string): void {
        this.status = SimulationRunStatus.FAILED;
        this.completedAt = new Date();
        this.errorMessage = error;
    }
}
