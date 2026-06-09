import {
    CreateCleanupJobRequestDto,
    UpdateCleanupJobRequestDto,
    ToggleCleanupJobRequestDto,
    CleanupJobResponseDto,
    CleanupJobOrNullResponseDto,
    DeleteCleanupJobResponseDto,
} from '@api/dtos/cleanup-job.dtos';
import {
    CreateCleanupJobCommand,
    UpdateCleanupJobCommand,
    ToggleCleanupJobCommand,
    DeleteCleanupJobCommand,
} from '@application/commands/cleanup-job.commands';
import {
    GetCleanupJobByIdQuery,
    GetCleanupJobByPathQuery,
    ListCleanupJobsQuery,
} from '@application/queries/cleanup-job.queries';
import { CleanupJobResult, DeleteCleanupJobResult } from '@domain/results/cleanup-job.result';
import { CleanupFrequency } from '@domain/types/cleanup-frequency.enum';

// ─────────────────────────────────────────────────────────────
// Shared response builder
// ─────────────────────────────────────────────────────────────

function toResponseDto(result: CleanupJobResult): CleanupJobResponseDto {
    return {
        id: result.id,
        directoryPath: result.directoryPath,
        extensions: result.extensions,
        frequency: result.frequency,
        frequencyLabel: result.frequencyLabel,
        isActive: result.isActive,
        lastExecutedAt: result.lastExecutedAt
            ? result.lastExecutedAt instanceof Date
                ? result.lastExecutedAt.toISOString()
                : String(result.lastExecutedAt)
            : null,
        lastExecutionResult: result.lastExecutionResult ?? null,
        nextExecutionAt: result.nextExecutionAt
            ? result.nextExecutionAt instanceof Date
                ? result.nextExecutionAt.toISOString()
                : String(result.nextExecutionAt)
            : null,
        createdAt: result.createdAt instanceof Date ? result.createdAt.toISOString() : String(result.createdAt),
        updatedAt: result.updatedAt instanceof Date ? result.updatedAt.toISOString() : String(result.updatedAt),
    };
}

// ─────────────────────────────────────────────────────────────
// CreateCleanupJob
// ─────────────────────────────────────────────────────────────

export class CreateCleanupJobMapper {
    static toCommand(dto: CreateCleanupJobRequestDto): CreateCleanupJobCommand {
        return new CreateCleanupJobCommand({
            directoryPath: dto.directoryPath,
            extensions: dto.extensions,
            frequency: dto.frequency as CleanupFrequency,
        });
    }

    static toResponseDto(result: CleanupJobResult): CleanupJobResponseDto {
        return toResponseDto(result);
    }
}

// ─────────────────────────────────────────────────────────────
// UpdateCleanupJob
// ─────────────────────────────────────────────────────────────

export class UpdateCleanupJobMapper {
    static toCommand(id: string, dto: UpdateCleanupJobRequestDto): UpdateCleanupJobCommand {
        return new UpdateCleanupJobCommand({
            id,
            extensions: dto.extensions,
            frequency: dto.frequency as CleanupFrequency | undefined,
        });
    }

    static toResponseDto(result: CleanupJobResult): CleanupJobResponseDto {
        return toResponseDto(result);
    }
}

// ─────────────────────────────────────────────────────────────
// ToggleCleanupJob
// ─────────────────────────────────────────────────────────────

export class ToggleCleanupJobMapper {
    static toCommand(id: string, dto: ToggleCleanupJobRequestDto): ToggleCleanupJobCommand {
        return new ToggleCleanupJobCommand({ id, isActive: dto.isActive });
    }

    static toResponseDto(result: CleanupJobResult): CleanupJobResponseDto {
        return toResponseDto(result);
    }
}

// ─────────────────────────────────────────────────────────────
// DeleteCleanupJob
// ─────────────────────────────────────────────────────────────

export class DeleteCleanupJobMapper {
    static toCommand(id: string): DeleteCleanupJobCommand {
        return new DeleteCleanupJobCommand({ id });
    }

    static toResponseDto(result: DeleteCleanupJobResult): DeleteCleanupJobResponseDto {
        return { deletedId: result.deletedId };
    }
}

// ─────────────────────────────────────────────────────────────
// GetCleanupJob
// ─────────────────────────────────────────────────────────────

export class GetCleanupJobMapper {
    static toGetByIdQuery(id: string): GetCleanupJobByIdQuery {
        return new GetCleanupJobByIdQuery(id);
    }

    static toGetByPathQuery(path: string): GetCleanupJobByPathQuery {
        return new GetCleanupJobByPathQuery(path);
    }

    static toListQuery(): ListCleanupJobsQuery {
        return new ListCleanupJobsQuery();
    }

    static toResponseDto(result: CleanupJobResult): CleanupJobResponseDto {
        return toResponseDto(result);
    }

    static toNullableResponseDto(result: CleanupJobResult | null): CleanupJobOrNullResponseDto {
        return { job: result ? toResponseDto(result) : null };
    }

    static toListResponseDto(results: CleanupJobResult[]): CleanupJobResponseDto[] {
        return results.map(toResponseDto);
    }
}
