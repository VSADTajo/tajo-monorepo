import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, SelectQueryBuilder } from 'typeorm';
import { Logger } from 'nestjs-pino';

import {
    IAerialPrecipitationSeriesRepository,
    AerialPrecipitationLatestFilters,
    AerialPrecipitationByLocationFilters,
    AerialPrecipitationListFilters,
} from '@domain/ports/aerial-precipitation-series-repository.port';
import { AerialPrecipitationSeries } from '@domain/entities/aerial-precipitation-series.entity';
import { AerialPrecipitationEvent } from '@domain/entities/aerial-precipitation-event.entity';
import { RepositoryError } from '@domain/errors/repository.error';

// ─── Raw event shape returned by the JSON subqueries ─────────────────────────

interface RawEventJson {
    seriesId: string;
    eventDate: string;
    value: number;
    flag: number;
}

/** Shape of the raw row returned by getRawAndEntities when aggregate subqueries are active. */
interface RawSeriesRow {
    s_id: string;
    max_event: RawEventJson | null;
    last_event: RawEventJson | null;
    [key: string]: unknown;
}

/**
 * Attaches scalar SQL subqueries that compute the max and last events for each
 * series row WITHOUT loading the full events relation.
 *
 * - `max_event`: the event with the highest value (ties broken by earliest eventDate).
 * - `last_event`: the chronologically latest event.
 *
 * Both subqueries exclude missVal rows (value <> s."missVal").
 *
 * After calling this helper use `getRawAndEntities()` and pass the result to
 * `mergeAggregatesOntoEntities()`.
 */
function addAggregateSubqueries(qb: SelectQueryBuilder<AerialPrecipitationSeries>): void {
    qb.addSelect(
        `(SELECT row_to_json(e.*) FROM aerial_precipitation_events e
          WHERE e."seriesId" = s.id AND e.value <> s."missVal"
          ORDER BY e.value DESC, e."eventDate" ASC LIMIT 1)`,
        'max_event',
    ).addSelect(
        `(SELECT row_to_json(e.*) FROM aerial_precipitation_events e
          WHERE e."seriesId" = s.id AND e.value <> s."missVal"
          ORDER BY e."eventDate" DESC LIMIT 1)`,
        'last_event',
    );
}

/**
 * Merges the raw `max_event` / `last_event` JSON columns (produced by
 * `addAggregateSubqueries`) onto each entity instance as transient fields.
 *
 * When a `leftJoinAndSelect` is active, TypeORM emits one raw row per
 * joined child — i.e., multiple raw rows per entity. We therefore build a
 * Map keyed by series id (`s_id` column) and assign aggregates by id, not by
 * positional index.
 */
function mergeAggregatesOntoEntities(
    entities: AerialPrecipitationSeries[],
    raw: RawSeriesRow[],
): AerialPrecipitationSeries[] {
    // Build a lookup: seriesId → first raw row that carries the aggregates.
    // All raw rows for the same series carry identical aggregate values, so the
    // first one is sufficient.
    const aggregateBySeriesId = new Map<string, RawSeriesRow>();
    for (const r of raw) {
        const id = r.s_id;
        if (id && !aggregateBySeriesId.has(id)) {
            aggregateBySeriesId.set(id, r);
        }
    }

    for (const entity of entities) {
        const r = aggregateBySeriesId.get(entity.id);
        if (!r) continue;

        const rawMax = r.max_event;
        const rawLast = r.last_event;

        entity.maxEvent = rawMax
            ? new AerialPrecipitationEvent({
                  seriesId: rawMax.seriesId,
                  eventDate: new Date(rawMax.eventDate),
                  value: Number(rawMax.value),
                  flag: Number(rawMax.flag),
              })
            : null;

        entity.lastEvent = rawLast
            ? new AerialPrecipitationEvent({
                  seriesId: rawLast.seriesId,
                  eventDate: new Date(rawLast.eventDate),
                  value: Number(rawLast.value),
                  flag: Number(rawLast.flag),
              })
            : null;
    }
    return entities;
}

/** Postgres advisory lock seed string — must match the value in the port comment. */
const ADVISORY_LOCK_KEY = 'aerial-precip-poll';

@Injectable()
export class AerialPrecipitationSeriesRepository extends IAerialPrecipitationSeriesRepository {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        @InjectRepository(AerialPrecipitationSeries)
        private readonly seriesRepo: Repository<AerialPrecipitationSeries>,
        private readonly dataSource: DataSource,
    ) {
        super();
    }

    // ─────────────────────────────────────────────────────────────
    // upsertWithEvents
    // ─────────────────────────────────────────────────────────────

    async upsertWithEvents(
        series: AerialPrecipitationSeries,
        events: AerialPrecipitationEvent[],
    ): Promise<AerialPrecipitationSeries> {
        try {
            return await this.dataSource.transaction(async (manager) => {
                // 1. Upsert the series row by natural key
                const upsertResult = await manager
                    .createQueryBuilder()
                    .insert()
                    .into(AerialPrecipitationSeries)
                    .values(series)
                    .orUpdate(
                        [
                            'provider',
                            'layer',
                            'stat',
                            'accumulation',
                            'moduleInstanceId',
                            'stationName',
                            'lat',
                            'lon',
                            'startDate',
                            'endDate',
                            'units',
                            'missVal',
                            'timeStepSeconds',
                            'creationDate',
                            'approvedDate',
                            'sourceFileName',
                            'updatedAt',
                        ],
                        ['locationId', 'parameterId', 'forecastDate'],
                    )
                    .returning('*')
                    .execute();

                const rawRow = upsertResult.raw[0] as Record<string, unknown>;
                const persistedId = rawRow.id as string;

                // 2. Delete existing events for this series (idempotent replace)
                await manager
                    .createQueryBuilder()
                    .delete()
                    .from(AerialPrecipitationEvent)
                    .where('"seriesId" = :seriesId', { seriesId: persistedId })
                    .execute();

                // 3. Bulk-insert the new events (one round-trip)
                if (events.length > 0) {
                    const eventRows = events.map((e) => ({
                        seriesId: persistedId,
                        eventDate: e.eventDate,
                        value: e.value,
                        flag: e.flag,
                    }));

                    await manager
                        .createQueryBuilder()
                        .insert()
                        .into(AerialPrecipitationEvent)
                        .values(eventRows)
                        .execute();
                }

                // 4. Return the persisted series (hydrate from raw row)
                return new AerialPrecipitationSeries({
                    id: persistedId,
                    locationId: rawRow.locationId as string,
                    parameterId: rawRow.parameterId as string,
                    forecastDate: rawRow.forecastDate as Date,
                    provider: rawRow.provider as string,
                    layer: rawRow.layer as string,
                    stat: rawRow.stat as string | null,
                    accumulation: rawRow.accumulation as string,
                    moduleInstanceId: rawRow.moduleInstanceId as string | null,
                    stationName: rawRow.stationName as string | null,
                    lat: rawRow.lat as number | null,
                    lon: rawRow.lon as number | null,
                    startDate: rawRow.startDate as Date | null,
                    endDate: rawRow.endDate as Date | null,
                    units: rawRow.units as string,
                    missVal: rawRow.missVal as number,
                    timeStepSeconds: rawRow.timeStepSeconds as number,
                    creationDate: rawRow.creationDate as Date | null,
                    approvedDate: rawRow.approvedDate as Date | null,
                    sourceFileName: rawRow.sourceFileName as string,
                });
            });
        } catch (error) {
            this.logger.error({
                msg: 'Failed to upsertWithEvents for aerial_precipitation_series',
                error: (error as Error).message,
            });
            throw new RepositoryError('Failed to upsert aerial precipitation series with events', error as Error);
        }
    }

    // ─────────────────────────────────────────────────────────────
    // findLatestPerLocation
    // ─────────────────────────────────────────────────────────────

    async findLatestPerLocation(filters: AerialPrecipitationLatestFilters): Promise<AerialPrecipitationSeries[]> {
        try {
            // Subquery: for each locationId, pick the row with max forecastDate
            // that matches the filter — single SQL statement.
            const qb = this.seriesRepo
                .createQueryBuilder('s')
                .where('s.layer = :layer', { layer: filters.layer })
                .andWhere('s.provider = :provider', { provider: filters.provider })
                .andWhere('s.accumulation = :accumulation', { accumulation: filters.accumulation })
                .andWhere(
                    `s."forecastDate" = (
                        SELECT MAX(s2."forecastDate")
                        FROM "aerial_precipitation_series" s2
                        WHERE s2."locationId" = s."locationId"
                          AND s2."layer" = s."layer"
                          AND s2."provider" = s."provider"
                          AND s2."accumulation" = s."accumulation"
                          ${filters.stat !== undefined && filters.stat !== null ? 'AND s2."stat" = :stat' : 'AND s2."stat" IS NULL'}
                    )`,
                )
                .orderBy('s.locationId', 'ASC');

            if (filters.stat !== undefined && filters.stat !== null) {
                qb.setParameter('stat', filters.stat);
                qb.andWhere('s.stat = :stat', { stat: filters.stat });
            } else {
                qb.andWhere('s.stat IS NULL');
            }

            addAggregateSubqueries(qb);
            const { entities, raw } = await qb.getRawAndEntities();
            return mergeAggregatesOntoEntities(entities, raw);
        } catch (error) {
            this.logger.error({
                msg: 'Failed to findLatestPerLocation',
                filters,
                error: (error as Error).message,
            });
            throw new RepositoryError('Failed to find latest aerial precipitation series per location', error as Error);
        }
    }

    // ─────────────────────────────────────────────────────────────
    // findByLocation
    // ─────────────────────────────────────────────────────────────

    async findByLocation(
        locationId: string,
        filters: AerialPrecipitationByLocationFilters,
    ): Promise<AerialPrecipitationSeries[]> {
        try {
            const hasDateRange = filters.fromForecastDate !== undefined || filters.toForecastDate !== undefined;

            const qb = this.seriesRepo.createQueryBuilder('s').where('s."locationId" = :locationId', { locationId });

            if (filters.provider) {
                qb.andWhere('s.provider = :provider', { provider: filters.provider });
            }
            if (filters.accumulation) {
                qb.andWhere('s.accumulation = :accumulation', { accumulation: filters.accumulation });
            }
            if (filters.fromForecastDate) {
                qb.andWhere('s."forecastDate" >= :from', { from: filters.fromForecastDate });
            }
            if (filters.toForecastDate) {
                qb.andWhere('s."forecastDate" <= :to', { to: filters.toForecastDate });
            }

            if (filters.includeEvents) {
                qb.leftJoinAndSelect('s.events', 'events').addOrderBy('events.eventDate', 'ASC');
            }

            if (!hasDateRange) {
                // Only the latest forecastDate per (provider, accumulation, stat) group
                qb.andWhere(
                    `s."forecastDate" = (
                        SELECT MAX(s2."forecastDate")
                        FROM "aerial_precipitation_series" s2
                        WHERE s2."locationId" = s."locationId"
                          AND s2."provider" = s."provider"
                          AND s2."accumulation" = s."accumulation"
                          AND (
                            (s2."stat" IS NULL AND s."stat" IS NULL)
                            OR s2."stat" = s."stat"
                          )
                    )`,
                );
            }

            qb.orderBy('s."forecastDate"', 'DESC');

            // Always attach scalar aggregates so the mapper can compute max/last
            // without loading the full events relation.
            addAggregateSubqueries(qb);
            const { entities, raw } = await qb.getRawAndEntities();
            return mergeAggregatesOntoEntities(entities, raw);
        } catch (error) {
            this.logger.error({
                msg: 'Failed to findByLocation',
                locationId,
                filters,
                error: (error as Error).message,
            });
            throw new RepositoryError('Failed to find aerial precipitation series by location', error as Error);
        }
    }

    // ─────────────────────────────────────────────────────────────
    // listFiltered
    // ─────────────────────────────────────────────────────────────

    async listFiltered(
        filters: AerialPrecipitationListFilters,
        page: number,
        limit: number,
    ): Promise<AerialPrecipitationSeries[]> {
        try {
            // When includeEvents is requested, TypeORM's pagination subquery cannot
            // handle leftJoinAndSelect + orderBy on the joined table inside take/skip.
            // Strategy: paginate on series IDs first, then eager-load events in a
            // second query. This avoids TypeORM's broken pagination+join subquery.
            if (filters.includeEvents) {
                const idQb = this.buildFilteredQuery(filters);
                idQb.select('s.id')
                    .orderBy('s."forecastDate"', 'DESC')
                    .skip((page - 1) * limit)
                    .take(limit);
                const idRows = await idQb.getRawMany<{ s_id: string }>();
                const ids = idRows.map((r) => r.s_id);
                if (ids.length === 0) return [];

                const eventsQb = this.seriesRepo
                    .createQueryBuilder('s')
                    .whereInIds(ids)
                    .leftJoinAndSelect('s.events', 'events')
                    .orderBy('s."forecastDate"', 'DESC')
                    .addOrderBy('events.eventDate', 'ASC');

                addAggregateSubqueries(eventsQb);
                const { entities: evEntities, raw: evRaw } = await eventsQb.getRawAndEntities();
                return mergeAggregatesOntoEntities(evEntities, evRaw);
            }

            const qb = this.buildFilteredQuery(filters);
            qb.orderBy('s."forecastDate"', 'DESC')
                .skip((page - 1) * limit)
                .take(limit);

            addAggregateSubqueries(qb);
            const { entities, raw } = await qb.getRawAndEntities();
            return mergeAggregatesOntoEntities(entities, raw);
        } catch (error) {
            this.logger.error({
                msg: 'Failed to listFiltered aerial precipitation series',
                filters,
                error: (error as Error).message,
            });
            throw new RepositoryError('Failed to list filtered aerial precipitation series', error as Error);
        }
    }

    // ─────────────────────────────────────────────────────────────
    // countFiltered
    // ─────────────────────────────────────────────────────────────

    async countFiltered(filters: AerialPrecipitationListFilters): Promise<number> {
        try {
            return this.buildFilteredQuery(filters).getCount();
        } catch (error) {
            this.logger.error({
                msg: 'Failed to countFiltered aerial precipitation series',
                filters,
                error: (error as Error).message,
            });
            throw new RepositoryError('Failed to count filtered aerial precipitation series', error as Error);
        }
    }

    // ─────────────────────────────────────────────────────────────
    // deleteOlderThan
    // ─────────────────────────────────────────────────────────────

    async deleteOlderThan(cutoff: Date): Promise<number> {
        try {
            const result = await this.seriesRepo
                .createQueryBuilder()
                .delete()
                .from(AerialPrecipitationSeries)
                .where('"forecastDate" < :cutoff', { cutoff })
                .execute();

            return result.affected ?? 0;
        } catch (error) {
            this.logger.error({
                msg: 'Failed to deleteOlderThan aerial precipitation series',
                cutoff,
                error: (error as Error).message,
            });
            throw new RepositoryError('Failed to delete old aerial precipitation series', error as Error);
        }
    }

    // ─────────────────────────────────────────────────────────────
    // Advisory lock
    // ─────────────────────────────────────────────────────────────

    async acquirePollAdvisoryLock(): Promise<boolean> {
        try {
            const result = (await this.dataSource.query('SELECT pg_try_advisory_lock(hashtext($1)) AS acquired', [
                ADVISORY_LOCK_KEY,
            ])) as Array<{ acquired: boolean }>;
            return result[0]?.acquired === true;
        } catch (error) {
            this.logger.error({
                msg: 'Failed to acquire aerial precipitation poll advisory lock',
                error: (error as Error).message,
            });
            throw new RepositoryError('Failed to acquire advisory lock for aerial precipitation poll', error as Error);
        }
    }

    async releasePollAdvisoryLock(): Promise<void> {
        try {
            await this.dataSource.query('SELECT pg_advisory_unlock(hashtext($1))', [ADVISORY_LOCK_KEY]);
        } catch (error) {
            this.logger.error({
                msg: 'Failed to release aerial precipitation poll advisory lock',
                error: (error as Error).message,
            });
            // Do not re-throw: advisory locks auto-release on session end anyway.
        }
    }

    // ─────────────────────────────────────────────────────────────
    // Private helpers
    // ─────────────────────────────────────────────────────────────

    private buildFilteredQuery(filters: AerialPrecipitationListFilters) {
        const qb = this.seriesRepo.createQueryBuilder('s');

        if (filters.layer) {
            qb.andWhere('s.layer = :layer', { layer: filters.layer });
        }
        if (filters.provider) {
            qb.andWhere('s.provider = :provider', { provider: filters.provider });
        }
        if (filters.accumulation) {
            qb.andWhere('s.accumulation = :accumulation', { accumulation: filters.accumulation });
        }
        if (filters.stat !== undefined) {
            if (filters.stat === null) {
                qb.andWhere('s.stat IS NULL');
            } else {
                qb.andWhere('s.stat = :stat', { stat: filters.stat });
            }
        }
        if (filters.locationId !== undefined) {
            if (Array.isArray(filters.locationId)) {
                if (filters.locationId.length > 0) {
                    qb.andWhere('s."locationId" IN (:...locationIds)', { locationIds: filters.locationId });
                }
            } else {
                qb.andWhere('s."locationId" = :locationId', { locationId: filters.locationId });
            }
        }
        if (filters.fromForecastDate) {
            qb.andWhere('s."forecastDate" >= :from', { from: filters.fromForecastDate });
        }
        if (filters.toForecastDate) {
            qb.andWhere('s."forecastDate" <= :to', { to: filters.toForecastDate });
        }

        return qb;
    }
}
