import {
    CreateScenarioRequestDto,
    CreateScenarioResponseDto,
    ListScenariosRequestDto,
    ListScenariosResponseDto,
    GetScenarioResponseDto,
    DeleteScenarioResponseDto,
} from '@api/dtos/scenario.dtos';
import { CreateScenarioCommand, DeleteScenarioCommand } from '@application/commands/scenario.commands';
import { GetScenarioByIdQuery, ListScenariosQuery } from '@application/queries/scenario.queries';
import {
    ScenarioMetadataResult,
    ListScenariosResult,
    GetScenarioResult,
    DeleteScenarioResult,
} from '@domain/results/scenario.results';

// ─────────────────────────────────────────────────────────────
// CreateScenario
// ─────────────────────────────────────────────────────────────

export class CreateScenarioMapper {
    static toCommand(dto: CreateScenarioRequestDto): CreateScenarioCommand {
        return new CreateScenarioCommand({
            name: dto.name,
            description: dto.description ?? null,
            payload: dto.payload,
        });
    }

    static toResponseDto(result: ScenarioMetadataResult): CreateScenarioResponseDto {
        return {
            id: result.id,
            name: result.name,
            description: result.description,
            itemsCount: result.itemsCount,
            sizeBytes: result.sizeBytes,
            createdAt: result.createdAt,
            updatedAt: result.updatedAt,
        };
    }
}

// ─────────────────────────────────────────────────────────────
// ListScenarios
// ─────────────────────────────────────────────────────────────

export class ListScenariosMapper {
    static toQuery(dto: ListScenariosRequestDto): ListScenariosQuery {
        return new ListScenariosQuery({ page: dto.page, limit: dto.limit });
    }

    static toResponseDto(result: ListScenariosResult): ListScenariosResponseDto {
        return {
            items: result.items.map((item) => ({
                id: item.id,
                name: item.name,
                description: item.description,
                itemsCount: item.itemsCount,
                sizeBytes: item.sizeBytes,
                createdAt: item.createdAt,
                updatedAt: item.updatedAt,
            })),
            total: result.total,
        };
    }
}

// ─────────────────────────────────────────────────────────────
// GetScenarioById
// ─────────────────────────────────────────────────────────────

export class GetScenarioByIdMapper {
    static toQuery(id: string): GetScenarioByIdQuery {
        return new GetScenarioByIdQuery({ id });
    }

    static toResponseDto(result: GetScenarioResult): GetScenarioResponseDto {
        return {
            id: result.id,
            name: result.name,
            description: result.description,
            itemsCount: result.itemsCount,
            sizeBytes: result.sizeBytes,
            payload: result.payload,
            createdAt: result.createdAt,
            updatedAt: result.updatedAt,
        };
    }
}

// ─────────────────────────────────────────────────────────────
// DeleteScenario
// ─────────────────────────────────────────────────────────────

export class DeleteScenarioMapper {
    static toCommand(id: string): DeleteScenarioCommand {
        return new DeleteScenarioCommand({ id });
    }

    static toResponseDto(result: DeleteScenarioResult): DeleteScenarioResponseDto {
        return { id: result.id, deleted: result.deleted };
    }
}
