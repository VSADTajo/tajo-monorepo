import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { BaseAuditEntity } from '@app/infrastructure/persistence/base-entity';
import { IValidable } from '@domain/types/validable.type';
import { EntityError } from '@domain/errors/entity.error';

/**
 * Scenario — a stored test dataset (raw JSON payload) used to load a full
 * station+predictions scenario without running the real pipeline.
 *
 * The payload is persisted verbatim as jsonb; the service does NOT process it
 * nor relate it to the stations table. itemsCount and sizeBytes are derived
 * metadata so the list endpoint can render without shipping the heavy payload.
 */
@Entity('scenarios')
export class Scenario extends BaseAuditEntity implements IValidable {
    constructor(data: Partial<Scenario>) {
        super();
        Object.assign(this, data);
    }

    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column('varchar', { length: 255, nullable: false })
    name: string;

    @Column('text', { nullable: true })
    description: string | null;

    @Column('jsonb', { nullable: false })
    payload: Record<string, unknown>;

    @Column('integer', { nullable: false, default: 0 })
    itemsCount: number;

    @Column('integer', { nullable: false, default: 0 })
    sizeBytes: number;

    validate(): void {
        if (!this.name || this.name.trim().length === 0) {
            throw new EntityError('Scenario name is required', 'name');
        }
        this.name = this.name.trim();

        if (this.payload === null || this.payload === undefined || typeof this.payload !== 'object' || Array.isArray(this.payload)) {
            throw new EntityError('Scenario payload must be a non-null JSON object', 'payload');
        }
    }
}
