import { IFieldMapping } from '@domain/value-objects/field-mapping.value-object';
import { ICsvOptions, InputFormat, OutputFormat } from '@domain/entities/mapping-schema.entity';

// ─────────────────────────────────────────────────────────────
// MappingSchemaResult
// ─────────────────────────────────────────────────────────────

export interface IMappingSchemaResult {
    id: string;
    directoryPath: string;
    name: string;
    inputFormat: InputFormat;
    outputFormat: OutputFormat;
    isActive: boolean;
    fieldMappings: IFieldMapping[];
    csvOptions: ICsvOptions | null;
    createdAt: Date;
    updatedAt: Date;
}

export class MappingSchemaResult {
    readonly id: string;
    readonly directoryPath: string;
    readonly name: string;
    readonly inputFormat: InputFormat;
    readonly outputFormat: OutputFormat;
    readonly isActive: boolean;
    readonly fieldMappings: IFieldMapping[];
    readonly csvOptions: ICsvOptions | null;
    readonly createdAt: Date;
    readonly updatedAt: Date;

    constructor(params: IMappingSchemaResult) {
        this.id = params.id;
        this.directoryPath = params.directoryPath;
        this.name = params.name;
        this.inputFormat = params.inputFormat;
        this.outputFormat = params.outputFormat;
        this.isActive = params.isActive;
        this.fieldMappings = params.fieldMappings;
        this.csvOptions = params.csvOptions;
        this.createdAt = params.createdAt;
        this.updatedAt = params.updatedAt;
    }
}

// ─────────────────────────────────────────────────────────────
// ListMappingSchemasResult
// ─────────────────────────────────────────────────────────────

export class ListMappingSchemasResult {
    readonly schemas: MappingSchemaResult[];

    constructor(schemas: MappingSchemaResult[]) {
        this.schemas = schemas;
    }
}

// ─────────────────────────────────────────────────────────────
// DeleteMappingSchemaResult
// ─────────────────────────────────────────────────────────────

export class DeleteMappingSchemaResult {
    readonly deletedId: string;
    readonly directoryPath: string;

    constructor(params: { deletedId: string; directoryPath: string }) {
        this.deletedId = params.deletedId;
        this.directoryPath = params.directoryPath;
    }
}
