# Spec: RBAC Route Permissions

## Summary
Add route-level permissions to roles. Each role can be assigned specific HTTP method+path combinations. The gateway checks these permissions on every request using a Redis cache-aside pattern.

## Actors
- Admin user (via backoffice)
- Gateway API (internal)

## Endpoints Added
- PUT /roles/:roleId/permissions — Sync all permissions for a role (replaces existing)
- GET /roles/:roleId/permissions — Get permissions of a role
- GET /roles/permissions/bulk?roles=admin,supervisor — Get merged permissions for multiple roles by name (used by gateway on cache miss)

## Data Model
RolePermission { id: uuid, roleId: uuid → Role (CASCADE), method: varchar(10), path: varchar(500) }

## Cache Strategy
- On sync: delete Redis key `permissions:role:{roleName}` so gateway repopulates
- Gateway reads `permissions:role:{roleName}` → on miss calls bulk endpoint

## Decisions
- PUT /roles/:roleId/permissions replaces ALL permissions atomically (sync pattern)
- Permission format stored: method uppercase + path in OpenAPI format (e.g. /users/{id})
- Admin role bypasses route permission check at gateway level
