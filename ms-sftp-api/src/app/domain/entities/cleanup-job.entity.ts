import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { IValidable } from '@domain/types/validable.type';
import { FileExtensionsValueObject } from '@domain/value-objects/file-extensions.value-object';
import { CleanupFrequency, FREQUENCY_LABEL_MAP } from '@domain/types/cleanup-frequency.enum';
import { EntityError } from '@domain/errors/entity.error';

export interface ICleanupExecutionResult {
    filesDeleted: number;
    error?: string;
}

@Entity('cleanup_jobs')
export class CleanupJob implements IValidable {
    constructor(data?: Partial<CleanupJob>) {
        if (data) {
            Object.assign(this, data);
        }
    }

    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column('varchar', { nullable: false, unique: true })
    directoryPath: string;

    @Column('text', { array: true, nullable: false })
    extensions: string[];

    @Column('varchar', { nullable: false })
    frequency: string;

    @Column('boolean', { nullable: false, default: true })
    isActive: boolean;

    @Column('timestamptz', { nullable: true })
    lastExecutedAt: Date | null;

    @Column('jsonb', { nullable: true })
    lastExecutionResult: ICleanupExecutionResult | null;

    @Column('timestamptz', { nullable: true })
    nextExecutionAt: Date | null;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    get frequencyLabel(): string {
        return FREQUENCY_LABEL_MAP[this.frequency as CleanupFrequency] ?? this.frequency;
    }

    validate(): void {
        if (!this.directoryPath || !this.directoryPath.trim()) {
            throw new EntityError('Directory path is required', 'directoryPath');
        }

        const normalized = this.directoryPath.trim();
        if (!normalized.startsWith('/')) {
            throw new EntityError('Directory path must be absolute (start with /)', 'directoryPath');
        }
        this.directoryPath = normalized;

        const extensions = new FileExtensionsValueObject(this.extensions ?? []);
        this.extensions = extensions.value;

        const validFrequencies = Object.values(CleanupFrequency) as string[];
        if (!validFrequencies.includes(this.frequency)) {
            throw new EntityError(`Frequency must be one of: ${validFrequencies.join(', ')}`, 'frequency');
        }
    }
}
