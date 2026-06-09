# Implementation Plan: User Roles

**Branch**: `001-user-roles` | **Date**: 2026-02-19 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-user-roles/spec.md`

## Summary

Create a Role entity and a many-to-many User-Role relationship in the system. This includes CRUD operations for roles, role assignment/removal to users, and querying user roles. The feature follows the existing hexagonal architecture with CQRS pattern: new domain entities, value objects, ports, commands/queries, and REST endpoints.

## Technical Context

**Language/Version**: TypeScript 5.7+ (strict mode) on Node.js >= 22
**Primary Dependencies**: NestJS 11, @nestjs/cqrs 11, TypeORM 0.3, class-validator, class-transformer, nestjs-pino
**Storage**: PostgreSQL 16 via TypeORM (raw SQL migrations, `synchronize: false`)
**Testing**: Jest + Supertest + Testcontainers (real Postgres, no mocks for repositories)
**Target Platform**: Linux server / Docker container
**Project Type**: Single NestJS API server (hexagonal architecture)
**Performance Goals**: Standard API response times; system must handle 100+ roles and 10,000+ user-role assignments per spec
**Constraints**: All new code must comply with established hexagonal layers, CQRS bus pattern, and the project's TypeScript strict configuration
**Scale/Scope**: 2 new entities (Role, UserRole), 1 new value object, 2 new ports, 3 commands, 2 queries, 5 endpoints, 2 migrations, e2e tests

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Hexagonal Architecture | PASS | New code follows api → application → domain ← infrastructure layers |
| II. CQRS with MediatR Pattern | PASS | All operations routed through CommandBus/QueryBus. Controllers never inject repositories |
| III. Dependency Inversion via Ports | PASS | IRoleRepository and IUserRoleRepository defined as abstract classes, bound in infrastructure.module |
| IV. Domain-Driven Validation | PASS | RoleNameValueObject validates on construction. Entity business methods enforce invariants |
| V. Integration Testing through Endpoints | PASS | Tests use createTestApp() with real Postgres. Verify via POST/GET, no direct DB assertions |
| VI. Type Safety & Strictness | PASS | Path aliases used. Full strict mode. No `any` |
| VII. Structured Error Hierarchy | PASS | Uses ApiError (409 conflict), EntityError (400 validation), RepositoryError (500 DB errors) |

All gates pass. No violations to justify.

## Project Structure

### Documentation (this feature)

```text
specs/001-user-roles/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── api/
│   │   ├── controllers/
│   │   │   └── role.controller.ts               # New: Role + UserRole endpoints
│   │   └── dtos/
│   │       ├── create-role.request.dto.ts        # New
│   │       ├── create-role.response.dto.ts       # New
│   │       ├── assign-role.request.dto.ts        # New
│   │       ├── assign-role.response.dto.ts       # New
│   │       ├── get-user-roles.response.dto.ts    # New
│   │       ├── list-roles.response.dto.ts        # New
│   │       └── remove-user-role.response.dto.ts  # New
│   │
│   ├── application/
│   │   ├── commands/
│   │   │   ├── create-role.command.ts            # New: Command + Handler
│   │   │   ├── assign-role-to-user.command.ts    # New: Command + Handler
│   │   │   └── remove-role-from-user.command.ts  # New: Command + Handler
│   │   ├── queries/
│   │   │   ├── get-user-roles.query.ts           # New: Query + Handler
│   │   │   └── list-roles.query.ts               # New: Query + Handler
│   │   ├── mappers/
│   │   │   ├── create-role.mapper.ts             # New
│   │   │   ├── assign-role-to-user.mapper.ts     # New
│   │   │   ├── get-user-roles.mapper.ts          # New
│   │   │   ├── list-roles.mapper.ts              # New
│   │   │   └── remove-role-from-user.mapper.ts   # New
│   │   └── application.module.ts                 # Modified: register new handlers + controller
│   │
│   ├── domain/
│   │   ├── entities/
│   │   │   ├── role.entity.ts                    # New
│   │   │   └── user-role.entity.ts               # New
│   │   ├── value-objects/
│   │   │   └── role-name.value-object.ts         # New
│   │   ├── ports/
│   │   │   ├── role-repository.port.ts           # New
│   │   │   └── user-role-repository.port.ts      # New
│   │   ├── results/
│   │   │   ├── create-role.result.ts             # New
│   │   │   ├── assign-role.result.ts             # New
│   │   │   ├── get-user-roles.result.ts          # New
│   │   │   └── list-roles.result.ts              # New
│   │   └── errors/                               # Existing errors reused (ApiError, EntityError)
│   │
│   └── infrastructure/
│       ├── persistence/
│       │   ├── role.repository.ts                # New
│       │   └── user-role.repository.ts           # New
│       └── infrastructure.module.ts              # Modified: register entities + bind ports
│
├── migrations/
│   ├── TIMESTAMP-create-roles-table.ts           # New
│   └── TIMESTAMP-create-user-roles-table.ts      # New
│
test/
├── factories/
│   └── role.factory.ts                           # New
└── modules/
    └── roles/
        ├── create-role.e2e-spec.ts               # New
        ├── assign-role-to-user.e2e-spec.ts       # New
        ├── get-user-roles.e2e-spec.ts            # New
        ├── list-roles.e2e-spec.ts                # New
        └── remove-role-from-user.e2e-spec.ts     # New
```

**Structure Decision**: Follows existing hexagonal architecture exactly. Role management gets its own controller (`role.controller.ts`) since it's a distinct resource. The UserRole join entity is a separate entity with its own repository port, following the established pattern of explicit join tables with metadata (timestamps).

## Complexity Tracking

> No constitution violations. No complexity justifications needed.
