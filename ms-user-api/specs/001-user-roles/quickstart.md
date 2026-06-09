# Quickstart: User Roles

**Feature**: 001-user-roles
**Date**: 2026-02-19

## Prerequisites

- Node.js >= 22 (see `.nvmrc`)
- Docker running (for PostgreSQL and tests)
- Dependencies installed: `npm install`

## Development Setup

```bash
# Start Postgres + API in dev mode
docker compose up

# Or run API locally (requires Postgres running)
npm run start:dev
```

## Implementation Order

Follow this sequence to build the feature incrementally. Each step produces a working, testable slice.

### Step 1: Domain Layer (entities, VOs, ports, errors, results)

1. Create `src/app/domain/entities/role.entity.ts` — Role entity extending BaseAuditEntity
2. Create `src/app/domain/entities/user-role.entity.ts` — UserRole join entity extending BaseAuditEntity
3. Create `src/app/domain/value-objects/role-name.value-object.ts` — Validates and normalizes role names
4. Create `src/app/domain/ports/role-repository.port.ts` — Abstract class for role persistence
5. Create `src/app/domain/ports/user-role-repository.port.ts` — Abstract class for user-role persistence
6. Create results in `src/app/domain/results/`:
   - `create-role.result.ts`
   - `assign-role.result.ts`
   - `get-user-roles.result.ts`
   - `list-roles.result.ts`

### Step 2: Infrastructure Layer (repositories, bindings, migrations)

1. Create `src/app/infrastructure/persistence/role.repository.ts` — Implements IRoleRepository
2. Create `src/app/infrastructure/persistence/user-role.repository.ts` — Implements IUserRoleRepository
3. Update `src/app/infrastructure/infrastructure.module.ts`:
   - Add Role and UserRole to `TypeOrmModule.forFeature([...])`
   - Bind `IRoleRepository → RoleRepository`
   - Bind `IUserRoleRepository → UserRoleRepository`
4. Create migrations:
   - `src/migrations/TIMESTAMP-create-roles-table.ts`
   - `src/migrations/TIMESTAMP-create-user-roles-table.ts`

### Step 3: Application Layer (commands, queries, mappers)

1. Create `src/app/application/commands/create-role.command.ts` — Command + Handler
2. Create `src/app/application/commands/assign-role-to-user.command.ts` — Command + Handler
3. Create `src/app/application/commands/remove-role-from-user.command.ts` — Command + Handler
4. Create `src/app/application/queries/list-roles.query.ts` — Query + Handler
5. Create `src/app/application/queries/get-user-roles.query.ts` — Query + Handler
6. Create mappers in `src/app/application/mappers/`:
   - `create-role.mapper.ts`
   - `assign-role-to-user.mapper.ts`
   - `remove-role-from-user.mapper.ts`
   - `list-roles.mapper.ts`
   - `get-user-roles.mapper.ts`

### Step 4: API Layer (DTOs, controller)

1. Create DTOs in `src/app/api/dtos/`:
   - `create-role.request.dto.ts` + `create-role.response.dto.ts`
   - `assign-role.request.dto.ts` + `assign-role.response.dto.ts`
   - `get-user-roles.response.dto.ts`
   - `list-roles.response.dto.ts`
   - `remove-user-role.response.dto.ts`
2. Create `src/app/api/controllers/role.controller.ts` — All 5 endpoints
3. Update `src/app/application/application.module.ts`:
   - Register all handlers in providers
   - Register RoleController in controllers

### Step 5: Testing

1. Create `test/factories/role.factory.ts` — Factory functions for test data
2. Create e2e tests in `test/modules/roles/`:
   - `create-role.e2e-spec.ts`
   - `assign-role-to-user.e2e-spec.ts`
   - `get-user-roles.e2e-spec.ts`
   - `list-roles.e2e-spec.ts`
   - `remove-role-from-user.e2e-spec.ts`

## Verification

```bash
# Run migrations (dev)
npm run migration:run

# Run unit tests
npm run test

# Run e2e tests (requires Docker)
npm run test:e2e

# Run specific test
npm run test:e2e -- --testPathPattern=create-role

# Lint
npm run lint
```

## API Quick Reference

| Method | Path                           | Description              | Status Codes      |
|--------|--------------------------------|--------------------------|--------------------|
| POST   | /roles                         | Create a new role        | 201, 400, 409     |
| GET    | /roles                         | List all roles           | 200                |
| POST   | /users/:userId/roles           | Assign role to user      | 201, 404, 409     |
| GET    | /users/:userId/roles           | Get user's roles         | 200, 404           |
| DELETE | /users/:userId/roles/:roleId   | Remove role from user    | 200, 404           |
