import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { BaseAuditEntity } from '@app/infrastructure/persistence/base-entity';
import { IValidable } from '@domain/types/validable.type';
import { EntityError } from '@domain/errors/entity.error';
import { Scenario } from '@domain/entities/scenario.entity';

/**
 * ScenarioFile — one uploaded file belonging to a Scenario.
 *
 * A scenario can hold N files of ANY type (JSON, CSV, xlsx, ...). The raw bytes
 * are stored verbatim in `content` (bytea) and NEVER parsed nor validated as a
 * particular format; `contentType` records the MIME type so the download
 * endpoint can serve the file with the right header.
 */
@Entity('scenario_files')
export class ScenarioFile extends BaseAuditEntity implements IValidable {
    constructor(data: Partial<ScenarioFile>) {
        super();
        Object.assign(this, data);
    }

    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column('uuid', { nullable: false })
    scenarioId: string;

    @ManyToOne(() => Scenario, (scenario) => scenario.files, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'scenarioId' })
    scenario: Scenario;

    @Column('varchar', { length: 255, nullable: false })
    filename: string;

    @Column('varchar', { length: 255, nullable: false })
    contentType: string;

    @Column({ type: 'bytea', nullable: false })
    content: Buffer;

    @Column('integer', { nullable: false, default: 0 })
    sizeBytes: number;

    validate(): void {
        if (!this.scenarioId) {
            throw new EntityError('scenarioId is required', 'scenarioId');
        }
        if (!this.filename || this.filename.trim().length === 0) {
            throw new EntityError('File name is required', 'filename');
        }
        this.filename = this.filename.trim();

        if (!this.contentType || this.contentType.trim().length === 0) {
            throw new EntityError('contentType is required', 'contentType');
        }
        this.contentType = this.contentType.trim();

        if (!this.content || this.content.length === 0) {
            throw new EntityError('File content must not be empty', 'content');
        }

        this.sizeBytes = this.content.length;
    }
}
