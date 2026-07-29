import { Column, DeleteDateColumn, Entity, JoinTable, ManyToMany, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { BaseAuditEntity } from '@app/infrastructure/persistence/base-entity';
import { IValidable } from '@domain/types/validable.type';
import { SimulationDateValueObject } from '@domain/value-objects/simulation-date.value-object';
import { ApiError } from '@domain/errors/api.error';
import { HttpStatus } from '@nestjs/common';
import type { Prediction } from './prediction.entity';
import type { Maneuver } from './maneuver.entity';

/**
 * Where a manual simulation expects its model output from.
 *   SFTP — the real flow: FEWS leaves the result in the output folder.
 *   MOCK — a known-good reference output is seeded, so the whole pipeline can
 *          be exercised without depending on FEWS.
 *   FEWS_API — the input is pushed to the FEWS PI REST service and the workflow
 *          is launched there, instead of leaving a file for someone to import.
 */
export enum ModelSource {
    SFTP = 'SFTP',
    MOCK = 'MOCK',
    FEWS_API = 'FEWS_API',
}

export enum SimulationStatus {
    CREATED = 'CREATED',
    MODEL_PROCESSING = 'MODEL_PROCESSING',
    IN_PROGRESS = 'IN_PROGRESS',
    FINALIZED = 'FINALIZED',
    MODEL_FAILED = 'MODEL_FAILED',
}

export enum SimulationType {
    AUTOMATIC = 'AUTOMATIC',
    MANUAL = 'MANUAL',
    FORECAST = 'FORECAST',
}

export enum DataOrigin {
    HISTORICAL = 'HISTORICAL',
    FORECAST = 'FORECAST',
}

@Entity('simulations')
export class Simulation extends BaseAuditEntity implements IValidable {
    constructor(data: Partial<Simulation>) {
        super();
        Object.assign(this, data);
    }

    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column('varchar', { length: 14, nullable: false })
    simulationDate: string;

    @Column('varchar', { length: 20, nullable: true })
    jobType: string | null;

    @Column('varchar', { length: 100, nullable: true })
    modmeteo: string | null;

    /**
     * Where the model output comes from: SFTP (the real flow) or MOCK (a
     * reference output seeded so the pipeline can run without FEWS).
     */
    @Column('varchar', { length: 20, nullable: false, default: ModelSource.SFTP })
    modelSource: ModelSource;

    @Column({
        type: 'enum',
        enum: SimulationStatus,
        default: SimulationStatus.CREATED,
    })
    status: SimulationStatus;

    @Column({
        type: 'enum',
        enum: SimulationType,
        default: SimulationType.AUTOMATIC,
    })
    type: SimulationType;

    @Column('varchar', { length: 100, nullable: true })
    environment: string | null;

    @Column('text', { nullable: true })
    description: string | null;

    @Column('varchar', { length: 100, nullable: true })
    createdBy: string | null;

    @Column('varchar', { length: 20, nullable: true, default: 'FORECAST' })
    dataOrigin: DataOrigin | null;

    @DeleteDateColumn()
    deletedAt?: Date;

    @OneToMany('Prediction', (p: Prediction) => p.simulation)
    predictions: Prediction[];

    @ManyToMany('Maneuver', (m: Maneuver) => m.simulations)
    @JoinTable({
        name: 'simulation_maneuvers',
        joinColumn: { name: 'simulationId', referencedColumnName: 'id' },
        inverseJoinColumn: { name: 'maneuverId', referencedColumnName: 'id' },
    })
    maneuvers: Maneuver[];

    validate(): void {
        const simulationDate = new SimulationDateValueObject(this.simulationDate);
        this.simulationDate = simulationDate.value;
    }

    advanceStatus(): void {
        if (this.status === SimulationStatus.FINALIZED) {
            throw new ApiError(HttpStatus.CONFLICT, 'Simulation is already finalized');
        }
        if (this.status === SimulationStatus.MODEL_FAILED) {
            throw new ApiError(HttpStatus.CONFLICT, 'Simulation has failed and cannot advance');
        }
        if (this.status === SimulationStatus.CREATED) {
            this.status = SimulationStatus.MODEL_PROCESSING;
            return;
        }
        if (this.status === SimulationStatus.MODEL_PROCESSING) {
            this.status = SimulationStatus.IN_PROGRESS;
            return;
        }
    }

    finalize(): void {
        if (this.status !== SimulationStatus.IN_PROGRESS && this.status !== SimulationStatus.MODEL_PROCESSING) {
            throw new ApiError(
                HttpStatus.CONFLICT,
                'Simulation can only be finalized from IN_PROGRESS or MODEL_PROCESSING status',
            );
        }
        this.status = SimulationStatus.FINALIZED;
    }

    fail(): void {
        this.status = SimulationStatus.MODEL_FAILED;
    }
}
