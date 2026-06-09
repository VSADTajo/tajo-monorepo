import {
    CreateBasinRequestDto,
    CreateBasinResponseDto,
    ListBasinsRequestDto,
    ListBasinsResponseDto,
    GetBasinResponseDto,
    UpdateBasinRequestDto,
    UpdateBasinResponseDto,
    ToggleBasinResponseDto,
    DeleteBasinResponseDto,
} from '@api/dtos/basin.dtos';
import {
    CreateBasinCommand,
    UpdateBasinCommand,
    ToggleBasinCommand,
    DeleteBasinCommand,
} from '@application/commands/basin.commands';
import { GetBasinByIdQuery, ListBasinsQuery } from '@application/queries/basin.queries';
import {
    CreateBasinResult,
    GetBasinResult,
    ListBasinsResult,
    UpdateBasinResult,
    ToggleBasinResult,
    DeleteBasinResult,
} from '@domain/results/basin.results';

// ─────────────────────────────────────────────────────────────
// CreateBasin
// ─────────────────────────────────────────────────────────────

export class CreateBasinMapper {
    static toCommand(dto: CreateBasinRequestDto): CreateBasinCommand {
        return new CreateBasinCommand(dto);
    }

    static toResponseDto(result: CreateBasinResult): CreateBasinResponseDto {
        return {
            id: result.id,
            name: result.name,
            code: result.code,
            description: result.description,
            isActive: result.isActive,
            createdAt: result.createdAt,
            updatedAt: result.updatedAt,
        };
    }
}

// ─────────────────────────────────────────────────────────────
// GetBasinById
// ─────────────────────────────────────────────────────────────

export class GetBasinByIdMapper {
    static toQuery(id: string): GetBasinByIdQuery {
        return new GetBasinByIdQuery({ id });
    }

    static toResponseDto(result: GetBasinResult): GetBasinResponseDto {
        return {
            id: result.id,
            name: result.name,
            code: result.code,
            description: result.description,
            isActive: result.isActive,
            createdAt: result.createdAt,
            updatedAt: result.updatedAt,
            subBasins: result.subBasins.map((sb) => ({
                id: sb.id,
                name: sb.name,
                code: sb.code,
                isActive: sb.isActive,
            })),
        };
    }
}

// ─────────────────────────────────────────────────────────────
// ListBasins
// ─────────────────────────────────────────────────────────────

export class ListBasinsMapper {
    static toQuery(dto: ListBasinsRequestDto): ListBasinsQuery {
        return new ListBasinsQuery({
            page: dto.page,
            limit: dto.limit,
            isActive: dto.isActive,
        });
    }

    static toResponseDto(result: ListBasinsResult): ListBasinsResponseDto {
        return {
            items: result.items.map((item) => ({
                id: item.id,
                name: item.name,
                code: item.code,
                description: item.description,
                isActive: item.isActive,
                createdAt: item.createdAt,
                updatedAt: item.updatedAt,
            })),
            total: result.total,
        };
    }
}

// ─────────────────────────────────────────────────────────────
// UpdateBasin
// ─────────────────────────────────────────────────────────────

export class UpdateBasinMapper {
    static toCommand(id: string, dto: UpdateBasinRequestDto): UpdateBasinCommand {
        return new UpdateBasinCommand({ id, ...dto });
    }

    static toResponseDto(result: UpdateBasinResult): UpdateBasinResponseDto {
        return {
            id: result.id,
            name: result.name,
            code: result.code,
            description: result.description,
            isActive: result.isActive,
            createdAt: result.createdAt,
            updatedAt: result.updatedAt,
        };
    }
}

// ─────────────────────────────────────────────────────────────
// ToggleBasin
// ─────────────────────────────────────────────────────────────

export class ToggleBasinMapper {
    static toCommand(id: string): ToggleBasinCommand {
        return new ToggleBasinCommand({ id });
    }

    static toResponseDto(result: ToggleBasinResult): ToggleBasinResponseDto {
        return {
            id: result.id,
            name: result.name,
            code: result.code,
            isActive: result.isActive,
            updatedAt: result.updatedAt,
        };
    }
}

// ─────────────────────────────────────────────────────────────
// DeleteBasin
// ─────────────────────────────────────────────────────────────

export class DeleteBasinMapper {
    static toCommand(id: string): DeleteBasinCommand {
        return new DeleteBasinCommand({ id });
    }

    static toResponseDto(result: DeleteBasinResult): DeleteBasinResponseDto {
        return {
            id: result.id,
            name: result.name,
            code: result.code,
            isActive: result.isActive,
            updatedAt: result.updatedAt,
        };
    }
}
