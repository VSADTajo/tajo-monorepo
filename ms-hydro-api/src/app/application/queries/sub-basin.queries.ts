import { HttpStatus, Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Logger } from 'nestjs-pino';

// Domain
import { ISubBasinRepository } from '@domain/ports/sub-basin-repository.port';
import {
    GetSubBasinResult,
    GetSubBasinStationItem,
    ListSubBasinsResult,
    CreateSubBasinResult,
} from '@domain/results/sub-basin.results';
import { ApiError } from '@domain/errors/api.error';
import { RepositoryError } from '@domain/errors/repository.error';

// ─────────────────────────────────────────────────────────────
// GetSubBasinById
// ─────────────────────────────────────────────────────────────

export interface IGetSubBasinByIdQuery {
    id: string;
}

export class GetSubBasinByIdQuery {
    constructor(private readonly parameters: IGetSubBasinByIdQuery) {}
    get id(): string {
        return this.parameters.id;
    }
}

@QueryHandler(GetSubBasinByIdQuery)
export class GetSubBasinByIdHandler implements IQueryHandler<GetSubBasinByIdQuery, GetSubBasinResult> {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly subBasinRepository: ISubBasinRepository,
    ) {}

    async execute(query: GetSubBasinByIdQuery): Promise<GetSubBasinResult> {
        this.logger.debug(`Getting sub-basin by id: ${query.id}`);

        let subBasin;
        try {
            subBasin = await this.subBasinRepository.findByIdWithStations(query.id);
        } catch (error) {
            if (error instanceof RepositoryError) {
                throw new ApiError(HttpStatus.NOT_FOUND, `Sub-basin with id "${query.id}" not found`);
            }
            throw error;
        }

        return new GetSubBasinResult({
            id: subBasin.id,
            name: subBasin.name,
            code: subBasin.code,
            basinId: subBasin.basinId,
            basinName: subBasin.basinName,
            description: subBasin.description,
            area: subBasin.area,
            perimetro: subBasin.perimetro,
            centroidX: subBasin.centroidX,
            centroidY: subBasin.centroidY,
            isActive: subBasin.isActive,
            createdAt: subBasin.createdAt!,
            updatedAt: subBasin.updatedAt!,
            stations: (subBasin.stations ?? []).map(
                (s) =>
                    new GetSubBasinStationItem({
                        id: s.id,
                        name: s.name,
                        subBasinName: s.subBasinName,
                        stationCode: s.stationCode,
                        stationType: s.stationType,
                        threshold: s.threshold ?? null,
                        isActive: s.isActive,
                    }),
            ),
        });
    }
}

// ─────────────────────────────────────────────────────────────
// ListSubBasins
// ─────────────────────────────────────────────────────────────

export interface IListSubBasinsQuery {
    page?: number;
    limit?: number;
    basinId?: string;
    isActive?: boolean;
}

export class ListSubBasinsQuery {
    constructor(private readonly parameters: IListSubBasinsQuery) {}
    get page(): number | undefined {
        return this.parameters.page;
    }
    get limit(): number | undefined {
        return this.parameters.limit;
    }
    get basinId(): string | undefined {
        return this.parameters.basinId;
    }
    get isActive(): boolean | undefined {
        return this.parameters.isActive;
    }
}

@QueryHandler(ListSubBasinsQuery)
export class ListSubBasinsHandler implements IQueryHandler<ListSubBasinsQuery, ListSubBasinsResult> {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly subBasinRepository: ISubBasinRepository,
    ) {}

    async execute(query: ListSubBasinsQuery): Promise<ListSubBasinsResult> {
        this.logger.debug(`Listing sub-basins: page=${query.page}, limit=${query.limit}`);

        const { items, total } = await this.subBasinRepository.findAll({
            page: query.page,
            limit: query.limit,
            basinId: query.basinId,
            isActive: query.isActive,
        });

        return new ListSubBasinsResult({
            items: items.map(
                (sb) =>
                    new CreateSubBasinResult({
                        id: sb.id,
                        name: sb.name,
                        code: sb.code,
                        basinId: sb.basinId,
                        basinName: sb.basinName,
                        description: sb.description,
                        area: sb.area,
                        perimetro: sb.perimetro,
                        centroidX: sb.centroidX,
                        centroidY: sb.centroidY,
                        isActive: sb.isActive,
                        createdAt: sb.createdAt!,
                        updatedAt: sb.updatedAt!,
                    }),
            ),
            total,
        });
    }
}
