import { AerialPrecipitationSeries } from '@domain/entities/aerial-precipitation-series.entity';
import { AerialPrecipitationEvent } from '@domain/entities/aerial-precipitation-event.entity';

// ─── Filter type declarations ────────────────────────────────────────────────

/**
 * Filters for the "latest per polygon" query (GET /aerial-precipitation/latest).
 * Required: layer, provider, accumulation.
 * Optional: stat (only relevant for EPS).
 */
export interface AerialPrecipitationLatestFilters {
    layer: string;
    provider: string;
    accumulation: string;
    stat?: string | null;
}

/**
 * Filters for the "by-location" query (GET /aerial-precipitation/by-location/:id).
 * - When fromForecastDate or toForecastDate is set, returns ALL matching snapshots.
 * - Otherwise, returns only the latest forecastDate per (provider, accumulation, stat) group.
 */
export interface AerialPrecipitationByLocationFilters {
    provider?: string;
    accumulation?: string;
    fromForecastDate?: Date;
    toForecastDate?: Date;
    includeEvents?: boolean;
}

/**
 * Filters for the paginated list query (GET /aerial-precipitation).
 */
export interface AerialPrecipitationListFilters {
    layer?: string;
    provider?: string;
    locationId?: string | string[];
    accumulation?: string;
    stat?: string | null;
    fromForecastDate?: Date;
    toForecastDate?: Date;
    includeEvents?: boolean;
}

// ─── Port (abstract class used as DI token) ──────────────────────────────────

/**
 * Domain port for aerial-precipitation persistence.
 *
 * Bound to `AerialPrecipitationSeriesRepository` in `infrastructure.module.ts`.
 * All implementations must:
 * - Wrap DB operations in try/catch and throw `RepositoryError` on failure.
 * - Keep `upsertWithEvents` in a single transaction.
 */
export abstract class IAerialPrecipitationSeriesRepository {
    /**
     * Idempotent persist: upserts the series by natural key (locationId, parameterId, forecastDate),
     * then deletes all existing events for that series and bulk-inserts the new set.
     * All three steps run inside a single database transaction.
     */
    abstract upsertWithEvents(
        series: AerialPrecipitationSeries,
        events: AerialPrecipitationEvent[],
    ): Promise<AerialPrecipitationSeries>;

    /**
     * Returns the latest-forecastDate series per locationId for the given layer/provider/accumulation.
     * Typically used for the map "current best" view.
     */
    abstract findLatestPerLocation(filters: AerialPrecipitationLatestFilters): Promise<AerialPrecipitationSeries[]>;

    /**
     * Returns series for a specific polygon.
     * - If from/to date filters are provided → returns all matching snapshots.
     * - Otherwise → returns only the latest forecastDate per (provider, accumulation, stat) group.
     * - If includeEvents is true → eagerly loads the events relation.
     */
    abstract findByLocation(
        locationId: string,
        filters: AerialPrecipitationByLocationFilters,
    ): Promise<AerialPrecipitationSeries[]>;

    /**
     * Paginated filtered list of series.
     */
    abstract listFiltered(
        filters: AerialPrecipitationListFilters,
        page: number,
        limit: number,
    ): Promise<AerialPrecipitationSeries[]>;

    /**
     * Count matching series for pagination totals.
     */
    abstract countFiltered(filters: AerialPrecipitationListFilters): Promise<number>;

    /**
     * Deletes series (and their cascade events) whose forecastDate < cutoff.
     * Returns the number of series rows deleted.
     */
    abstract deleteOlderThan(cutoff: Date): Promise<number>;

    /**
     * Attempts to acquire a Postgres advisory lock keyed on 'aerial-precip-poll'.
     * Returns true if the lock was acquired (caller should proceed with the poll cycle).
     * Returns false if the lock is already held (another instance is running — caller should skip).
     */
    abstract acquirePollAdvisoryLock(): Promise<boolean>;

    /**
     * Releases the advisory lock acquired by `acquirePollAdvisoryLock`.
     * Must be called in a finally block after `acquirePollAdvisoryLock` returns true.
     */
    abstract releasePollAdvisoryLock(): Promise<void>;
}
