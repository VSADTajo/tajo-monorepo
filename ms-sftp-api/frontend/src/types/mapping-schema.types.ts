export interface FieldMapping {
    sourceField: string;
    targetField: string;
    dataType?: 'string' | 'number' | 'date' | 'boolean';
    defaultValue?: string;
    transform?: string;
}

export interface CsvOptions {
    delimiter?: string;
    encoding?: string;
    metadataRows?: number;
    outputDelimiter?: string;
    includeHeader?: boolean;
}

export type InputFormat = 'xml' | 'csv';
export type OutputFormat = 'json' | 'csv' | 'dat' | 'parquet';

export interface MappingSchema {
    id: string;
    directoryPath: string;
    name: string;
    inputFormat: InputFormat;
    outputFormat: OutputFormat;
    isActive: boolean;
    fieldMappings: FieldMapping[];
    csvOptions: CsvOptions | null;
    createdAt: string;
    updatedAt: string;
}

export interface CreateMappingSchemaRequest {
    directoryPath: string;
    name: string;
    inputFormat: InputFormat;
    outputFormat: OutputFormat;
    fieldMappings: FieldMapping[];
    csvOptions?: CsvOptions;
}

export interface UpdateMappingSchemaRequest {
    directoryPath?: string;
    name?: string;
    inputFormat?: InputFormat;
    outputFormat?: OutputFormat;
    fieldMappings?: FieldMapping[];
    csvOptions?: CsvOptions;
}

export interface ToggleMappingSchemaRequest {
    isActive: boolean;
}

export interface ListMappingSchemasResponse {
    schemas: MappingSchema[];
}

export interface DeleteMappingSchemaResponse {
    deletedId: string;
    directoryPath: string;
}
