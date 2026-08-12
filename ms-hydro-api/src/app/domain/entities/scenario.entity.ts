import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { BaseAuditEntity } from '@app/infrastructure/persistence/base-entity';
import { IValidable } from '@domain/types/validable.type';
import { EntityError } from '@domain/errors/entity.error';
import { ScenarioFile } from '@domain/entities/scenario-file.entity';

/**
 * Scenario — a stored test dataset used to load a full station+predictions
 * scenario without running the real pipeline.
 *
 * A scenario owns N files of any type via the `files` relation (see
 * ScenarioFile). The legacy `payload` jsonb column is kept nullable during the
 * expand-contract migration and will be dropped once every consumer reads files
 * instead; new scenarios do NOT populate it.
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

    /** @deprecated legacy single-JSON storage — kept for the migration window only. */
    @Column('jsonb', { nullable: true })
    payload: Record<string, unknown> | null;

    @Column('integer', { nullable: false, default: 0 })
    itemsCount: number;

    @Column('integer', { nullable: false, default: 0 })
    sizeBytes: number;

    @OneToMany(() => ScenarioFile, (file) => file.scenario, { cascade: true })
    files: ScenarioFile[];

    validate(): void {
        if (!this.name || this.name.trim().length === 0) {
            throw new EntityError('Scenario name is required', 'name');
        }
        this.name = this.name.trim();
    }
}
