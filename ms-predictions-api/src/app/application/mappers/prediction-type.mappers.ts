import {
    CreatePredictionTypeRequestDto,
    CreatePredictionTypeResponseDto,
    ListPredictionTypesResponseDto,
    StationPredictionTypesResponseDto,
    CoverageMatrixResponseDto,
} from '@api/dtos/prediction-type.dtos';
import { CreatePredictionTypeCommand } from '@application/commands/prediction-type.commands';
import {
    ListPredictionTypesQuery,
    ListStationPredictionTypesQuery,
} from '@application/queries/prediction-type.queries';
import {
    ListPredictionTypesResult,
    PredictionTypeResult,
    StationTypeCoverageResult,
    CoverageMatrixResult,
} from '@domain/results/prediction-type.result';

// ─────────────────────────────────────────────────────────────
// ListPredictionTypes
// ─────────────────────────────────────────────────────────────

export class ListPredictionTypesMapper {
    static toQuery(): ListPredictionTypesQuery {
        return new ListPredictionTypesQuery();
    }

    static toResponseDto(result: ListPredictionTypesResult): ListPredictionTypesResponseDto {
        return {
            predictionTypes: result.predictionTypes.map((pt) => ({
                id: pt.id,
                name: pt.name,
                unit: pt.unit,
            })),
        };
    }
}

// ─────────────────────────────────────────────────────────────
// ListStationPredictionTypes
// ─────────────────────────────────────────────────────────────

export class ListStationPredictionTypesMapper {
    static toQuery(stationCode: string): ListStationPredictionTypesQuery {
        return new ListStationPredictionTypesQuery(stationCode);
    }

    static toResponseDto(result: StationTypeCoverageResult): StationPredictionTypesResponseDto {
        return {
            stationCode: result.stationCode,
            total: result.total,
            withData: result.withData,
            types: result.types.map((t) => ({
                id: t.id,
                name: t.name,
                unit: t.unit,
                hasData: t.lastEntered !== null,
                lastEntered: t.lastEntered,
            })),
        };
    }
}

// ─────────────────────────────────────────────────────────────
// TypeCoverageMatrix
// ─────────────────────────────────────────────────────────────

export class CoverageMatrixMapper {
    static toResponseDto(result: CoverageMatrixResult): CoverageMatrixResponseDto {
        return {
            generatedAt: result.generatedAt,
            types: result.types.map((t) => ({ id: t.id, name: t.name, unit: t.unit })),
            stations: result.stations.map((s) => ({
                stationCode: s.stationCode,
                stationName: s.stationName,
                cells: s.cells,
                withData: s.withData,
            })),
        };
    }
}

// ─────────────────────────────────────────────────────────────
// CreatePredictionType
// ─────────────────────────────────────────────────────────────

export class CreatePredictionTypeMapper {
    static toCommand(dto: CreatePredictionTypeRequestDto): CreatePredictionTypeCommand {
        return new CreatePredictionTypeCommand({ name: dto.name, unit: dto.unit });
    }

    static toResponseDto(result: PredictionTypeResult): CreatePredictionTypeResponseDto {
        return {
            id: result.id,
            name: result.name,
            unit: result.unit,
        };
    }
}
