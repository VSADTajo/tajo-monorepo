import { HttpStatus, Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Logger } from 'nestjs-pino';

// Domain
import { IScenarioRepository } from '@domain/ports/scenario-repository.port';
import { IScenarioFileRepository } from '@domain/ports/scenario-file-repository.port';
import { GetScenarioResult, ListScenariosResult, ScenarioMetadataResult } from '@domain/results/scenario.results';
import { ScenarioFileMetadataResult } from '@domain/results/scenario-file.results';
import { ApiError } from '@domain/errors/api.error';
import { RepositoryError } from '@domain/errors/repository.error';

// ─────────────────────────────────────────────────────────────
// GetScenarioById (with full payload)
// ─────────────────────────────────────────────────────────────

export interface IGetScenarioByIdQuery {
    id: string;
}

export class GetScenarioByIdQuery {
    constructor(private readonly parameters: IGetScenarioByIdQuery) {}
    get id(): string {
        return this.parameters.id;
    }
}

@QueryHandler(GetScenarioByIdQuery)
export class GetScenarioByIdHandler implements IQueryHandler<GetScenarioByIdQuery, GetScenarioResult> {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly scenarioRepository: IScenarioRepository,
        private readonly scenarioFileRepository: IScenarioFileRepository,
    ) {}

    async execute(query: GetScenarioByIdQuery): Promise<GetScenarioResult> {
        this.logger.debug(`Getting scenario by id: ${query.id}`);

        let scenario;
        try {
            scenario = await this.scenarioRepository.findById(query.id);
        } catch (error) {
            if (error instanceof RepositoryError) {
                throw new ApiError(HttpStatus.NOT_FOUND, `Scenario with id "${query.id}" not found`);
            }
            throw error;
        }

        const files = await this.scenarioFileRepository.findMetadataByScenario(scenario.id);

        return new GetScenarioResult({
            id: scenario.id,
            name: scenario.name,
            description: scenario.description,
            itemsCount: scenario.itemsCount,
            sizeBytes: scenario.sizeBytes,
            payload: scenario.payload ?? null,
            files: files.map(
                (file) =>
                    new ScenarioFileMetadataResult({
                        id: file.id,
                        scenarioId: file.scenarioId,
                        filename: file.filename,
                        contentType: file.contentType,
                        sizeBytes: file.sizeBytes,
                        createdAt: file.createdAt!,
                        updatedAt: file.updatedAt!,
                    }),
            ),
            createdAt: scenario.createdAt!,
            updatedAt: scenario.updatedAt!,
        });
    }
}

// ─────────────────────────────────────────────────────────────
// ListScenarios (metadata only)
// ─────────────────────────────────────────────────────────────

export interface IListScenariosQuery {
    page?: number;
    limit?: number;
}

export class ListScenariosQuery {
    constructor(private readonly parameters: IListScenariosQuery) {}
    get page(): number | undefined {
        return this.parameters.page;
    }
    get limit(): number | undefined {
        return this.parameters.limit;
    }
}

@QueryHandler(ListScenariosQuery)
export class ListScenariosHandler implements IQueryHandler<ListScenariosQuery, ListScenariosResult> {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly scenarioRepository: IScenarioRepository,
    ) {}

    async execute(query: ListScenariosQuery): Promise<ListScenariosResult> {
        this.logger.debug(`Listing scenarios: page=${query.page}, limit=${query.limit}`);

        const { items, total } = await this.scenarioRepository.findAllMetadata({
            page: query.page,
            limit: query.limit,
        });

        return new ListScenariosResult({
            items: items.map(
                (scenario) =>
                    new ScenarioMetadataResult({
                        id: scenario.id,
                        name: scenario.name,
                        description: scenario.description,
                        itemsCount: scenario.itemsCount,
                        sizeBytes: scenario.sizeBytes,
                        createdAt: scenario.createdAt!,
                        updatedAt: scenario.updatedAt!,
                    }),
            ),
            total,
        });
    }
}
