import {
    CreateManualSimulationRequestDto,
    ManualSimulationResponseDto,
    ManeuverResponseDto,
    ListManualSimulationsQueryDto,
    ListManualSimulationsResponseDto,
    ManualSimulationListItemDto,
    GetManualSimulationByIdResponseDto,
} from '@api/dtos/simulation.dtos';
import { CreateManualSimulationCommand } from '@application/commands/manual-simulation.commands';
import {
    GetManualSimulationByIdQuery,
    ListManualSimulationsQuery,
} from '@application/queries/manual-simulation.queries';
import { ManualSimulationResult } from '@domain/results/manual-simulation.result';
import { Maneuver } from '@domain/entities/maneuver.entity';
import { PaginatedManualSimulationResult } from '@domain/results/manual-simulation.result';

// ─────────────────────────────────────────────────────────────
// CreateManualSimulation
// ─────────────────────────────────────────────────────────────

export class CreateManualSimulationMapper {
    static toCommand(dto: CreateManualSimulationRequestDto, createdBy: string | null): CreateManualSimulationCommand {
        return new CreateManualSimulationCommand({
            simulationDate: dto.simulationDate,
            description: dto.description,
            createdBy,
            maneuvers: dto.maneuvers.map((m) => ({
                reservoirCode: m.reservoirCode,
                outputFlowValue: m.outputFlowValue,
            })),
        });
    }

    static toResponseDto(result: ManualSimulationResult): ManualSimulationResponseDto {
        return {
            id: result.simulation.id,
            simulationDate: result.simulation.simulationDate,
            status: result.simulation.status,
            type: result.simulation.type,
            description: result.simulation.description ?? null,
            createdBy: result.simulation.createdBy ?? null,
            maneuvers: result.maneuvers.map(
                (m: Maneuver): ManeuverResponseDto => ({
                    id: m.id,
                    reservoirCode: m.reservoirCode,
                    outputFlowValue: Number(m.outputFlowValue),
                }),
            ),
            createdAt: result.simulation.createdAt,
            updatedAt: result.simulation.updatedAt,
        };
    }
}

// ─────────────────────────────────────────────────────────────
// GetManualSimulationById
// ─────────────────────────────────────────────────────────────

export class GetManualSimulationByIdMapper {
    static toQuery(id: string): GetManualSimulationByIdQuery {
        return new GetManualSimulationByIdQuery({ id });
    }

    static toResponseDto(result: ManualSimulationResult): GetManualSimulationByIdResponseDto {
        return {
            id: result.simulation.id,
            simulationDate: result.simulation.simulationDate,
            status: result.simulation.status,
            type: result.simulation.type,
            description: result.simulation.description ?? null,
            createdBy: result.simulation.createdBy ?? null,
            maneuvers: result.maneuvers.map(
                (m: Maneuver): ManeuverResponseDto => ({
                    id: m.id,
                    reservoirCode: m.reservoirCode,
                    outputFlowValue: Number(m.outputFlowValue),
                }),
            ),
            createdAt: result.simulation.createdAt,
            updatedAt: result.simulation.updatedAt,
        };
    }
}

// ─────────────────────────────────────────────────────────────
// ListManualSimulations
// ─────────────────────────────────────────────────────────────

export class ListManualSimulationsMapper {
    static toQuery(dto: ListManualSimulationsQueryDto): ListManualSimulationsQuery {
        return new ListManualSimulationsQuery({
            status: dto.status,
            page: dto.page ?? 1,
            limit: dto.limit ?? 20,
        });
    }

    static toResponseDto(result: PaginatedManualSimulationResult): ListManualSimulationsResponseDto {
        return {
            data: result.data.map(
                (item): ManualSimulationListItemDto => ({
                    id: item.simulation.id,
                    simulationDate: item.simulation.simulationDate,
                    status: item.simulation.status,
                    type: item.simulation.type,
                    description: item.simulation.description ?? null,
                    maneuverCount: item.maneuvers.length,
                    createdAt: item.simulation.createdAt,
                }),
            ),
            total: result.total,
            page: result.page,
            limit: result.limit,
        };
    }
}
