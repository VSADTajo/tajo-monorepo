import { GetProviderConfigByIdQuery, ListProviderConfigsQuery } from '@app/application/queries/provider-config.queries';

export interface CacheEntryConfig {
    ttl: number;
    key: (query: any) => string;
}

// ─────────────────────────────────────────────────────────────
// Cache Keys — single source of truth for key generation + invalidation
// ─────────────────────────────────────────────────────────────

export const ProviderConfigCacheKeys = {
    byId: (id: string) => `provider-config:${id}`,
    list: () => 'provider-config:list',
    pattern: () => 'provider-config:*',
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
    [ListProviderConfigsQuery.name, { ttl: 300, key: () => ProviderConfigCacheKeys.list() }],
    [
        GetProviderConfigByIdQuery.name,
        { ttl: 60, key: (q: GetProviderConfigByIdQuery) => ProviderConfigCacheKeys.byId(q.id) },
    ],
]);
