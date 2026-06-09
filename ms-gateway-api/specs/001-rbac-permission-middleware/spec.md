# Spec: RBAC Permission Middleware

## Summary
Add dynamic route-level permission checking to the gateway using a cache-aside pattern with Redis.

## Flow
1. AuthMiddleware validates JWT → req.user = { userId, roles: ['supervisor'] }
2. PermissionMiddleware:
   a. If user has 'admin' role → bypass (admin has all access)
   b. For each role, get permissions from Redis cache
   c. On cache miss: fetch from ms-user-api GET /roles/permissions/bulk?roles=supervisor
   d. Store in Redis with TTL=300s
   e. Check if any permission matches current method+path
   f. No match → 403

## Path Matching
- Permissions stored as: { method: 'GET', path: '/users/{id}' }
- Request: GET /users/abc-123
- Match: convert {id} → regex [^/]+ and test against actual path

## Bypass
- Admin role bypasses permission check (configurable via RBAC_BYPASS_ROLES env var)
- Auth routes (login, register, etc.) excluded (already handled by AuthMiddleware exclusion)

## Cache
- Redis key: permissions:role:{roleName} → JSON array of { method, path }
- TTL: 300s (5 min)
- Invalidation: ms-user-api deletes the key when permissions change
