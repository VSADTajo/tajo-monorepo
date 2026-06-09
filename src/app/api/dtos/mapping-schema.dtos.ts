import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsArray,
    IsBoolean,
    IsEnum,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsString,
    ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

// ─────────────────────────────────────────────────────────────
// Shared: Enums & Nested DTOs
// ─────────────────────────────────────────────────────────────

export enum InputFormatEnum {
    XML = 'xml',
    CSV = 'csv',
}

export enum OutputFormatEnum {
    JSON = 'json',
    CSV = 'csv',
    DAT = 'dat',
    PARQUET = 'parquet',
}

export enum DataTypeEnum {
    STRING = 'string',
    NUMBER = 'number',
    DATE = 'date',
    BOOLEAN = 'boolean',
}

export class FieldMappingDto {
    @ApiProperty({ description: 'Source field name from the input file', example: 'locationId' })
    @IsNotEmpty()
    @IsString()
    sourceField: string;

    @ApiProperty({ description: 'Target field name in the output', example: 'location_id' })
    @IsNotEmpty()
    @IsString()
    targetField: string;

    @ApiPropertyOptional({
        description: 'Data type for the field',
        enum: DataTypeEnum,
        default: 'string',
        example: 'string',
    })
    @IsOptional()
    @IsEnum(DataTypeEnum)
    dataType?: DataTypeEnum;

    @ApiPropertyOptional({ description: 'Default value if source field is missing', example: 'N/A' })
    @IsOptional()
    @IsString()
    defaultValue?: string;

    @ApiPropertyOptional({
        description: 'Transform to apply (lowercase, uppercase, trim, dateFormat)',
        example: 'lowercase',
    })
    @IsOptional()
    @IsString()
    transform?: string;
}

export class CsvOptionsDto {
    @ApiPropertyOptional({ description: 'Input CSV delimiter', default: ',', example: ';' })
    @IsOptional()
    @IsString()
    delimiter?: string;

    @ApiPropertyOptional({ description: 'Input file encoding', default: 'utf-8', example: 'utf-8' })
    @IsOptional()
    @IsString()
    encoding?: string;

    @ApiPropertyOptional({ description: 'Number of metadata/header rows to skip', default: 0, example: 15 })
    @IsOptional()
    @IsNumber()
    metadataRows?: number;

    @ApiPropertyOptional({ description: 'Output CSV delimiter', default: ',', example: ',' })
    @IsOptional()
    @IsString()
    outputDelimiter?: string;

    @ApiPropertyOptional({ description: 'Include header row in output', default: true, example: true })
    @IsOptional()
    @IsBoolean()
    includeHeader?: boolean;
}

// ─────────────────────────────────────────────────────────────
// CreateMappingSchema
// ─────────────────────────────────────────────────────────────

export class CreateMappingSchemaRequestDto {
    @ApiProperty({ description: 'SFTP directory path', example: '/data/incoming/forecasts' })
    @IsNotEmpty()
    @IsString()
    directoryPath: string;

    @ApiProperty({ description: 'Schema name', example: 'Forecast NAM to JSON' })
    @IsNotEmpty()
    @IsString()
    name: string;

    @ApiProperty({ description: 'Input file format', enum: InputFormatEnum, example: 'xml' })
    @IsNotEmpty()
    @IsEnum(InputFormatEnum)
    inputFormat: InputFormatEnum;

    @ApiProperty({ description: 'Output file format', enum: OutputFormatEnum, example: 'json' })
    @IsNotEmpty()
    @IsEnum(OutputFormatEnum)
    outputFormat: OutputFormatEnum;

    @ApiProperty({
        description: 'Field mappings from source to target',
        type: [FieldMappingDto],
        example: [{ sourceField: 'locationId', targetField: 'location_id', dataType: 'string' }],
    })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => FieldMappingDto)
    fieldMappings: FieldMappingDto[];

    @ApiPropertyOptional({ description: 'CSV-specific options (only for CSV input)', type: CsvOptionsDto })
    @IsOptional()
    @ValidateNested()
    @Type(() => CsvOptionsDto)
    csvOptions?: CsvOptionsDto;
}

// ─────────────────────────────────────────────────────────────
// UpdateMappingSchema
// ─────────────────────────────────────────────────────────────

export class UpdateMappingSchemaRequestDto {
    @ApiPropertyOptional({ description: 'SFTP directory path', example: '/data/incoming/forecasts' })
    @IsOptional()
    @IsString()
    directoryPath?: string;

    @ApiPropertyOptional({ description: 'Schema name', example: 'Forecast NAM to CSV' })
    @IsOptional()
    @IsString()
    name?: string;

    @ApiPropertyOptional({ description: 'Input file format', enum: InputFormatEnum, example: 'xml' })
    @IsOptional()
    @IsEnum(InputFormatEnum)
    inputFormat?: InputFormatEnum;

    @ApiPropertyOptional({ description: 'Output file format', enum: OutputFormatEnum, example: 'csv' })
    @IsOptional()
    @IsEnum(OutputFormatEnum)
    outputFormat?: OutputFormatEnum;

    @ApiPropertyOptional({
        description: 'Field mappings from source to target',
        type: [FieldMappingDto],
    })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => FieldMappingDto)
    fieldMappings?: FieldMappingDto[];

    @ApiPropertyOptional({ description: 'CSV-specific options', type: CsvOptionsDto })
    @IsOptional()
    @ValidateNested()
    @Type(() => CsvOptionsDto)
    csvOptions?: CsvOptionsDto;
}

// ─────────────────────────────────────────────────────────────
// ToggleMappingSchema
// ─────────────────────────────────────────────────────────────

export class ToggleMappingSchemaRequestDto {
    @ApiProperty({ description: 'Whether the mapping is active', example: true })
    @IsBoolean()
    isActive: boolean;
}

// ─────────────────────────────────────────────────────────────
// Response DTOs
// ─────────────────────────────────────────────────────────────

export class FieldMappingResponseDto {
    @ApiProperty({ example: 'locationId' })
    sourceField: string;

    @ApiProperty({ example: 'location_id' })
    targetField: string;

    @ApiProperty({ example: 'string' })
    dataType: string;

    @ApiPropertyOptional({ example: 'N/A' })
    defaultValue?: string;

    @ApiPropertyOptional({ example: 'lowercase' })
    transform?: string;
}

export class CsvOptionsResponseDto {
    @ApiPropertyOptional({ example: ';' })
    delimiter?: string;

    @ApiPropertyOptional({ example: 'utf-8' })
    encoding?: string;

    @ApiPropertyOptional({ example: 15 })
    metadataRows?: number;

    @ApiPropertyOptional({ example: ',' })
    outputDelimiter?: string;

    @ApiPropertyOptional({ example: true })
    includeHeader?: boolean;
}

export class MappingSchemaResponseDto {
    @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
    id: string;

    @ApiProperty({ example: '/data/incoming/forecasts' })
    directoryPath: string;

    @ApiProperty({ example: 'Forecast NAM to JSON' })
    name: string;

    @ApiProperty({ enum: InputFormatEnum, example: 'xml' })
    inputFormat: string;

    @ApiProperty({ enum: OutputFormatEnum, example: 'json' })
    outputFormat: string;

    @ApiProperty({ example: true })
    isActive: boolean;

    @ApiProperty({ type: [FieldMappingResponseDto] })
    fieldMappings: FieldMappingResponseDto[];

    @ApiPropertyOptional({ type: CsvOptionsResponseDto })
    csvOptions?: CsvOptionsResponseDto | null;

    @ApiProperty({ example: '2026-03-05T10:00:00Z' })
    createdAt: string;

    @ApiProperty({ example: '2026-03-05T10:00:00Z' })
    updatedAt: string;
}

export class ListMappingSchemasResponseDto {
    @ApiProperty({ type: [MappingSchemaResponseDto] })
    schemas: MappingSchemaResponseDto[];
}

export class DeleteMappingSchemaResponseDto {
    @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
    deletedId: string;

    @ApiProperty({ example: '/data/incoming/forecasts' })
    directoryPath: string;
}
