import { Column, Entity, ManyToMany, PrimaryGeneratedColumn } from 'typeorm';
import { BaseAuditEntity } from '@app/infrastructure/persistence/base-entity';
import { IValidable } from '@domain/types/validable.type';
import { EntityError } from '@domain/errors/entity.error';
import type { Simulation } from './simulation.entity';

@Entity('maneuvers')
export class Maneuver extends BaseAuditEntity implements IValidable {
    constructor(data: Partial<Maneuver>) {
        super();
        Object.assign(this, data);
    }

    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column('varchar', { length: 100, nullable: false })
    reservoirCode: string;

    @Column('numeric', { precision: 12, scale: 4, nullable: false })
    outputFlowValue: number;

    @ManyToMany('Simulation', (s: Simulation) => s.maneuvers)
    simulations: Simulation[];

    validate(): void {
        if (!this.reservoirCode?.trim()) {
            throw new EntityError('reservoirCode is required', 'reservoirCode');
        }
        if (this.outputFlowValue === null || this.outputFlowValue === undefined) {
            throw new EntityError('outputFlowValue is required', 'outputFlowValue');
        }
        if (Number(this.outputFlowValue) < 0) {
            throw new EntityError('outputFlowValue must be non-negative', 'outputFlowValue');
        }
    }
}
