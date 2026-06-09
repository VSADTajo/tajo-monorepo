import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { BaseAuditEntity } from '@app/infrastructure/persistence/base-entity';
import { IValidable } from '@domain/types/validable.type';
import { EntityError } from '@domain/errors/entity.error';

@Entity('prediction_types')
export class PredictionType extends BaseAuditEntity implements IValidable {
    constructor(data: Partial<PredictionType>) {
        super();
        Object.assign(this, data);
    }

    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column('varchar', { length: 100, nullable: false, unique: true })
    name: string;

    @Column('varchar', { length: 20, nullable: false })
    unit: string;

    validate(): void {
        if (!this.name) {
            throw new EntityError('Name is required', 'name');
        }
        this.name = this.name.trim();
        if (this.name.length > 100) {
            throw new EntityError('Name must not exceed 100 characters', 'name');
        }

        if (!this.unit) {
            throw new EntityError('Unit is required', 'unit');
        }
        this.unit = this.unit.trim();
        if (this.unit.length > 20) {
            throw new EntityError('Unit must not exceed 20 characters', 'unit');
        }
    }
}
