export interface CacheEntryConfig {
    ttl: number;
    key: (query: any) => string;
}

// ─────────────────────────────────────────────────────────────
// Cache Keys — single source of truth for key generation + invalidation
// ─────────────────────────────────────────────────────────────

export const MeteoInfoCacheKeys = {
    forFilter: (provider?: string, variable?: string) =>
        `meteo:info:${(provider ?? '*').toLowerCase()}:${variable ?? '*'}`,
    pattern: () => 'meteo:info:*',
};

export const MeteoProvidersCacheKeys = {
    all: () => 'meteo:providers',
};

export const AvisosCacheKeys = {
    all: () => 'meteo:avisos:esp',
    pattern: () => 'meteo:avisos:*',
    TTL: 300, // 5 minutes
};

export const MeteoAccumuladoCacheKeys = {
    forRange: (provider: string, variable: string | undefined, from: string, to: string) =>
        `meteo:acumulado:${provider.toLowerCase()}:${(variable ?? 'default').toLowerCase()}:${from}:${to}`,
    forDataset: (provider: string, variable: string | undefined) =>
        `meteo:acumulado:${provider.toLowerCase()}:${(variable ?? 'default').toLowerCase()}:*`,
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
        'MeteoInfoQuery',
        {
            ttl: 60,
            key: (q: any) => MeteoInfoCacheKeys.forFilter(q?.provider, q?.variable),
        },
    ],
    [
        'MeteoProvidersQuery',
        {
            ttl: 60,
            key: () => MeteoProvidersCacheKeys.all(),
        },
    ],
]);
