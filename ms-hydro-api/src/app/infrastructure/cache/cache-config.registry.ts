export interface CacheEntryConfig {
    ttl: number;
    key: (query: any) => string;
}

// ─────────────────────────────────────────────────────────────
// Cache Keys — single source of truth for key generation + invalidation
// ─────────────────────────────────────────────────────────────

export const BasinCacheKeys = {
    byId: (id: string) => `basin:${id}`,
    list: () => 'basins:list',
    pattern: () => 'basin*',
};

export const SubBasinCacheKeys = {
    byId: (id: string) => `sub-basin:${id}`,
    list: () => 'sub-basins:list',
    pattern: () => 'sub-basin*',
};

export const StationCacheKeys = {
    byId: (id: string) => `station:${id}`,
    byCode: (code: string) => `station:code:${code}`,
    bySubBasinName: (name: string) => `station:name:${name}`,
    threshold: (id: string) => `station:threshold:${id}`,
    list: (q: any) => {
        const parts = ['stations:list'];
        if (q.page !== undefined) parts.push(`p${q.page}`);
        if (q.limit !== undefined) parts.push(`l${q.limit}`);
        if (q.subBasinId) parts.push(`sb${q.subBasinId}`);
        if (q.stationType) parts.push(`st${q.stationType}`);
        if (q.isActive !== undefined) parts.push(`a${q.isActive}`);
        if (q.zona) parts.push(`z${q.zona}`);
        if (q.subBasinName) parts.push(`sbn${q.subBasinName}`);
        if (q.comarcaName) parts.push(`c${q.comarcaName}`);
        if (q.sistemaName) parts.push(`si${q.sistemaName}`);
        if (q.stationCode) parts.push(`sc${q.stationCode}`);
        return parts.join(':');
    },
    pattern: () => 'station*',
};

export const GeoDataCacheKeys = {
    search: (query: string) => `geo-data:search:${query.toLowerCase()}`,
    pattern: () => 'geo-data:*',
};

export const ResguardoCacheKeys = {
    byStation: (stationCode: string) => `resguardo:station:${stationCode}`,
    byStationAndDate: (stationCode: string, date: string) => `resguardo:station:${stationCode}:${date}`,
    pattern: () => 'resguardo:*',
};

export const DownstreamStationsCacheKeys = {
    byCodes: (codes: string[]) => `stations:downstream:${codes.sort().join(',')}`,
    pattern: () => 'stations:downstream:*',
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
    // Basin
    ['GetBasinByIdQuery', { ttl: 300, key: (q: any) => BasinCacheKeys.byId(q.id) }],
    ['ListBasinsQuery', { ttl: 300, key: () => BasinCacheKeys.list() }],

    // SubBasin
    ['GetSubBasinByIdQuery', { ttl: 300, key: (q: any) => SubBasinCacheKeys.byId(q.id) }],
    ['ListSubBasinsQuery', { ttl: 300, key: () => SubBasinCacheKeys.list() }],

    // Station
    ['GetStationByIdQuery', { ttl: 300, key: (q: any) => StationCacheKeys.byId(q.id) }],
    ['GetStationBySubBasinNameQuery', { ttl: 300, key: (q: any) => StationCacheKeys.bySubBasinName(q.subBasinName) }],
    ['GetStationByCodeQuery', { ttl: 300, key: (q: any) => StationCacheKeys.byCode(q.stationCode) }],
    ['GetStationThresholdQuery', { ttl: 600, key: (q: any) => StationCacheKeys.threshold(q.id) }],
    ['ListStationsQuery', { ttl: 300, key: (q: any) => StationCacheKeys.list(q) }],

    // GeoData
    ['SearchGeoDataQuery', { ttl: 600, key: (q: any) => GeoDataCacheKeys.search(q.query) }],

    // Resguardo
    ['GetResguardosByStationQuery', { ttl: 600, key: (q: any) => ResguardoCacheKeys.byStation(q.stationCode) }],
    [
        'GetResguardoByDateQuery',
        { ttl: 600, key: (q: any) => ResguardoCacheKeys.byStationAndDate(q.stationCode, q.date) },
    ],

    // DownstreamStations
    ['GetDownstreamStationsQuery', { ttl: 600, key: (q: any) => DownstreamStationsCacheKeys.byCodes(q.codes) }],
]);
