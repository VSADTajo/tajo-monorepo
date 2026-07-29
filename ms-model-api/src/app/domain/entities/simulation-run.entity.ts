import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { BaseAuditEntity } from '@app/infrastructure/persistence/base-entity';
import { IValidable } from '@domain/types/validable.type';
import { EntityError } from '@domain/errors/entity.error';
import { SimulationRunStatus } from '@domain/types/simulation-run-status.enum';

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
     * Task id returned by FEWS when the run was launched through the REST API.
     * Null for the SFTP and MOCK flows, where the result arrives as a file and
     * there is no task to follow.
     */
    @Column('varchar', { length: 200, nullable: true })
    fewsTaskId: string | null;

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
