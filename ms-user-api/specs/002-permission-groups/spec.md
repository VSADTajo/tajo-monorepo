# 002 — Permission Entities + Groups

## Problema

Los permisos (`method + path`) estan embebidos en `role_permissions` como columnas inline. No hay entidad `Permission` reutilizable ni agrupacion de roles. Asignar acceso a un usuario requiere asignar roles uno por uno.

## Solucion

Separar `Permission` como entidad standalone y agregar `Group` como bundle de roles.

## Modelo de datos

```
Permission  { id, name?, method, path }          <-- nueva entidad
    ^ role_permissions { roleId, permissionId }   <-- refactorizado (antes tenia method+path inline)
Role        { id, name, description }             <-- sin cambios
    ^ group_roles { groupId, roleId }             <-- nuevo
Group       { id, name, description }             <-- nuevo
    ^ user_groups { userId, groupId }             <-- nuevo
User
    ^ user_roles (sin cambios)
```

## Resolucion de permisos (flujo gateway)

1. `ValidateTokenHandler` (auth-api) llama `GET /users/:id/roles` en user-api
2. `GetUserRoles` query ahora devuelve **union** de:
   - Roles directos via `user_roles`
   - Roles de grupos via `user_groups -> group_roles`
3. JWT contiene todos los roles (directos + de grupos)
4. Gateway `PermissionMiddleware` funciona igual que antes — no cambia nada

## Tablas nuevas

### `permissions`
| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK, default uuid_generate_v4() |
| name | varchar(100) | UNIQUE, nullable |
| method | varchar(10) | NOT NULL |
| path | varchar(500) | NOT NULL |
| createdAt | timestamp | default now() |
| updatedAt | timestamp | default now() |

Unique constraint: `(method, path)` para evitar duplicados.

### `groups`
| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK, default uuid_generate_v4() |
| name | varchar(50) | NOT NULL, UNIQUE |
| description | varchar(255) | nullable |
| createdAt | timestamp | default now() |
| updatedAt | timestamp | default now() |

### `group_roles`
| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK |
| groupId | uuid | FK -> groups ON DELETE CASCADE |
| roleId | uuid | FK -> roles ON DELETE RESTRICT |
| createdAt | timestamp | default now() |
| updatedAt | timestamp | default now() |

Unique constraint: `(groupId, roleId)`.

### `user_groups`
| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK |
| userId | uuid | FK -> users ON DELETE CASCADE |
| groupId | uuid | FK -> groups ON DELETE CASCADE |
| createdAt | timestamp | default now() |
| updatedAt | timestamp | default now() |

Unique constraint: `(userId, groupId)`.

### `role_permissions` (refactorizado)

Antes: `{ id, roleId, method, path }`
Despues: `{ id, roleId, permissionId }`

## Migracion

1. Crear tabla `permissions`
2. Insertar pares unicos `(method, path)` desde `role_permissions` actual
3. Agregar columna `permissionId` a `role_permissions`
4. Poblar `permissionId` matcheando `method+path`
5. Hacer `permissionId` NOT NULL + FK
6. Agregar unique constraint `(roleId, permissionId)`
7. Dropear columnas `method` y `path` de `role_permissions`
8. Crear tablas `groups`, `group_roles`, `user_groups`

## Endpoints nuevos

### Permissions (`/permissions`)
- `GET /permissions` — listar todos
- `POST /permissions` — crear `{ name?, method, path }`
- `DELETE /permissions/:id` — borrar (falla si tiene roles asignados)

### Groups (`/groups`)
- `GET /groups` — listar con roles
- `POST /groups` — crear `{ name, description? }`
- `DELETE /groups/:id` — borrar
- `POST /groups/:id/roles` — asignar rol `{ roleId }`
- `DELETE /groups/:id/roles/:roleId` — quitar rol

### Users (agregar a existente)
- `GET /users/:id/groups` — grupos del usuario
- `POST /users/:id/groups` — asignar grupo `{ groupId }`
- `DELETE /users/:id/groups/:groupId` — quitar grupo

### Roles (actualizar)
- `PUT /roles/:id/permissions` — sync ahora recibe `{ permissionIds: string[] }`
- `GET /roles/:id/permissions` — devuelve Permission entities completas

### Bulk (actualizar)
- `GET /roles/permissions/bulk?roles=a,b` — misma interfaz, pero internamente join con `permissions`

## Archivos nuevos

### Entities
- `src/app/domain/entities/permission.entity.ts`
- `src/app/domain/entities/group.entity.ts`
- `src/app/domain/entities/group-role.entity.ts`
- `src/app/domain/entities/user-group.entity.ts`

### Ports
- `src/app/domain/ports/permission-repository.port.ts`
- `src/app/domain/ports/group-repository.port.ts`
- `src/app/domain/ports/group-role-repository.port.ts`
- `src/app/domain/ports/user-group-repository.port.ts`

### Results
- `src/app/domain/results/permission.result.ts`
- `src/app/domain/results/group.result.ts`

### Commands
- `src/app/application/commands/permission.commands.ts`
- `src/app/application/commands/group.commands.ts`

### Queries
- `src/app/application/queries/permission.queries.ts`
- `src/app/application/queries/group.queries.ts`

### DTOs
- `src/app/api/dtos/permission.dtos.ts`
- `src/app/api/dtos/group.dtos.ts`

### Mappers
- `src/app/application/mappers/permission.mappers.ts`
- `src/app/application/mappers/group.mappers.ts`

### Controllers
- `src/app/api/controllers/permission.controller.ts`
- `src/app/api/controllers/group.controller.ts`

### Repositories
- `src/app/infrastructure/persistence/permission.repository.ts`
- `src/app/infrastructure/persistence/group.repository.ts`
- `src/app/infrastructure/persistence/group-role.repository.ts`
- `src/app/infrastructure/persistence/user-group.repository.ts`

### Migration
- `src/migrations/1771700000000-permission-groups.ts`

## Archivos modificados

- `src/app/domain/entities/role-permission.entity.ts` — quitar method/path, agregar permissionId FK
- `src/app/domain/entities/role.entity.ts` — agregar `@OneToMany` groupRoles
- `src/app/domain/entities/user.entity.ts` — agregar `@OneToMany` userGroups
- `src/app/domain/ports/role-permission-repository.port.ts` — actualizar metodos
- `src/app/infrastructure/persistence/role-permission.repository.ts` — actualizar queries
- `src/app/application/commands/role-permission.commands.ts` — sync con permissionIds
- `src/app/application/queries/role-permission.queries.ts` — join con permissions table
- `src/app/application/queries/role.queries.ts` — GetUserRoles incluye group roles
- `src/app/application/commands/role.commands.ts` — DeleteRole tambien limpia group_roles
- `src/app/api/dtos/role-permission.dtos.ts` — actualizar DTOs
- `src/app/application/mappers/role-permission.mappers.ts` — actualizar
- `src/app/api/controllers/role.controller.ts` — actualizar permission endpoints
- `src/app/api/controllers/user.controller.ts` — agregar group endpoints
- `src/app/infrastructure/cache/cache-config.registry.ts` — agregar cache keys nuevos
- `src/app/infrastructure/infrastructure.module.ts` — registrar nuevas entidades y ports
- `src/app/application/application.module.ts` — registrar handlers y controllers

## Lo que NO cambia
- `ms-gateway-api PermissionMiddleware` — misma logica
- `GET /roles/permissions/bulk` — misma interfaz de response `{ permissions: [{ method, path }] }`
- JWT y AuthMiddleware — sin tocar
