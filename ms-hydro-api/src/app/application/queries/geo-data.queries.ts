import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Logger } from 'nestjs-pino';

// Domain
import { IGeoDataRepository } from '@domain/ports/geo-data-repository.port';
import { SearchGeoDataResult } from '@domain/results/search-geo-data.result';

// ─────────────────────────────────────────────────────────────
// SearchGeoData
// ─────────────────────────────────────────────────────────────

export interface ISearchGeoDataQuery {
    query: string;
}

export class SearchGeoDataQuery {
    constructor(private readonly parameters: ISearchGeoDataQuery) {}
    get query(): string {
        return this.parameters.query;
    }
}

@QueryHandler(SearchGeoDataQuery)
export class SearchGeoDataHandler implements IQueryHandler<SearchGeoDataQuery, SearchGeoDataResult[]> {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly geoDataRepository: IGeoDataRepository,
    ) {}

    async execute(query: SearchGeoDataQuery): Promise<SearchGeoDataResult[]> {
        this.logger.debug(`Searching geo data with query: ${query.query}`);

        const results = await this.geoDataRepository.search(query.query);

        return results;
    }
}
