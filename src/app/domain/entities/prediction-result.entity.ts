import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { IValidable } from '@domain/types/validable.type';
import { EntityError } from '@domain/errors/entity.error';
import { Prediction } from './prediction.entity';

@Entity('prediction_results')
export class PredictionResult implements IValidable {
    constructor(data: Partial<PredictionResult>) {
        Object.assign(this, data);
    }

    @PrimaryGeneratedColumn('increment')
    id: number;

    @Column('uuid', { nullable: false })
    predictionId: string;

    @Column('timestamp', { nullable: false })
    date: Date;

    @Column('double precision', { nullable: false })
    value: number;

    @Column('integer', { default: 0 })
    flag: number;

    @CreateDateColumn()
    createdAt: Date;

    @ManyToOne(() => Prediction, (p) => p.results, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'predictionId' })
    prediction: Prediction;

    validate(): void {
        if (!this.predictionId) {
            throw new EntityError('Prediction ID is required', 'predictionId');
        }
        if (!this.date) {
            throw new EntityError('Date is required', 'date');
        }
        if (typeof this.value !== 'number') {
            throw new EntityError('Value is required and must be a number', 'value');
        }
    }
}
