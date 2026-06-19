import { HttpStatus } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { Maneuver } from '@domain/entities/maneuver.entity';
import { IManeuverRepository, ManeuverFilters, PaginatedManeuvers } from '@domain/ports/maneuver-repository.port';
import { ApiError } from '@domain/errors/api.error';

// ─────────────────────────────────────────────────────────────
// ListManeuvers
// ─────────────────────────────────────────────────────────────

export interface IListManeuversQuery {
    filters: ManeuverFilters;
    page: number;
    limit: number;
}

export class ListManeuversQuery {
    constructor(private readonly parameters: IListManeuversQuery) {}
    get filters(): ManeuverFilters {
        return this.parameters.filters;
    }
    get page(): number {
        return this.parameters.page;
    }
    get limit(): number {
        return this.parameters.limit;
    }
}

@QueryHandler(ListManeuversQuery)
export class ListManeuversHandler implements IQueryHandler<ListManeuversQuery, PaginatedManeuvers> {
    constructor(private readonly maneuverRepository: IManeuverRepository) {}

    async execute(query: ListManeuversQuery): Promise<PaginatedManeuvers> {
        return this.maneuverRepository.findAll(query.filters, query.page, query.limit);
    }
}

// ─────────────────────────────────────────────────────────────
// GetManeuverById
// ─────────────────────────────────────────────────────────────

export interface IGetManeuverByIdQuery {
    id: string;
}

export class GetManeuverByIdQuery {
    constructor(private readonly parameters: IGetManeuverByIdQuery) {}
    get id(): string {
        return this.parameters.id;
    }
}

@QueryHandler(GetManeuverByIdQuery)
export class GetManeuverByIdHandler implements IQueryHandler<GetManeuverByIdQuery, Maneuver> {
    constructor(private readonly maneuverRepository: IManeuverRepository) {}

    async execute(query: GetManeuverByIdQuery): Promise<Maneuver> {
        const maneuver = await this.maneuverRepository.findById(query.id);
        if (!maneuver) {
            throw new ApiError(HttpStatus.NOT_FOUND, `Maneuver with id "${query.id}" not found`);
        }
        return maneuver;
    }
}
