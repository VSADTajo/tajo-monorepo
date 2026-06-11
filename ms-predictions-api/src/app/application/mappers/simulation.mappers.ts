import {
    SimulationItemDto,
    ListSimulationsResponseDto,
    GetSimulationByDateResponseDto,
    LatestSimulationResponseDto,
    HistoricalSimulationsResponseDto,
    FinalizeSimulationResponseDto,
    SimulationAvailableDatesResponseDto,
    BatchIngestRequestDto,
    BatchIngestResponseDto,
} from '@api/dtos/simulation.dtos';
import { BatchIngestCommand, BatchIngestResult } from '@application/commands/simulation.commands';
import { Simulation } from '@domain/entities/simulation.entity';
import { PaginatedResult } from '@domain/ports/simulation-repository.port';

// ─────────────────────────────────────────────────────────────
// Shared: Entity → SimulationItemDto
// ─────────────────────────────────────────────────────────────

function toSimulationItemDto(entity: Simulation, predictionCount?: number): SimulationItemDto {
    return {
        id: entity.id,
        simulationDate: entity.simulationDate,
        jobType: entity.jobType,
        modmeteo: entity.modmeteo,
        status: entity.status,
        type: entity.type,
        environment: entity.environment,
        description: entity.description,
        createdBy: entity.createdBy,
        dataOrigin: entity.dataOrigin,
        createdAt: entity.createdAt,
        updatedAt: entity.updatedAt,
        ...(predictionCount !== undefined ? { predictionCount } : {}),
    };
}

// ─────────────────────────────────────────────────────────────
// ListSimulations
// ─────────────────────────────────────────────────────────────

export class ListSimulationsMapper {
    static toResponseDto(result: PaginatedResult<Simulation>): ListSimulationsResponseDto {
        return {
            data: result.data.map((s) => toSimulationItemDto(s, s.predictions?.length)),
            total: result.total,
            page: result.page,
            limit: result.limit,
        };
    }
}

// ─────────────────────────────────────────────────────────────
// GetSimulationByDate
// ─────────────────────────────────────────────────────────────

export class GetSimulationByDateMapper {
    static toResponseDto(entity: Simulation): GetSimulationByDateResponseDto {
        return toSimulationItemDto(entity, entity.predictions?.length);
    }
}

// ─────────────────────────────────────────────────────────────
// LatestSimulation
// ─────────────────────────────────────────────────────────────

export class LatestSimulationMapper {
    static toResponseDto(entity: Simulation): LatestSimulationResponseDto {
        return toSimulationItemDto(entity, entity.predictions?.length);
    }
}

// ─────────────────────────────────────────────────────────────
// HistoricalSimulations
// ─────────────────────────────────────────────────────────────

export class HistoricalSimulationsMapper {
    static toResponseDto(result: PaginatedResult<Simulation>): HistoricalSimulationsResponseDto {
        return {
            data: result.data.map((s) => toSimulationItemDto(s, s.predictions?.length)),
            total: result.total,
            page: result.page,
            limit: result.limit,
        };
    }
}

// ─────────────────────────────────────────────────────────────
// FinalizeSimulation
// ─────────────────────────────────────────────────────────────

export class FinalizeSimulationMapper {
    static toResponseDto(entity: Simulation): FinalizeSimulationResponseDto {
        return toSimulationItemDto(entity);
    }
}

// ─────────────────────────────────────────────────────────────
// AvailableDates
// ─────────────────────────────────────────────────────────────

export class AvailableDatesMapper {
    static toResponseDto(dates: string[]): SimulationAvailableDatesResponseDto {
        return { dates };
    }
}

// ─────────────────────────────────────────────────────────────
// BatchIngest
// ─────────────────────────────────────────────────────────────

export class BatchIngestMapper {
    static toCommand(dto: BatchIngestRequestDto): BatchIngestCommand {
        return new BatchIngestCommand(dto);
    }

    static toResponseDto(result: BatchIngestResult): BatchIngestResponseDto {
        return {
            simulationId: result.simulationId,
            processedCount: result.processedCount,
            errors: result.errors,
        };
    }
}
