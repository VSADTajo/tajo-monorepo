import { HttpStatus, Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Logger } from 'nestjs-pino';

import { ISimulationRepository } from '@domain/ports/simulation-repository.port';
import type { SimulationSortBy, SortOrder } from '@domain/ports/simulation-repository.port';
import { IManeuverRepository } from '@domain/ports/maneuver-repository.port';
import { IPredictionRepository } from '@domain/ports/prediction-repository.port';
import { IStationCatalogService } from '@domain/ports/station-catalog-service.port';
import { SimulationType, SimulationStatus } from '@domain/entities/simulation.entity';
import {
    ManualSimulationResult,
    ManualSimulationListItem,
    PaginatedManualSimulationResult,
} from '@domain/results/manual-simulation.result';
import { SimulationResultsResult } from '@domain/results/simulation-results.result';
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

// ─────────────────────────────────────────────────────────────
// GetSimulationResults
// ─────────────────────────────────────────────────────────────

export interface IGetSimulationResultsQuery {
    id: string;
    stationCode?: string;
    typeName?: string;
}

export class GetSimulationResultsQuery {
    constructor(private readonly parameters: IGetSimulationResultsQuery) {}

    get id(): string {
        return this.parameters.id;
    }

    get stationCode(): string | undefined {
        return this.parameters.stationCode;
    }

    get typeName(): string | undefined {
        return this.parameters.typeName;
    }
}

@QueryHandler(GetSimulationResultsQuery)
export class GetSimulationResultsHandler implements IQueryHandler<GetSimulationResultsQuery, SimulationResultsResult> {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly simulationRepository: ISimulationRepository,
        private readonly predictionRepository: IPredictionRepository,
        private readonly stationCatalog: IStationCatalogService,
    ) {}

    async execute(query: GetSimulationResultsQuery): Promise<SimulationResultsResult> {
        let simulation;
        try {
            simulation = await this.simulationRepository.findById(query.id);
        } catch {
            throw new ApiError(HttpStatus.NOT_FOUND, `Manual simulation with id "${query.id}" not found`);
        }

        if (!simulation || simulation.type !== SimulationType.MANUAL) {
            throw new ApiError(HttpStatus.NOT_FOUND, `Manual simulation with id "${query.id}" not found`);
        }

        const [predictions, stations] = await Promise.all([
            this.predictionRepository.findWithResultsBySimulationId(query.id, {
                stationCode: query.stationCode,
                typeName: query.typeName,
            }),
            this.stationCatalog.listFullStations(),
        ]);

        // Record (plain object) rather than Map so the value survives JSON serialization
        // through the CachingQueryBus / Redis roundtrip.
        const stationsByCode: Record<string, (typeof stations)[number]> = {};
        for (const s of stations) stationsByCode[s.stationCode.toLowerCase()] = s;

        this.logger.debug({
            event: 'query.simulation-results.executed',
            simulationId: query.id,
            stationCode: query.stationCode ?? null,
            typeName: query.typeName ?? null,
            predictionsCount: predictions.length,
            totalResults: predictions.reduce((sum, p) => sum + (p.results?.length ?? 0), 0),
            stationsCatalogSize: Object.keys(stationsByCode).length,
        });

        return new SimulationResultsResult({ simulation, predictions, stationsByCode });
    }
}
