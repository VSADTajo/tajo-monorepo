# Implementation Plan: Hydrological Reference Data Layer

**Branch**: `002-hydro-reference-data` | **Date**: 2026-03-12 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/002-hydro-reference-data/spec.md`

## Summary

Implement the Basin → SubBasin → Station geographic hierarchy as CRUD REST endpoints in ms-hydro-api. The critical deliverable is `GET /stations/:id` returning the `umbral` (alert threshold) field that ms-predictions-api depends on for notification generation. Follows the existing hexagonal architecture + CQRS patterns established by the 001-user-roles feature.

## Technical Context

**Language/Version**: TypeScript 5.7+ (strict mode) on Node.js >= 22
**Primary Dependencies**: NestJS 11, @nestjs/cqrs 11, TypeORM 0.3, class-validator, class-transformer, nestjs-pino, ioredis
**Storage**: PostgreSQL 16 via TypeORM (raw SQL migrations, `synchronize: false`), Redis 7 for cache
**Testing**: Jest 29 + Supertest 7 + Testcontainers (@testcontainers/postgresql 11)
**Target Platform**: Linux server (Docker container), consumed by ms-predictions-api via HTTP
**Project Type**: Single NestJS microservice (hexagonal architecture)
**Performance Goals**: All endpoints respond in under 2 seconds under normal load; station threshold lookup optimized for frequent reads (cached via Redis in predictions-api)
**Constraints**: Must maintain backward compatibility with ms-predictions-api's existing `GET /stations/:stationId` contract (`{ umbral: number | null }`); must follow identical patterns as 001-user-roles feature
**Scale/Scope**: ~100-1000 stations, ~10-50 sub-basins, ~5-10 basins. Low write volume, moderate read volume on station lookups.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Hexagonal Architecture | PASS | 4 layers: api/ → application/ → domain/ ← infrastructure/. Same structure as 001-user-roles. |
| II. CQRS with MediatR Pattern | PASS | All operations via CommandBus (writes) and CachingQueryBus (reads). Controllers never inject repos directly. |
| III. Dependency Inversion via Ports | PASS | Abstract class ports for IBasinRepository, ISubBasinRepository, IStationRepository. Bound in infrastructure.module.ts. |
| IV. Domain-Driven Validation | PASS | Value objects for name/code validation. Entity.validate() called in handlers before persist. |
| V. Integration Testing through Endpoints | PASS | E2E tests via Testcontainers + Supertest. No direct DB access in assertions. Mock only external services. |
| VI. Type Safety & Strictness | PASS | strict: true, path aliases, no `any`. |
| VII. Structured Error Hierarchy | PASS | EntityError (400), ApiError (404/409), RepositoryError (500). Standard try/catch in controllers. |

**Gate Result**: ALL PASS — no violations, no complexity justification needed.

## Project Structure

### Documentation (this feature)

```text
specs/002-hydro-reference-data/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (REST API contracts)
│   ├── basins.contract.md
│   ├── sub-basins.contract.md
│   └── stations.contract.md
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── api/
│   │   ├── controllers/
│   │   │   ├── basin.controller.ts
│   │   │   ├── sub-basin.controller.ts
│   │   │   └── station.controller.ts
│   │   └── dtos/
│   │       ├── basin.dtos.ts
│   │       ├── sub-basin.dtos.ts
│   │       └── station.dtos.ts
│   ├── application/
│   │   ├── commands/
│   │   │   ├── basin.commands.ts
│   │   │   ├── sub-basin.commands.ts
│   │   │   └── station.commands.ts
│   │   ├── queries/
│   │   │   ├── basin.queries.ts
│   │   │   ├── sub-basin.queries.ts
│   │   │   └── station.queries.ts
│   │   └── mappers/
│   │       ├── basin.mappers.ts
│   │       ├── sub-basin.mappers.ts
│   │       └── station.mappers.ts
│   ├── domain/
│   │   ├── entities/
│   │   │   ├── basin.entity.ts
│   │   │   ├── sub-basin.entity.ts
│   │   │   └── station.entity.ts
│   │   ├── value-objects/
│   │   │   ├── basin-code.value-object.ts
│   │   │   └── station-code.value-object.ts
│   │   ├── ports/
│   │   │   ├── basin-repository.port.ts
│   │   │   ├── sub-basin-repository.port.ts
│   │   │   └── station-repository.port.ts
│   │   ├── results/
│   │   │   ├── basin.results.ts
│   │   │   ├── sub-basin.results.ts
│   │   │   └── station.results.ts
│   │   └── types/
│   │       └── station-type.enum.ts
│   └── infrastructure/
│       ├── persistence/
│       │   ├── basin.repository.ts
│       │   ├── sub-basin.repository.ts
│       │   └── station.repository.ts
│       └── cache/
│           └── cache-config.registry.ts (extend with Basin/SubBasin/Station cache keys)
├── migrations/
│   ├── XXXX-create-basins-table.ts
│   ├── XXXX-create-sub-basins-table.ts
│   └── XXXX-create-stations-table.ts
test/
├── factories/
│   ├── basin.factory.ts
│   ├── sub-basin.factory.ts
│   └── station.factory.ts
└── modules/
    ├── basins/
    │   ├── create-basin.e2e-spec.ts
    │   ├── list-basins.e2e-spec.ts
    │   ├── get-basin.e2e-spec.ts
    │   ├── update-basin.e2e-spec.ts
    │   └── toggle-basin.e2e-spec.ts
    ├── sub-basins/
    │   ├── create-sub-basin.e2e-spec.ts
    │   ├── list-sub-basins.e2e-spec.ts
    │   ├── get-sub-basin.e2e-spec.ts
    │   ├── update-sub-basin.e2e-spec.ts
    │   └── toggle-sub-basin.e2e-spec.ts
    └── stations/
        ├── create-station.e2e-spec.ts
        ├── list-stations.e2e-spec.ts
        ├── get-station.e2e-spec.ts
        ├── get-station-by-sub-basin-name.e2e-spec.ts
        ├── update-station.e2e-spec.ts
        ├── toggle-station.e2e-spec.ts
        ├── update-threshold.e2e-spec.ts
        └── delete-station.e2e-spec.ts
```

**Structure Decision**: Follows the existing hexagonal architecture established by 001-user-roles. Each domain entity (Basin, SubBasin, Station) gets its own grouped files across all layers: controller, DTOs, commands, queries, mappers, entity, port, repository, results. Tests organized by entity under `test/modules/`.
