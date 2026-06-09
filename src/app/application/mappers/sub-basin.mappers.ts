import {
    CreateSubBasinRequestDto,
    CreateSubBasinResponseDto,
    ListSubBasinsRequestDto,
    ListSubBasinsResponseDto,
    GetSubBasinResponseDto,
    UpdateSubBasinRequestDto,
    UpdateSubBasinResponseDto,
    ToggleSubBasinResponseDto,
    DeleteSubBasinResponseDto,
} from '@api/dtos/sub-basin.dtos';
import { toThresholdDto } from './station.mappers';
import {
    CreateSubBasinCommand,
    UpdateSubBasinCommand,
    ToggleSubBasinCommand,
    DeleteSubBasinCommand,
} from '@application/commands/sub-basin.commands';
import { GetSubBasinByIdQuery, ListSubBasinsQuery } from '@application/queries/sub-basin.queries';
import {
    CreateSubBasinResult,
    GetSubBasinResult,
    ListSubBasinsResult,
    UpdateSubBasinResult,
    ToggleSubBasinResult,
    DeleteSubBasinResult,
} from '@domain/results/sub-basin.results';

// ─────────────────────────────────────────────────────────────
// CreateSubBasin
// ─────────────────────────────────────────────────────────────

export class CreateSubBasinMapper {
    static toCommand(dto: CreateSubBasinRequestDto): CreateSubBasinCommand {
        return new CreateSubBasinCommand(dto);
    }

    static toResponseDto(result: CreateSubBasinResult): CreateSubBasinResponseDto {
        return {
            id: result.id,
            name: result.name,
            code: result.code,
            basinId: result.basinId,
            basinName: result.basinName,
            description: result.description,
            area: result.area,
            perimetro: result.perimetro,
            centroidX: result.centroidX,
            centroidY: result.centroidY,
            isActive: result.isActive,
            createdAt: result.createdAt,
            updatedAt: result.updatedAt,
        };
    }
}

// ─────────────────────────────────────────────────────────────
// GetSubBasinById
// ─────────────────────────────────────────────────────────────

export class GetSubBasinByIdMapper {
    static toQuery(id: string): GetSubBasinByIdQuery {
        return new GetSubBasinByIdQuery({ id });
    }

    static toResponseDto(result: GetSubBasinResult): GetSubBasinResponseDto {
        return {
            id: result.id,
            name: result.name,
            code: result.code,
            basinId: result.basinId,
            basinName: result.basinName,
            description: result.description,
            area: result.area,
            perimetro: result.perimetro,
            centroidX: result.centroidX,
            centroidY: result.centroidY,
            isActive: result.isActive,
            createdAt: result.createdAt,
            updatedAt: result.updatedAt,
            stations: result.stations.map((s) => ({
                id: s.id,
                name: s.name,
                subBasinName: s.subBasinName,
                stationCode: s.stationCode,
                stationType: s.stationType,
                threshold: toThresholdDto(s.threshold),
                isActive: s.isActive,
            })),
        };
    }
}

// ─────────────────────────────────────────────────────────────
// ListSubBasins
// ─────────────────────────────────────────────────────────────

export class ListSubBasinsMapper {
    static toQuery(dto: ListSubBasinsRequestDto): ListSubBasinsQuery {
        return new ListSubBasinsQuery({
            page: dto.page,
            limit: dto.limit,
            basinId: dto.basinId,
            isActive: dto.isActive,
        });
    }

    static toResponseDto(result: ListSubBasinsResult): ListSubBasinsResponseDto {
        return {
            items: result.items.map((item) => ({
                id: item.id,
                name: item.name,
                code: item.code,
                basinId: item.basinId,
                basinName: item.basinName,
                description: item.description,
                area: item.area,
                perimetro: item.perimetro,
                centroidX: item.centroidX,
                centroidY: item.centroidY,
                isActive: item.isActive,
                createdAt: item.createdAt,
                updatedAt: item.updatedAt,
            })),
            total: result.total,
        };
    }
}

// ─────────────────────────────────────────────────────────────
// UpdateSubBasin
// ─────────────────────────────────────────────────────────────

export class UpdateSubBasinMapper {
    static toCommand(id: string, dto: UpdateSubBasinRequestDto): UpdateSubBasinCommand {
        return new UpdateSubBasinCommand({ id, ...dto });
    }

    static toResponseDto(result: UpdateSubBasinResult): UpdateSubBasinResponseDto {
        return {
            id: result.id,
            name: result.name,
            code: result.code,
            basinId: result.basinId,
            basinName: result.basinName,
            description: result.description,
            area: result.area,
            perimetro: result.perimetro,
            centroidX: result.centroidX,
            centroidY: result.centroidY,
            isActive: result.isActive,
            createdAt: result.createdAt,
            updatedAt: result.updatedAt,
        };
    }
}

// ─────────────────────────────────────────────────────────────
// ToggleSubBasin
// ─────────────────────────────────────────────────────────────

export class ToggleSubBasinMapper {
    static toCommand(id: string): ToggleSubBasinCommand {
        return new ToggleSubBasinCommand({ id });
    }

    static toResponseDto(result: ToggleSubBasinResult): ToggleSubBasinResponseDto {
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
// DeleteSubBasin
// ─────────────────────────────────────────────────────────────

export class DeleteSubBasinMapper {
    static toCommand(id: string): DeleteSubBasinCommand {
        return new DeleteSubBasinCommand({ id });
    }

    static toResponseDto(result: DeleteSubBasinResult): DeleteSubBasinResponseDto {
        return {
            id: result.id,
            name: result.name,
            code: result.code,
            isActive: result.isActive,
            updatedAt: result.updatedAt,
        };
    }
}
