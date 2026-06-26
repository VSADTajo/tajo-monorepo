import { HttpStatus, Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Logger } from 'nestjs-pino';

// Domain
import { ISimulationRepository, PaginatedResult, SimulationFilters } from '@domain/ports/simulation-repository.port';
import { ISimulationSftpService } from '@domain/ports/simulation-sftp.port';
import { Simulation } from '@domain/entities/simulation.entity';
import {
    SimulationFilesResult,
    SimulationFileDownloadResult,
    SimulationFolder,
} from '@domain/results/simulation-files.result';
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

// ─────────────────────────────────────────────────────────────
// GetSimulationFiles (SFTP input/output listing)
// ─────────────────────────────────────────────────────────────

export interface IGetSimulationFilesQuery {
    id: string;
}

export class GetSimulationFilesQuery {
    constructor(private readonly parameters: IGetSimulationFilesQuery) {}

    get id(): string {
        return this.parameters.id;
    }
}

@QueryHandler(GetSimulationFilesQuery)
export class GetSimulationFilesHandler implements IQueryHandler<GetSimulationFilesQuery, SimulationFilesResult> {
    constructor(
        @Inject(Logger)
        private readonly logger: Logger,
        private readonly simulationRepository: ISimulationRepository,
        private readonly simulationSftpService: ISimulationSftpService,
    ) {}

    async execute(query: GetSimulationFilesQuery): Promise<SimulationFilesResult> {
        this.logger.debug(`Listing SFTP files for simulation: ${query.id}`);

        await this.assertSimulationExists(query.id);

        const { input, output } = await this.simulationSftpService.listFiles(query.id);
        return new SimulationFilesResult({ input, output });
    }

    private async assertSimulationExists(id: string): Promise<void> {
        let simulation: Simulation | null = null;
        try {
            simulation = await this.simulationRepository.findById(id);
        } catch {
            throw new ApiError(HttpStatus.NOT_FOUND, `Simulation with id "${id}" not found`);
        }
        if (!simulation) {
            throw new ApiError(HttpStatus.NOT_FOUND, `Simulation with id "${id}" not found`);
        }
    }
}

// ─────────────────────────────────────────────────────────────
// DownloadSimulationFile (single SFTP file)
// ─────────────────────────────────────────────────────────────

export interface IDownloadSimulationFileQuery {
    id: string;
    folder: SimulationFolder;
    fileName: string;
}

export class DownloadSimulationFileQuery {
    constructor(private readonly parameters: IDownloadSimulationFileQuery) {}

    get id(): string {
        return this.parameters.id;
    }

    get folder(): SimulationFolder {
        return this.parameters.folder;
    }

    get fileName(): string {
        return this.parameters.fileName;
    }
}

@QueryHandler(DownloadSimulationFileQuery)
export class DownloadSimulationFileHandler implements IQueryHandler<
    DownloadSimulationFileQuery,
    SimulationFileDownloadResult
> {
    constructor(
        @Inject(Logger)
        private readonly logger: Logger,
        private readonly simulationRepository: ISimulationRepository,
        private readonly simulationSftpService: ISimulationSftpService,
    ) {}

    async execute(query: DownloadSimulationFileQuery): Promise<SimulationFileDownloadResult> {
        this.logger.debug(`Downloading SFTP file "${query.fileName}" (${query.folder}) for simulation: ${query.id}`);

        let simulation: Simulation | null = null;
        try {
            simulation = await this.simulationRepository.findById(query.id);
        } catch {
            throw new ApiError(HttpStatus.NOT_FOUND, `Simulation with id "${query.id}" not found`);
        }
        if (!simulation) {
            throw new ApiError(HttpStatus.NOT_FOUND, `Simulation with id "${query.id}" not found`);
        }

        return this.simulationSftpService.downloadFile(query.id, query.folder, query.fileName);
    }
}
