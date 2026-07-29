import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Logger } from 'nestjs-pino';

import {
    IAerialPrecipitationSeriesRepository,
    AerialPrecipitationLatestFilters,
    AerialPrecipitationByLocationFilters,
    AerialPrecipitationListFilters,
} from '@domain/ports/aerial-precipitation-series-repository.port';
import {
    AerialPrecipitationListResult,
    AerialPrecipitationLatestResult,
    AerialPrecipitationByLocationResult,
} from '@domain/results/aerial-precipitation-series.result';
import { EntityError } from '@domain/errors/entity.error';
import { LocationIdValueObject } from '@domain/value-objects/location-id.value-object';

// ─────────────────────────────────────────────────────────────
// GetAerialPrecipitationLatest
// ─────────────────────────────────────────────────────────────

export class GetAerialPrecipitationLatestQuery {
    constructor(
        public readonly filters: AerialPrecipitationLatestFilters,
        public readonly includeEvents: boolean,
    ) {}
}

@QueryHandler(GetAerialPrecipitationLatestQuery)
export class GetAerialPrecipitationLatestHandler implements IQueryHandler<
    GetAerialPrecipitationLatestQuery,
    AerialPrecipitationLatestResult
> {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly repo: IAerialPrecipitationSeriesRepository,
    ) {}

    async execute(query: GetAerialPrecipitationLatestQuery): Promise<AerialPrecipitationLatestResult> {
        // Validation: stat=Max is only valid for provider=ens
        if (query.filters.stat === 'Max' && query.filters.provider !== 'ens') {
            throw new EntityError(
                `stat 'Max' is only valid for provider 'ens', got '${query.filters.provider}'`,
                'stat',
            );
        }
        if (query.filters.stat === 'Med' && query.filters.provider !== 'ens') {
            throw new EntityError(
                `stat 'Med' is only valid for provider 'ens', got '${query.filters.provider}'`,
                'stat',
            );
        }

        // Build filters with events flag for eager loading
        const repoFilters: AerialPrecipitationLatestFilters = {
            ...query.filters,
            // When includeEvents is true, the repository loads events via leftJoin
        };

        let series = await this.repo.findLatestPerLocation(repoFilters);

        // If includeEvents is requested but the repo doesn't load them via findLatestPerLocation,
        // we need to reload with events. The port method doesn't carry includeEvents —
        // use the by-location method per series or accept that events may be empty.
        // For now, pass includeEvents=true through the same query using a cast workaround.
        if (query.includeEvents && series.length > 0) {
            // Re-fetch each series with events loaded using listFiltered with includeEvents
            const withEvents = await this.repo.listFiltered(
                {
                    layer: query.filters.layer,
                    provider: query.filters.provider,
                    accumulation: query.filters.accumulation,
                    stat: query.filters.stat !== undefined ? query.filters.stat : undefined,
                    locationId: series.map((s) => s.locationId),
                    includeEvents: true,
                },
                1,
                series.length,
            );
            // Filter to only the forecastDates that were selected by findLatestPerLocation
            const latestDateByLocation = new Map<string, string>(
                series.map((s) => [s.locationId, s.forecastDate.toISOString()]),
            );
            series = withEvents.filter((s) => latestDateByLocation.get(s.locationId) === s.forecastDate.toISOString());
        }

        this.logger.debug({
            msg: 'GetAerialPrecipitationLatestQuery',
            filters: query.filters,
            count: series.length,
        });

        return new AerialPrecipitationLatestResult({ series });
    }
}

// ─────────────────────────────────────────────────────────────
// GetAerialPrecipitationByLocation
// ─────────────────────────────────────────────────────────────

export class GetAerialPrecipitationByLocationQuery {
    constructor(
        public readonly locationId: string,
        public readonly filters: AerialPrecipitationByLocationFilters,
    ) {}
}

@QueryHandler(GetAerialPrecipitationByLocationQuery)
export class GetAerialPrecipitationByLocationHandler implements IQueryHandler<
    GetAerialPrecipitationByLocationQuery,
    AerialPrecipitationByLocationResult
> {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly repo: IAerialPrecipitationSeriesRepository,
    ) {}

    async execute(query: GetAerialPrecipitationByLocationQuery): Promise<AerialPrecipitationByLocationResult> {
        // Validate locationId format
        try {
            new LocationIdValueObject(query.locationId);
        } catch (_err) {
            throw new EntityError(
                `Invalid locationId format: '${query.locationId}'. Expected prefix: Sistema., Cuenca.NAM., or Cuenca.AEMET.`,
                'locationId',
            );
        }

        const series = await this.repo.findByLocation(query.locationId, query.filters);

        // No data is a valid, non-error outcome: return the same shape with an
        // empty series (→ groups: []) instead of a 404, so clients don't have to
        // special-case "no data" vs "has data".
        this.logger.debug({
            msg: 'GetAerialPrecipitationByLocationQuery',
            locationId: query.locationId,
            count: series.length,
        });

        return new AerialPrecipitationByLocationResult({ locationId: query.locationId, series });
    }
}

// ─────────────────────────────────────────────────────────────
// ListAerialPrecipitation
// ─────────────────────────────────────────────────────────────

export class ListAerialPrecipitationQuery {
    constructor(
        public readonly filters: AerialPrecipitationListFilters,
        public readonly page: number,
        public readonly limit: number,
    ) {}
}

@QueryHandler(ListAerialPrecipitationQuery)
export class ListAerialPrecipitationHandler implements IQueryHandler<
    ListAerialPrecipitationQuery,
    AerialPrecipitationListResult
> {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly repo: IAerialPrecipitationSeriesRepository,
    ) {}

    async execute(query: ListAerialPrecipitationQuery): Promise<AerialPrecipitationListResult> {
        const [data, total] = await Promise.all([
            this.repo.listFiltered(query.filters, query.page, query.limit),
            this.repo.countFiltered(query.filters),
        ]);

        this.logger.debug({
            msg: 'ListAerialPrecipitationQuery',
            filters: query.filters,
            total,
            page: query.page,
            limit: query.limit,
        });

        return new AerialPrecipitationListResult({
            data,
            total,
            page: query.page,
            limit: query.limit,
        });
    }
}
