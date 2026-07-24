import { AerialPrecipitationSeries } from '@domain/entities/aerial-precipitation-series.entity';
import { AerialPrecipitationEvent } from '@domain/entities/aerial-precipitation-event.entity';
import {
    AerialPrecipitationListResult,
    AerialPrecipitationLatestResult,
    AerialPrecipitationByLocationResult,
} from '@domain/results/aerial-precipitation-series.result';
import {
    AerialPrecipitationSeriesDto,
    AerialPrecipitationEventPointDto,
    AerialPrecipitationByLocationGroupDto,
    GetAerialPrecipitationLatestResponseDto,
    GetAerialPrecipitationByLocationResponseDto,
    ListAerialPrecipitationResponseDto,
} from '@api/dtos/aerial-precipitation.dtos';
import {
    GetAerialPrecipitationLatestQuery,
    GetAerialPrecipitationByLocationQuery,
    ListAerialPrecipitationQuery,
} from '@application/queries/aerial-precipitation.queries';
import {
    GetAerialPrecipitationLatestQueryDto,
    GetAerialPrecipitationByLocationQueryDto,
    ListAerialPrecipitationQueryDto,
} from '@api/dtos/aerial-precipitation.dtos';
import {
    AerialPrecipitationByLocationFilters,
    AerialPrecipitationLatestFilters,
    AerialPrecipitationListFilters,
} from '@domain/ports/aerial-precipitation-series-repository.port';

// ─────────────────────────────────────────────────────────────
// Shared serializer (T070)
// ─────────────────────────────────────────────────────────────

/**
 * Serializes an `AerialPrecipitationSeries` entity into the response DTO.
 *
 * - `max`: event with the highest value; ties resolved by earliest eventDate.
 * - `last`: chronologically latest event.
 * - `events`: only included when `includeEvents === true`.
 *
 * When the series has no loaded events both `max` and `last` are `null`.
 */
export function serializeSeries(
    series: AerialPrecipitationSeries,
    options: { includeEvents: boolean },
): AerialPrecipitationSeriesDto {
    const events: AerialPrecipitationEvent[] = series.events ?? [];

    let maxPoint: AerialPrecipitationEventPointDto | null = null;
    let lastPoint: AerialPrecipitationEventPointDto | null = null;

    if (events.length > 0) {
        // max: highest value, ties → earliest eventDate
        const maxEvent = events.reduce((best, e) => {
            if (e.value > best.value) return e;
            if (e.value === best.value && e.eventDate < best.eventDate) return e;
            return best;
        });
        maxPoint = toEventPointDto(maxEvent);

        // last: chronologically latest
        const lastEvent = events.reduce((best, e) => (e.eventDate > best.eventDate ? e : best));
        lastPoint = toEventPointDto(lastEvent);
    }

    const dto: AerialPrecipitationSeriesDto = {
        id: series.id,
        locationId: series.locationId,
        parameterId: series.parameterId,
        provider: series.provider,
        layer: series.layer,
        stat: series.stat,
        accumulation: series.accumulation,
        forecastDate:
            series.forecastDate instanceof Date ? series.forecastDate.toISOString() : String(series.forecastDate),
        startDate: series.startDate instanceof Date ? series.startDate.toISOString() : (series.startDate ?? null),
        endDate: series.endDate instanceof Date ? series.endDate.toISOString() : (series.endDate ?? null),
        moduleInstanceId: series.moduleInstanceId ?? null,
        stationName: series.stationName ?? null,
        lat: series.lat ?? null,
        lon: series.lon ?? null,
        units: series.units,
        timeStepSeconds: series.timeStepSeconds,
        creationDate:
            series.creationDate instanceof Date ? series.creationDate.toISOString() : (series.creationDate ?? null),
        approvedDate:
            series.approvedDate instanceof Date ? series.approvedDate.toISOString() : (series.approvedDate ?? null),
        sourceFileName: series.sourceFileName,
        max: maxPoint,
        last: lastPoint,
    };

    if (options.includeEvents) {
        dto.events = events
            .slice()
            .sort((a, b) => a.eventDate.getTime() - b.eventDate.getTime())
            .map(toEventPointDto);
    }

    return dto;
}

function toEventPointDto(event: AerialPrecipitationEvent): AerialPrecipitationEventPointDto {
    return {
        eventDate: event.eventDate instanceof Date ? event.eventDate.toISOString() : String(event.eventDate),
        value: event.value,
        flag: event.flag,
    };
}

// ─────────────────────────────────────────────────────────────
// GetAerialPrecipitationLatest mapper
// ─────────────────────────────────────────────────────────────

export class GetAerialPrecipitationLatestMapper {
    static toQuery(dto: GetAerialPrecipitationLatestQueryDto): GetAerialPrecipitationLatestQuery {
        const filters: AerialPrecipitationLatestFilters = {
            layer: dto.layer,
            provider: dto.provider,
            accumulation: dto.accumulation,
            stat: dto.stat === 'none' ? null : (dto.stat ?? null),
        };
        return new GetAerialPrecipitationLatestQuery(filters, dto.includeEvents ?? false);
    }

    static toResponseDto(
        result: AerialPrecipitationLatestResult,
        query: GetAerialPrecipitationLatestQuery,
    ): GetAerialPrecipitationLatestResponseDto {
        return {
            generatedAt: new Date().toISOString(),
            layer: query.filters.layer,
            provider: query.filters.provider,
            accumulation: query.filters.accumulation,
            stat: query.filters.stat ?? null,
            series: result.series.map((s) => serializeSeries(s, { includeEvents: query.includeEvents })),
        };
    }
}

// ─────────────────────────────────────────────────────────────
// GetAerialPrecipitationByLocation mapper
// ─────────────────────────────────────────────────────────────

export class GetAerialPrecipitationByLocationMapper {
    static toQuery(
        locationId: string,
        dto: GetAerialPrecipitationByLocationQueryDto,
    ): GetAerialPrecipitationByLocationQuery {
        const filters: AerialPrecipitationByLocationFilters = {
            provider: dto.provider,
            accumulation: dto.accumulation,
            fromForecastDate: dto.fromForecastDate ? new Date(dto.fromForecastDate) : undefined,
            toForecastDate: dto.toForecastDate ? new Date(dto.toForecastDate) : undefined,
            includeEvents: dto.includeEvents ?? false,
        };
        return new GetAerialPrecipitationByLocationQuery(locationId, filters);
    }

    static toResponseDto(
        result: AerialPrecipitationByLocationResult,
        query: GetAerialPrecipitationByLocationQuery,
    ): GetAerialPrecipitationByLocationResponseDto {
        const includeEvents = query.filters.includeEvents ?? false;

        // Group series by (provider, accumulation, stat)
        const groupMap = new Map<string, AerialPrecipitationByLocationGroupDto>();

        for (const series of result.series) {
            const key = `${series.provider}||${series.accumulation}||${series.stat ?? ''}`;
            if (!groupMap.has(key)) {
                groupMap.set(key, {
                    provider: series.provider,
                    accumulation: series.accumulation,
                    stat: series.stat,
                    series: [],
                });
            }
            groupMap.get(key)!.series.push(serializeSeries(series, { includeEvents }));
        }

        return {
            locationId: result.locationId,
            groups: Array.from(groupMap.values()),
        };
    }
}

// ─────────────────────────────────────────────────────────────
// ListAerialPrecipitation mapper
// ─────────────────────────────────────────────────────────────

export class ListAerialPrecipitationMapper {
    static toQuery(dto: ListAerialPrecipitationQueryDto): ListAerialPrecipitationQuery {
        const filters: AerialPrecipitationListFilters = {
            layer: dto.layer,
            provider: dto.provider,
            locationId: dto.locationId,
            accumulation: dto.accumulation,
            stat: dto.stat === 'none' ? null : dto.stat,
            fromForecastDate: dto.fromForecastDate ? new Date(dto.fromForecastDate) : undefined,
            toForecastDate: dto.toForecastDate ? new Date(dto.toForecastDate) : undefined,
            includeEvents: dto.includeEvents ?? false,
        };
        const page = dto.page ?? 1;
        const limit = dto.limit ?? 50;
        return new ListAerialPrecipitationQuery(filters, page, limit);
    }

    static toResponseDto(
        result: AerialPrecipitationListResult,
        query: ListAerialPrecipitationQuery,
    ): ListAerialPrecipitationResponseDto {
        const includeEvents = query.filters.includeEvents ?? false;
        return {
            data: result.data.map((s) => serializeSeries(s, { includeEvents })),
            total: result.total,
            page: result.page,
            limit: result.limit,
        };
    }
}
