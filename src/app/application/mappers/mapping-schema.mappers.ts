import {
    CreateMappingSchemaRequestDto,
    UpdateMappingSchemaRequestDto,
    MappingSchemaResponseDto,
    ListMappingSchemasResponseDto,
    DeleteMappingSchemaResponseDto,
    ToggleMappingSchemaRequestDto,
} from '@api/dtos/mapping-schema.dtos';
import {
    CreateMappingSchemaCommand,
    UpdateMappingSchemaCommand,
    DeleteMappingSchemaCommand,
    ToggleMappingSchemaCommand,
} from '@application/commands/mapping-schema.commands';
import { ListMappingSchemasQuery, GetMappingSchemaByIdQuery } from '@application/queries/mapping-schema.queries';
import {
    MappingSchemaResult,
    ListMappingSchemasResult,
    DeleteMappingSchemaResult,
} from '@domain/results/mapping-schema.result';

// ─────────────────────────────────────────────────────────────
// Shared: Result -> ResponseDto
// ─────────────────────────────────────────────────────────────

function toSchemaResponseDto(result: MappingSchemaResult): MappingSchemaResponseDto {
    return {
        id: result.id,
        directoryPath: result.directoryPath,
        name: result.name,
        inputFormat: result.inputFormat,
        outputFormat: result.outputFormat,
        isActive: result.isActive,
        fieldMappings: result.fieldMappings.map((fm) => ({
            sourceField: fm.sourceField,
            targetField: fm.targetField,
            dataType: fm.dataType ?? 'string',
            defaultValue: fm.defaultValue,
            transform: fm.transform,
        })),
        csvOptions: result.csvOptions,
        createdAt: result.createdAt instanceof Date ? result.createdAt.toISOString() : String(result.createdAt),
        updatedAt: result.updatedAt instanceof Date ? result.updatedAt.toISOString() : String(result.updatedAt),
    };
}

// ─────────────────────────────────────────────────────────────
// CreateMappingSchema
// ─────────────────────────────────────────────────────────────

export class CreateMappingSchemaMapper {
    static toCommand(dto: CreateMappingSchemaRequestDto): CreateMappingSchemaCommand {
        return new CreateMappingSchemaCommand({
            directoryPath: dto.directoryPath,
            name: dto.name,
            inputFormat: dto.inputFormat,
            outputFormat: dto.outputFormat,
            fieldMappings: dto.fieldMappings,
            csvOptions: dto.csvOptions ?? null,
        });
    }

    static toResponseDto(result: MappingSchemaResult): MappingSchemaResponseDto {
        return toSchemaResponseDto(result);
    }
}

// ─────────────────────────────────────────────────────────────
// UpdateMappingSchema
// ─────────────────────────────────────────────────────────────

export class UpdateMappingSchemaMapper {
    static toCommand(id: string, dto: UpdateMappingSchemaRequestDto): UpdateMappingSchemaCommand {
        return new UpdateMappingSchemaCommand({
            id,
            directoryPath: dto.directoryPath,
            name: dto.name,
            inputFormat: dto.inputFormat,
            outputFormat: dto.outputFormat,
            fieldMappings: dto.fieldMappings,
            csvOptions: dto.csvOptions,
        });
    }

    static toResponseDto(result: MappingSchemaResult): MappingSchemaResponseDto {
        return toSchemaResponseDto(result);
    }
}

// ─────────────────────────────────────────────────────────────
// DeleteMappingSchema
// ─────────────────────────────────────────────────────────────

export class DeleteMappingSchemaMapper {
    static toCommand(id: string): DeleteMappingSchemaCommand {
        return new DeleteMappingSchemaCommand({ id });
    }

    static toResponseDto(result: DeleteMappingSchemaResult): DeleteMappingSchemaResponseDto {
        return {
            deletedId: result.deletedId,
            directoryPath: result.directoryPath,
        };
    }
}

// ─────────────────────────────────────────────────────────────
// ToggleMappingSchema
// ─────────────────────────────────────────────────────────────

export class ToggleMappingSchemaMapper {
    static toCommand(id: string, dto: ToggleMappingSchemaRequestDto): ToggleMappingSchemaCommand {
        return new ToggleMappingSchemaCommand({ id, isActive: dto.isActive });
    }

    static toResponseDto(result: MappingSchemaResult): MappingSchemaResponseDto {
        return toSchemaResponseDto(result);
    }
}

// ─────────────────────────────────────────────────────────────
// ListMappingSchemas
// ─────────────────────────────────────────────────────────────

export class ListMappingSchemasMapper {
    static toQuery(): ListMappingSchemasQuery {
        return new ListMappingSchemasQuery();
    }

    static toResponseDto(result: ListMappingSchemasResult): ListMappingSchemasResponseDto {
        return {
            schemas: result.schemas.map(toSchemaResponseDto),
        };
    }
}

// ─────────────────────────────────────────────────────────────
// GetMappingSchemaById
// ─────────────────────────────────────────────────────────────

export class GetMappingSchemaByIdMapper {
    static toQuery(id: string): GetMappingSchemaByIdQuery {
        return new GetMappingSchemaByIdQuery({ id });
    }

    static toResponseDto(result: MappingSchemaResult): MappingSchemaResponseDto {
        return toSchemaResponseDto(result);
    }
}
