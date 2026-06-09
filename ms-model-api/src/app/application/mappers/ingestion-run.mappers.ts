import { IngestionRunResponseDto, ListIngestionRunsResponseDto } from '@api/dtos/ingestion-run.dtos';
import { IngestionRunResult } from '@domain/results/ingestion-run.result';

// ─────────────────────────────────────────────────────────────
// ListIngestionRuns
// ─────────────────────────────────────────────────────────────

export class ListIngestionRunsMapper {
    static toResponseDto(runs: IngestionRunResult[]): ListIngestionRunsResponseDto {
        return {
            runs: runs.map((run) => ({
                id: run.id,
                providerConfigId: run.providerConfigId,
                status: run.status,
                startedAt: run.startedAt,
                completedAt: run.completedAt,
                seriesCount: run.seriesCount,
                eventsCount: run.eventsCount,
                errorMessage: run.errorMessage,
                createdAt: run.createdAt,
                updatedAt: run.updatedAt,
            })),
        };
    }
}

// ─────────────────────────────────────────────────────────────
// GetIngestionRunById
// ─────────────────────────────────────────────────────────────

export class GetIngestionRunByIdMapper {
    static toResponseDto(result: IngestionRunResult): IngestionRunResponseDto {
        return {
            id: result.id,
            providerConfigId: result.providerConfigId,
            status: result.status,
            startedAt: result.startedAt,
            completedAt: result.completedAt,
            seriesCount: result.seriesCount,
            eventsCount: result.eventsCount,
            errorMessage: result.errorMessage,
            createdAt: result.createdAt,
            updatedAt: result.updatedAt,
        };
    }
}
