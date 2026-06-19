import {
    ListSimulationsQuery,
    GetSimulationByDateQuery,
    GetLatestSimulationQuery,
    GetHistoricalSimulationsQuery,
    GetAvailableDatesQuery,
} from '@app/application/queries/simulation.queries';
import {
    GetHistoricalPredictionsQuery,
    GetRawPredictionsQuery,
    GetForecastPredictionsQuery,
    GetMaxAndLatestValuesQuery,
} from '@app/application/queries/prediction.queries';
import { ListPredictionTypesQuery } from '@app/application/queries/prediction-type.queries';
import {
    GetManualSimulationByIdQuery,
    ListManualSimulationsQuery,
} from '@app/application/queries/manual-simulation.queries';

export interface CacheEntryConfig {
    ttl: number;
    key: (query: any) => string;
}

// ─────────────────────────────────────────────────────────────
// Cache Keys — single source of truth for key generation + invalidation
// ─────────────────────────────────────────────────────────────

export const SimulationCacheKeys = {
    list: (params: string) => `simulations:list:${params}`,
    latest: () => 'simulations:latest',
    byDate: (date: string) => `simulations:date:${date}`,
    availableDates: (dataOrigin?: string, predictionTypes?: string[]) => {
        let key = 'simulations:available-dates';
        if (dataOrigin) key += `:${dataOrigin}`;
        if (predictionTypes?.length) key += `:${predictionTypes.sort().join(',')}`;
        return key;
    },
    historical: (params: string) => `simulations:historical:${params}`,
    pattern: () => 'simulations:*',
};

export const PredictionTypeCacheKeys = {
    list: () => 'prediction-types:list',
    pattern: () => 'prediction-types:*',
};

export const PredictionCacheKeys = {
    historical: (params: string) => `predictions:historical:${params}`,
    maxAndLatest: (params: string) => `predictions:max-latest:${params}`,
    rawByProvider: (provider: string, date: string) => `predictions:raw:${provider}:${date}`,
    forecast: (params: string) => `predictions:forecast:${params}`,
    availableDates: () => 'predictions:available-dates',
    pattern: () => 'predictions:*',
};

export const ManualSimulationCacheKeys = {
    byId: (id: string) => `manual-simulation:${id}`,
    list: (params: string) => `manual-simulation:list:${params}`,
    pattern: () => 'manual-simulation:*',
};

// ─────────────────────────────────────────────────────────────
// Cache Registry — maps query class names to cache config
// ─────────────────────────────────────────────────────────────

/**
 * Centralized registry of cacheable queries.
 *
 * Map key = query class name (constructor.name)
 * - ttl: cache duration in seconds
 * - key: function that builds the Redis key from the query instance
 *
 * Queries NOT in this registry pass through to the DB without caching.
 */
export const CACHE_REGISTRY = new Map<string, CacheEntryConfig>([
    [
        ListSimulationsQuery.name,
        {
            ttl: 60,
            key: (q: ListSimulationsQuery) =>
                SimulationCacheKeys.list(JSON.stringify({ ...q.filters, p: q.page, l: q.limit })),
        },
    ],
    [
        GetSimulationByDateQuery.name,
        { ttl: 60, key: (q: GetSimulationByDateQuery) => SimulationCacheKeys.byDate(q.simulationDate) },
    ],
    [GetLatestSimulationQuery.name, { ttl: 60, key: () => SimulationCacheKeys.latest() }],
    [
        GetHistoricalSimulationsQuery.name,
        {
            ttl: 60,
            key: (q: GetHistoricalSimulationsQuery) =>
                SimulationCacheKeys.historical(JSON.stringify({ p: q.page, l: q.limit })),
        },
    ],
    [
        GetAvailableDatesQuery.name,
        {
            ttl: 300,
            key: (q: GetAvailableDatesQuery) => SimulationCacheKeys.availableDates(q.dataOrigin, q.predictionTypes),
        },
    ],
    [ListPredictionTypesQuery.name, { ttl: 300, key: () => PredictionTypeCacheKeys.list() }],
    [
        GetHistoricalPredictionsQuery.name,
        {
            ttl: 60,
            key: (q: GetHistoricalPredictionsQuery) => PredictionCacheKeys.historical(JSON.stringify(q.filters)),
        },
    ],
    [
        GetRawPredictionsQuery.name,
        {
            ttl: 60,
            key: (q: GetRawPredictionsQuery) => PredictionCacheKeys.rawByProvider(q.provider, q.simulationDate),
        },
    ],
    [
        GetForecastPredictionsQuery.name,
        {
            ttl: 60,
            key: (q: GetForecastPredictionsQuery) => PredictionCacheKeys.forecast(JSON.stringify(q.filters)),
        },
    ],
    [
        GetMaxAndLatestValuesQuery.name,
        {
            ttl: 60,
            key: (q: GetMaxAndLatestValuesQuery) => PredictionCacheKeys.maxAndLatest(JSON.stringify(q.filters)),
        },
    ],
    [
        GetManualSimulationByIdQuery.name,
        {
            ttl: 60,
            key: (q: GetManualSimulationByIdQuery) => ManualSimulationCacheKeys.byId(q.id),
        },
    ],
    [
        ListManualSimulationsQuery.name,
        {
            ttl: 60,
            key: (q: ListManualSimulationsQuery) =>
                ManualSimulationCacheKeys.list(JSON.stringify({ status: q.status, p: q.page, l: q.limit })),
        },
    ],
]);
