import { HttpStatus, Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Logger } from 'nestjs-pino';

import { ISimulationRepository } from '@domain/ports/simulation-repository.port';
import type { SimulationSortBy, SortOrder } from '@domain/ports/simulation-repository.port';
import { IManeuverRepository } from '@domain/ports/maneuver-repository.port';
import { SimulationType, SimulationStatus } from '@domain/entities/simulation.entity';
import {
    ManualSimulationResult,
    ManualSimulationListItem,
    PaginatedManualSimulationResult,
} from '@domain/results/manual-simulation.result';
import { ApiError } from '@domain/errors/api.error';

// ─────────────────────────────────────────────────────────────
// GetManualSimulationById
// ─────────────────────────────────────────────────────────────

export interface IGetManualSimulationByIdQuery {
    id: string;
}

export class GetManualSimulationByIdQuery {
    constructor(private readonly parameters: IGetManualSimulationByIdQuery) {}

    get id(): string {
        return this.parameters.id;
    }
}

@QueryHandler(GetManualSimulationByIdQuery)
export class GetManualSimulationByIdHandler implements IQueryHandler<
    GetManualSimulationByIdQuery,
    ManualSimulationResult
> {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly simulationRepository: ISimulationRepository,
        private readonly maneuverRepository: IManeuverRepository,
    ) {}

    async execute(query: GetManualSimulationByIdQuery): Promise<ManualSimulationResult> {
        this.logger.debug(`Getting manual simulation by id: ${query.id}`);

        let simulation;
        try {
            simulation = await this.simulationRepository.findById(query.id);
        } catch {
            throw new ApiError(HttpStatus.NOT_FOUND, `Manual simulation with id "${query.id}" not found`);
        }

        if (!simulation || simulation.type !== SimulationType.MANUAL) {
            throw new ApiError(HttpStatus.NOT_FOUND, `Manual simulation with id "${query.id}" not found`);
        }

        const maneuvers = await this.maneuverRepository.findBySimulationId(query.id);

        return new ManualSimulationResult({ simulation, maneuvers });
    }
}

// ─────────────────────────────────────────────────────────────
// ListManualSimulations
// ─────────────────────────────────────────────────────────────

export interface IListManualSimulationsQuery {
    status?: SimulationStatus;
    stationCode?: string;
    sortBy?: SimulationSortBy;
    sortOrder?: SortOrder;
    page: number;
    limit: number;
}

export class ListManualSimulationsQuery {
    constructor(private readonly parameters: IListManualSimulationsQuery) {}

    get status(): SimulationStatus | undefined {
        return this.parameters.status;
    }

    get stationCode(): string | undefined {
        return this.parameters.stationCode;
    }

    get sortBy(): SimulationSortBy | undefined {
        return this.parameters.sortBy;
    }

    get sortOrder(): SortOrder | undefined {
        return this.parameters.sortOrder;
    }

    get page(): number {
        return this.parameters.page;
    }

    get limit(): number {
        return this.parameters.limit;
    }
}

@QueryHandler(ListManualSimulationsQuery)
export class ListManualSimulationsHandler implements IQueryHandler<
    ListManualSimulationsQuery,
    PaginatedManualSimulationResult
> {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly simulationRepository: ISimulationRepository,
        private readonly maneuverRepository: IManeuverRepository,
    ) {}

    async execute(query: ListManualSimulationsQuery): Promise<PaginatedManualSimulationResult> {
        this.logger.debug('Listing manual simulations');

        const paginatedSimulations = await this.simulationRepository.findManual(
            {
                status: query.status,
                stationCode: query.stationCode,
                sortBy: query.sortBy,
                sortOrder: query.sortOrder,
            },
            query.page,
            query.limit,
        );

        const simulationIds = paginatedSimulations.data.map((simulation) => simulation.id);
        const maneuversBySimulationId = await this.maneuverRepository.findBySimulationIds(simulationIds);

        const data = paginatedSimulations.data.map(
            (simulation) =>
                new ManualSimulationListItem({
                    simulation,
                    maneuvers: maneuversBySimulationId[simulation.id] ?? [],
                }),
        );

        return new PaginatedManualSimulationResult({
            data,
            total: paginatedSimulations.total,
            page: paginatedSimulations.page,
            limit: paginatedSimulations.limit,
        });
    }
}
