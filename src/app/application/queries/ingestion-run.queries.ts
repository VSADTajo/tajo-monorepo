import { HttpStatus, Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Logger } from 'nestjs-pino';

// Domain
import { IIngestionRunRepository } from '@domain/ports/ingestion-run-repository.port';
import { IngestionRunResult } from '@domain/results/ingestion-run.result';
import { ApiError } from '@domain/errors/api.error';

// ─────────────────────────────────────────────────────────────
// ListIngestionRuns
// ─────────────────────────────────────────────────────────────

export interface IListIngestionRunsQuery {
    providerConfigId?: string;
}

export class ListIngestionRunsQuery {
    constructor(private readonly parameters: IListIngestionRunsQuery = {}) {}

    get providerConfigId(): string | undefined {
        return this.parameters.providerConfigId;
    }
}

@QueryHandler(ListIngestionRunsQuery)
export class ListIngestionRunsHandler implements IQueryHandler<ListIngestionRunsQuery, IngestionRunResult[]> {
    constructor(
        @Inject(Logger)
        private readonly logger: Logger,
        private readonly ingestionRunRepository: IIngestionRunRepository,
    ) {}

    async execute(query: ListIngestionRunsQuery): Promise<IngestionRunResult[]> {
        this.logger.debug('Listing ingestion runs');

        const runs = query.providerConfigId
            ? await this.ingestionRunRepository.findByProviderConfigId(query.providerConfigId)
            : await this.ingestionRunRepository.findAll();

        return runs.map(
            (run) =>
                new IngestionRunResult({
                    id: run.id,
                    providerConfigId: run.providerConfigId,
                    status: run.status,
                    startedAt: run.startedAt,
                    completedAt: run.completedAt,
                    seriesCount: run.seriesCount,
                    eventsCount: run.eventsCount,
                    errorMessage: run.errorMessage,
                    createdAt: run.createdAt!,
                    updatedAt: run.updatedAt!,
                }),
        );
    }
}

// ─────────────────────────────────────────────────────────────
// GetIngestionRunById
// ─────────────────────────────────────────────────────────────

export interface IGetIngestionRunByIdQuery {
    id: string;
}

export class GetIngestionRunByIdQuery {
    constructor(private readonly parameters: IGetIngestionRunByIdQuery) {}

    get id(): string {
        return this.parameters.id;
    }
}

@QueryHandler(GetIngestionRunByIdQuery)
export class GetIngestionRunByIdHandler implements IQueryHandler<GetIngestionRunByIdQuery, IngestionRunResult> {
    constructor(
        @Inject(Logger)
        private readonly logger: Logger,
        private readonly ingestionRunRepository: IIngestionRunRepository,
    ) {}

    async execute(query: GetIngestionRunByIdQuery): Promise<IngestionRunResult> {
        this.logger.debug(`Getting ingestion run by id: ${query.id}`);

        const run = await this.ingestionRunRepository.findById(query.id);

        if (!run) {
            throw new ApiError(HttpStatus.NOT_FOUND, `Ingestion run with id "${query.id}" not found`);
        }

        return new IngestionRunResult({
            id: run.id,
            providerConfigId: run.providerConfigId,
            status: run.status,
            startedAt: run.startedAt,
            completedAt: run.completedAt,
            seriesCount: run.seriesCount,
            eventsCount: run.eventsCount,
            errorMessage: run.errorMessage,
            createdAt: run.createdAt!,
            updatedAt: run.updatedAt!,
        });
    }
}
