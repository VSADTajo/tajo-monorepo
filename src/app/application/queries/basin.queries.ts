import { HttpStatus, Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Logger } from 'nestjs-pino';

// Domain
import { IBasinRepository } from '@domain/ports/basin-repository.port';
import {
    GetBasinResult,
    GetBasinSubBasinItem,
    ListBasinsResult,
    CreateBasinResult,
} from '@domain/results/basin.results';
import { ApiError } from '@domain/errors/api.error';
import { RepositoryError } from '@domain/errors/repository.error';

// ─────────────────────────────────────────────────────────────
// GetBasinById
// ─────────────────────────────────────────────────────────────

export interface IGetBasinByIdQuery {
    id: string;
}

export class GetBasinByIdQuery {
    constructor(private readonly parameters: IGetBasinByIdQuery) {}
    get id(): string {
        return this.parameters.id;
    }
}

@QueryHandler(GetBasinByIdQuery)
export class GetBasinByIdHandler implements IQueryHandler<GetBasinByIdQuery, GetBasinResult> {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly basinRepository: IBasinRepository,
    ) {}

    async execute(query: GetBasinByIdQuery): Promise<GetBasinResult> {
        this.logger.debug(`Getting basin by id: ${query.id}`);

        let basin;
        try {
            basin = await this.basinRepository.findByIdWithSubBasins(query.id);
        } catch (error) {
            if (error instanceof RepositoryError) {
                throw new ApiError(HttpStatus.NOT_FOUND, `Basin with id "${query.id}" not found`);
            }
            throw error;
        }

        return new GetBasinResult({
            id: basin.id,
            name: basin.name,
            code: basin.code,
            description: basin.description,
            isActive: basin.isActive,
            createdAt: basin.createdAt!,
            updatedAt: basin.updatedAt!,
            subBasins: (basin.subBasins ?? []).map(
                (sb) =>
                    new GetBasinSubBasinItem({
                        id: sb.id,
                        name: sb.name,
                        code: sb.code,
                        isActive: sb.isActive,
                    }),
            ),
        });
    }
}

// ─────────────────────────────────────────────────────────────
// ListBasins
// ─────────────────────────────────────────────────────────────

export interface IListBasinsQuery {
    page?: number;
    limit?: number;
    isActive?: boolean;
}

export class ListBasinsQuery {
    constructor(private readonly parameters: IListBasinsQuery) {}
    get page(): number | undefined {
        return this.parameters.page;
    }
    get limit(): number | undefined {
        return this.parameters.limit;
    }
    get isActive(): boolean | undefined {
        return this.parameters.isActive;
    }
}

@QueryHandler(ListBasinsQuery)
export class ListBasinsHandler implements IQueryHandler<ListBasinsQuery, ListBasinsResult> {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly basinRepository: IBasinRepository,
    ) {}

    async execute(query: ListBasinsQuery): Promise<ListBasinsResult> {
        this.logger.debug(`Listing basins: page=${query.page}, limit=${query.limit}`);

        const { items, total } = await this.basinRepository.findAll({
            page: query.page,
            limit: query.limit,
            isActive: query.isActive,
        });

        return new ListBasinsResult({
            items: items.map(
                (basin) =>
                    new CreateBasinResult({
                        id: basin.id,
                        name: basin.name,
                        code: basin.code,
                        description: basin.description,
                        isActive: basin.isActive,
                        createdAt: basin.createdAt!,
                        updatedAt: basin.updatedAt!,
                    }),
            ),
            total,
        });
    }
}
