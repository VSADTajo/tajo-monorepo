import { Maneuver } from '@domain/entities/maneuver.entity';
import {
    CreateManeuverCommand,
    UpdateManeuverCommand,
    DeleteManeuverCommand,
} from '@application/commands/maneuver.commands';
import { ListManeuversQuery, GetManeuverByIdQuery } from '@application/queries/maneuver.queries';
import {
    CreateManeuverRequestDto,
    UpdateManeuverRequestDto,
    ListManeuversQueryDto,
    ListManeuversResponseDto,
    ManeuverResponseDto,
} from '@api/dtos/maneuver.dtos';
import { PaginatedManeuvers } from '@domain/ports/maneuver-repository.port';

// ─────────────────────────────────────────────────────────────
// CreateManeuver
// ─────────────────────────────────────────────────────────────

export class CreateManeuverMapper {
    static toCommand(dto: CreateManeuverRequestDto): CreateManeuverCommand {
        return new CreateManeuverCommand({
            reservoirCode: dto.reservoirCode,
            outputFlowValue: dto.outputFlowValue,
            startDate: dto.startDate,
            endDate: dto.endDate,
        });
    }

    static toResponseDto(maneuver: Maneuver): ManeuverResponseDto {
        return ManeuverDtoBuilder.fromEntity(maneuver);
    }
}

// ─────────────────────────────────────────────────────────────
// UpdateManeuver
// ─────────────────────────────────────────────────────────────

export class UpdateManeuverMapper {
    static toCommand(id: string, dto: UpdateManeuverRequestDto): UpdateManeuverCommand {
        return new UpdateManeuverCommand({
            id,
            reservoirCode: dto.reservoirCode,
            outputFlowValue: dto.outputFlowValue,
            startDate: dto.startDate,
            endDate: dto.endDate,
        });
    }

    static toResponseDto(maneuver: Maneuver): ManeuverResponseDto {
        return ManeuverDtoBuilder.fromEntity(maneuver);
    }
}

// ─────────────────────────────────────────────────────────────
// DeleteManeuver
// ─────────────────────────────────────────────────────────────

export class DeleteManeuverMapper {
    static toCommand(id: string): DeleteManeuverCommand {
        return new DeleteManeuverCommand({ id });
    }
}

// ─────────────────────────────────────────────────────────────
// ListManeuvers
// ─────────────────────────────────────────────────────────────

export class ListManeuversMapper {
    static toQuery(dto: ListManeuversQueryDto): ListManeuversQuery {
        return new ListManeuversQuery({
            filters: { reservoirCode: dto.reservoirCode },
            page: dto.page ?? 1,
            limit: dto.limit ?? 20,
        });
    }

    static toResponseDto(result: PaginatedManeuvers): ListManeuversResponseDto {
        return {
            data: result.data.map((m) => ManeuverDtoBuilder.fromEntity(m)),
            total: result.total,
            page: result.page,
            limit: result.limit,
        };
    }
}

// ─────────────────────────────────────────────────────────────
// GetManeuverById
// ─────────────────────────────────────────────────────────────

export class GetManeuverByIdMapper {
    static toQuery(id: string): GetManeuverByIdQuery {
        return new GetManeuverByIdQuery({ id });
    }

    static toResponseDto(maneuver: Maneuver): ManeuverResponseDto {
        return ManeuverDtoBuilder.fromEntity(maneuver);
    }
}

// ─────────────────────────────────────────────────────────────
// Shared
// ─────────────────────────────────────────────────────────────

class ManeuverDtoBuilder {
    static fromEntity(m: Maneuver): ManeuverResponseDto {
        return {
            id: m.id,
            reservoirCode: m.reservoirCode,
            outputFlowValue: Number(m.outputFlowValue),
            startDate: m.startDate ?? null,
            endDate: m.endDate ?? null,
            createdAt: m.createdAt,
            updatedAt: m.updatedAt,
        };
    }
}
