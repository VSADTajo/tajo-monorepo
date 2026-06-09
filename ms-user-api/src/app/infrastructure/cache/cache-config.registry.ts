import { GetUserRolesQuery, ListRolesQuery } from '@app/application/queries/role.queries';
import { GetUserByIdQuery, ListUsersQuery } from '@app/application/queries/user.queries';
import { GetRolePermissionsQuery } from '@app/application/queries/role-permission.queries';
import { ListPermissionsQuery } from '@app/application/queries/permission.queries';
import { ListGroupsQuery } from '@app/application/queries/group.queries';
import { GetUserGroupsQuery } from '@app/application/queries/group.queries';

export interface CacheEntryConfig {
    ttl: number;
    key: (query: any) => string;
}

// ─────────────────────────────────────────────────────────────
// Cache Keys — single source of truth for key generation + invalidation
// ─────────────────────────────────────────────────────────────

export const RoleCacheKeys = {
    list: () => 'roles:list',
    pattern: () => 'roles:*',
};

export const UserCacheKeys = {
    list: () => 'users:list',
    byId: (id: string) => `user:${id}`,
    pattern: () => 'user:*',
};

export const UserRoleCacheKeys = {
    byUser: (userId: string) => `user-roles:${userId}`,
};

export const PermissionCacheKeys = {
    list: () => 'permissions:list',
    byRoleId: (roleId: string) => `permissions:roleid:${roleId}`,
    byRoleName: (name: string) => `permissions:role:${name}`,
    pattern: () => 'permissions:*',
};

export const GroupCacheKeys = {
    list: () => 'groups:list',
    pattern: () => 'groups:*',
};

export const UserGroupCacheKeys = {
    byUser: (userId: string) => `user-groups:${userId}`,
    pattern: () => 'user-groups:*',
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
    [ListRolesQuery.name, { ttl: 300, key: () => RoleCacheKeys.list() }],
    [ListUsersQuery.name, { ttl: 300, key: () => UserCacheKeys.list() }],
    [GetUserByIdQuery.name, { ttl: 300, key: (q: GetUserByIdQuery) => UserCacheKeys.byId(q.id) }],
    [GetUserRolesQuery.name, { ttl: 60, key: (q: GetUserRolesQuery) => UserRoleCacheKeys.byUser(q.userId) }],
    [
        GetRolePermissionsQuery.name,
        { ttl: 60, key: (q: GetRolePermissionsQuery) => PermissionCacheKeys.byRoleId(q.roleId) },
    ],
    [ListPermissionsQuery.name, { ttl: 300, key: () => PermissionCacheKeys.list() }],
    [ListGroupsQuery.name, { ttl: 300, key: () => GroupCacheKeys.list() }],
    [GetUserGroupsQuery.name, { ttl: 60, key: (q: GetUserGroupsQuery) => UserGroupCacheKeys.byUser(q.userId) }],
]);
