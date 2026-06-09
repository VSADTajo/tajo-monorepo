import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { BaseAuditEntity } from '@app/infrastructure/persistence/base-entity';
import { IValidable } from '@domain/types/validable.type';
import { EntityError } from '@domain/errors/entity.error';
import { PercentileValueObject } from '@domain/value-objects/percentile.value-object';
import { PredictionType } from './prediction-type.entity';
import { Simulation } from './simulation.entity';
import { PredictionResult } from './prediction-result.entity';

@Entity('predictions')
export class Prediction extends BaseAuditEntity implements IValidable {
    constructor(data: Partial<Prediction>) {
        super();
        Object.assign(this, data);
    }

    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column('varchar', { length: 50, nullable: false })
    stationId: string;

    @Column('varchar', { length: 200, nullable: true })
    stationName: string | null;

    @Column('uuid', { nullable: false })
    predictionTypeId: string;

    @Column('uuid', { nullable: false })
    simulationId: string;

    @Column('timestamp', { nullable: true })
    predictionDate: Date | null;

    @Column('timestamp', { nullable: true })
    predictionStartDate: Date | null;

    @Column('timestamp', { nullable: true })
    predictionEndDate: Date | null;

    @Column('decimal', { precision: 5, scale: 1, nullable: true })
    percentile: number | null;

    @Column('varchar', { length: 100, nullable: true })
    predictionProvider: string | null;

    @Column('varchar', { length: 30, nullable: true })
    predictedBy: string | null;

    @ManyToOne(() => PredictionType)
    @JoinColumn({ name: 'predictionTypeId' })
    predictionType: PredictionType;

    @ManyToOne(() => Simulation, (s) => s.predictions, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'simulationId' })
    simulation: Simulation;

    @OneToMany(() => PredictionResult, (pr) => pr.prediction)
    results: PredictionResult[];

    validate(): void {
        if (!this.stationId) {
            throw new EntityError('Station ID is required', 'stationId');
        }
        if (!this.predictionTypeId) {
            throw new EntityError('Prediction type ID is required', 'predictionTypeId');
        }
        if (!this.simulationId) {
            throw new EntityError('Simulation ID is required', 'simulationId');
        }
        if (this.percentile !== null && this.percentile !== undefined) {
            const percentile = new PercentileValueObject(this.percentile);
            this.percentile = percentile.value;
        }
    }
}
