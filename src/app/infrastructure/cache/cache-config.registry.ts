import { ListFilesQuery, ListPathsOverviewQuery } from '@app/application/queries/file.queries';
import {
    ListMappingSchemasQuery,
    GetMappingSchemaByIdQuery,
    GetActiveMappingSchemaByPathQuery,
} from '@app/application/queries/mapping-schema.queries';
import { ListSftpUsersQuery, GetSftpUserByIdQuery } from '@app/application/queries/sftp-user.queries';
import {
    GetCleanupJobByIdQuery,
    GetCleanupJobByPathQuery,
    ListCleanupJobsQuery,
} from '@app/application/queries/cleanup-job.queries';

export interface CacheEntryConfig {
    ttl: number;
    key: (query: any) => string;
}

// ─────────────────────────────────────────────────────────────
// Cache Keys — single source of truth for key generation + invalidation
// ─────────────────────────────────────────────────────────────

export const FileCacheKeys = {
    list: (directory: string) => `files:list:${directory}`,
    pathsOverview: () => 'files:paths-overview',
    pattern: () => 'files:*',
};

export const MappingSchemaCacheKeys = {
    list: () => 'mapping-schemas:list',
    byId: (id: string) => `mapping-schemas:${id}`,
    activeByPath: (dirPath: string) => `mapping-schemas:active:${dirPath}`,
    pattern: () => 'mapping-schemas:*',
};

export const SftpUserCacheKeys = {
    list: () => 'sftp-users:list',
    byId: (id: string) => `sftp-users:${id}`,
    pattern: () => 'sftp-users:*',
};

export const CleanupJobCacheKeys = {
    byId: (id: string) => `cleanup-job:${id}`,
    byPath: (path: string) => `cleanup-job:path:${path}`,
    list: () => 'cleanup-job:list',
    pattern: () => 'cleanup-job:*',
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
    // Files
    [ListFilesQuery.name, { ttl: 300, key: (q: ListFilesQuery) => FileCacheKeys.list(q.directory) }],
    [ListPathsOverviewQuery.name, { ttl: 30, key: () => FileCacheKeys.pathsOverview() }],

    // Mapping Schemas
    [ListMappingSchemasQuery.name, { ttl: 600, key: () => MappingSchemaCacheKeys.list() }],
    [
        GetMappingSchemaByIdQuery.name,
        { ttl: 600, key: (q: GetMappingSchemaByIdQuery) => MappingSchemaCacheKeys.byId(q.id) },
    ],
    [
        GetActiveMappingSchemaByPathQuery.name,
        { ttl: 300, key: (q: GetActiveMappingSchemaByPathQuery) => MappingSchemaCacheKeys.activeByPath(q.filePath) },
    ],

    // SFTP Users
    [ListSftpUsersQuery.name, { ttl: 300, key: () => SftpUserCacheKeys.list() }],
    [GetSftpUserByIdQuery.name, { ttl: 300, key: (q: GetSftpUserByIdQuery) => SftpUserCacheKeys.byId(q.id) }],

    // Cleanup Jobs
    [GetCleanupJobByIdQuery.name, { ttl: 60, key: (q: GetCleanupJobByIdQuery) => CleanupJobCacheKeys.byId(q.id) }],
    [
        GetCleanupJobByPathQuery.name,
        { ttl: 60, key: (q: GetCleanupJobByPathQuery) => CleanupJobCacheKeys.byPath(q.path) },
    ],
    [ListCleanupJobsQuery.name, { ttl: 30, key: () => CleanupJobCacheKeys.list() }],
]);
