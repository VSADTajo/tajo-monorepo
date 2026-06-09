import {
    CreatePredictionTypeRequestDto,
    CreatePredictionTypeResponseDto,
    ListPredictionTypesResponseDto,
} from '@api/dtos/prediction-type.dtos';
import { CreatePredictionTypeCommand } from '@application/commands/prediction-type.commands';
import { ListPredictionTypesQuery } from '@application/queries/prediction-type.queries';
import { ListPredictionTypesResult, PredictionTypeResult } from '@domain/results/prediction-type.result';

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
