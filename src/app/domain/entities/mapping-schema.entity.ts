import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { IValidable } from '@domain/types/validable.type';
import { DirectoryPathValueObject } from '@domain/value-objects/directory-path.value-object';
import { FieldMappingValueObject, IFieldMapping } from '@domain/value-objects/field-mapping.value-object';
import { EntityError } from '@domain/errors/entity.error';

export interface ICsvOptions {
    delimiter?: string;
    encoding?: string;
    metadataRows?: number;
    outputDelimiter?: string;
    includeHeader?: boolean;
}

export type InputFormat = 'xml' | 'csv';
export type OutputFormat = 'json' | 'csv' | 'dat' | 'parquet';

const VALID_INPUT_FORMATS: InputFormat[] = ['xml', 'csv'];
const VALID_OUTPUT_FORMATS: OutputFormat[] = ['json', 'csv', 'dat', 'parquet'];

@Entity('mapping_schemas')
export class MappingSchema implements IValidable {
    constructor(data?: Partial<MappingSchema>) {
        if (data) {
            Object.assign(this, data);
        }
    }

    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column('varchar', { length: 500, nullable: false, unique: true })
    directoryPath: string;

    @Column('varchar', { length: 255, nullable: false })
    name: string;

    @Column('varchar', { length: 20, nullable: false })
    inputFormat: InputFormat;

    @Column('varchar', { length: 20, nullable: false })
    outputFormat: OutputFormat;

    @Column('boolean', { nullable: false, default: true })
    isActive: boolean;

    @Column('jsonb', { nullable: false })
    fieldMappings: IFieldMapping[];

    @Column('jsonb', { nullable: true })
    csvOptions: ICsvOptions | null;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    validate(): void {
        const dirPath = new DirectoryPathValueObject(this.directoryPath);
        this.directoryPath = dirPath.value;

        if (!this.name || !this.name.trim()) {
            throw new EntityError('Schema name is required', 'name');
        }
        this.name = this.name.trim();

        if (!VALID_INPUT_FORMATS.includes(this.inputFormat)) {
            throw new EntityError(`Input format must be one of: ${VALID_INPUT_FORMATS.join(', ')}`, 'inputFormat');
        }

        if (!VALID_OUTPUT_FORMATS.includes(this.outputFormat)) {
            throw new EntityError(`Output format must be one of: ${VALID_OUTPUT_FORMATS.join(', ')}`, 'outputFormat');
        }

        FieldMappingValueObject.validateArray(this.fieldMappings);
    }
}
