import { HttpStatus, Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Logger } from 'nestjs-pino';

// Domain
import { ISimulationRepository, PaginatedResult, SimulationFilters } from '@domain/ports/simulation-repository.port';
import { Simulation } from '@domain/entities/simulation.entity';
import { ApiError } from '@domain/errors/api.error';

// ─────────────────────────────────────────────────────────────
// ListSimulations
// ─────────────────────────────────────────────────────────────

export interface IListSimulationsQuery {
    filters: SimulationFilters;
    page: number;
    limit: number;
}

export class ListSimulationsQuery {
    constructor(private readonly parameters: IListSimulationsQuery) {}

    get filters(): SimulationFilters {
        return this.parameters.filters;
    }

    get page(): number {
        return this.parameters.page;
    }

    get limit(): number {
        return this.parameters.limit;
    }
}

@QueryHandler(ListSimulationsQuery)
export class ListSimulationsHandler implements IQueryHandler<ListSimulationsQuery, PaginatedResult<Simulation>> {
    constructor(
        @Inject(Logger)
        private readonly logger: Logger,
        private readonly simulationRepository: ISimulationRepository,
    ) {}

    async execute(query: ListSimulationsQuery): Promise<PaginatedResult<Simulation>> {
        this.logger.debug('Listing simulations');

        return this.simulationRepository.findAll(query.filters, query.page, query.limit);
    }
}

// ─────────────────────────────────────────────────────────────
// GetSimulationByDate
// ─────────────────────────────────────────────────────────────

export interface IGetSimulationByDateQuery {
    simulationDate: string;
}

export class GetSimulationByDateQuery {
    constructor(private readonly parameters: IGetSimulationByDateQuery) {}

    get simulationDate(): string {
        return this.parameters.simulationDate;
    }
}

@QueryHandler(GetSimulationByDateQuery)
export class GetSimulationByDateHandler implements IQueryHandler<GetSimulationByDateQuery, Simulation> {
    constructor(
        @Inject(Logger)
        private readonly logger: Logger,
        private readonly simulationRepository: ISimulationRepository,
    ) {}

    async execute(query: GetSimulationByDateQuery): Promise<Simulation> {
        this.logger.debug(`Getting simulation by date: ${query.simulationDate}`);

        const simulation = await this.simulationRepository.findByDate(query.simulationDate);

        if (!simulation) {
            throw new ApiError(HttpStatus.NOT_FOUND, `Simulation with date "${query.simulationDate}" not found`);
        }

        return simulation;
    }
}

// ─────────────────────────────────────────────────────────────
// GetLatestSimulation
// ─────────────────────────────────────────────────────────────

export class GetLatestSimulationQuery {}

@QueryHandler(GetLatestSimulationQuery)
export class GetLatestSimulationHandler implements IQueryHandler<GetLatestSimulationQuery, Simulation> {
    constructor(
        @Inject(Logger)
        private readonly logger: Logger,
        private readonly simulationRepository: ISimulationRepository,
    ) {}

    async execute(): Promise<Simulation> {
        this.logger.debug('Getting latest finalized simulation');

        const simulation = await this.simulationRepository.findLatestFinalized();

        if (!simulation) {
            throw new ApiError(HttpStatus.NOT_FOUND, 'No finalized simulation found');
        }

        return simulation;
    }
}

// ─────────────────────────────────────────────────────────────
// GetHistoricalSimulations
// ─────────────────────────────────────────────────────────────

export interface IGetHistoricalSimulationsQuery {
    page: number;
    limit: number;
}

export class GetHistoricalSimulationsQuery {
    constructor(private readonly parameters: IGetHistoricalSimulationsQuery) {}

    get page(): number {
        return this.parameters.page;
    }

    get limit(): number {
        return this.parameters.limit;
    }
}

@QueryHandler(GetHistoricalSimulationsQuery)
export class GetHistoricalSimulationsHandler implements IQueryHandler<
    GetHistoricalSimulationsQuery,
    PaginatedResult<Simulation>
> {
    constructor(
        @Inject(Logger)
        private readonly logger: Logger,
        private readonly simulationRepository: ISimulationRepository,
    ) {}

    async execute(query: GetHistoricalSimulationsQuery): Promise<PaginatedResult<Simulation>> {
        this.logger.debug('Getting historical simulations');

        return this.simulationRepository.findHistorical(query.page, query.limit);
    }
}

// ─────────────────────────────────────────────────────────────
// GetAvailableDates
// ─────────────────────────────────────────────────────────────

export interface IGetAvailableDatesQuery {
    dataOrigin?: string;
    predictionTypes?: string[];
}

export class GetAvailableDatesQuery {
    constructor(private readonly parameters?: IGetAvailableDatesQuery) {}

    get dataOrigin(): string | undefined {
        return this.parameters?.dataOrigin;
    }

    get predictionTypes(): string[] | undefined {
        return this.parameters?.predictionTypes;
    }
}

@QueryHandler(GetAvailableDatesQuery)
export class GetAvailableDatesHandler implements IQueryHandler<GetAvailableDatesQuery, string[]> {
    constructor(
        @Inject(Logger)
        private readonly logger: Logger,
        private readonly simulationRepository: ISimulationRepository,
    ) {}

    async execute(query: GetAvailableDatesQuery): Promise<string[]> {
        this.logger.debug('Getting available simulation dates');

        return this.simulationRepository.findAvailableDates(query.dataOrigin, query.predictionTypes);
    }
}
