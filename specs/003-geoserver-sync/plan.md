# Implementation Plan: GeoServer Data Sync

**Branch**: `003-geoserver-sync` | **Date**: 2026-03-24 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/003-geoserver-sync/spec.md`

## Summary

Add a read-only secondary TypeORM connection to the GeoServer PostGIS database and implement a manual `POST /sync/geoserver` endpoint. The sync reads 254 stations, 119 sub-basins, and 11 zones from GeoServer, maps them using PostGIS spatial joins, and upserts into hydro-api's existing `basins`, `sub_basins`, and `stations` tables. The station type enum is expanded from 3 to 7 domain-specific types. New geographic fields are added to stations and sub-basins.

## Technical Context

**Language/Version**: TypeScript 5.7+ on Node.js >= 22
**Primary Dependencies**: NestJS 11, @nestjs/cqrs 11, TypeORM 0.3, class-validator, nestjs-pino, ioredis
**Storage**: PostgreSQL 16 (primary: hydro-api DB), PostgreSQL 17 + PostGIS (secondary: GeoServer DB, read-only)
**Testing**: Jest + Supertest + Testcontainers
**Target Platform**: Linux server (Docker container on Hetzner VM)
**Project Type**: Single NestJS microservice
**Performance Goals**: Sync operation completes within 30 seconds for ~400 total records
**Constraints**: GeoServer DB is read-only; must preserve existing umbral values during sync
**Scale/Scope**: 254 stations, 119 sub-basins, 11 basins — static reference data

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Hexagonal Architecture | PASS | New sync command follows api→application→domain←infrastructure flow. GeoServer repo implements a domain port. |
| II. CQRS with MediatR Pattern | PASS | Sync uses CommandBus via SyncGeoserverCommand + Handler. No direct repo injection in controller. |
| III. Dependency Inversion via Ports | PASS | IGeoserverRepository abstract class in domain/ports/, implemented in infrastructure/persistence/. |
| IV. Domain-Driven Validation | PASS | Mapping utilities validate zona→code and tipoCod→stationType conversions. Existing entity validation preserved. |
| V. Integration Testing through Endpoints | PASS | E2E test hits POST /sync/geoserver, then verifies via GET endpoints. Testcontainers for both DBs. |
| VI. Type Safety & Strictness | PASS | Path aliases used. StationType enum is a proper TypeScript enum. All new fields are typed. |
| VII. Structured Error Hierarchy | PASS | Sync handler uses ApiError for business errors, RepositoryError for DB failures. Controller follows standard try/catch. |

## Project Structure

### Documentation (this feature)

```text
specs/003-geoserver-sync/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── sync.contract.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── configuration/
│   └── geoserver/                          # NEW: GeoServer DB config (4 files)
│       ├── geoserver-config.type.ts
│       ├── geoserver-config.ts
│       ├── geoserver-config.service.ts
│       └── geoserver-config.module.ts
│
├── app/
│   ├── api/
│   │   ├── controllers/
│   │   │   └── sync.controller.ts          # NEW: POST /sync/geoserver
│   │   └── dtos/
│   │       ├── sync.dtos.ts                # NEW: SyncGeoserverResponseDto
│   │       ├── station.dtos.ts             # MODIFY: add municipio, provincia, ccaa, tipoCod
│   │       └── sub-basin.dtos.ts           # MODIFY: add area, perimetro, centroidX, centroidY
│   │
│   ├── application/
│   │   ├── commands/
│   │   │   └── sync.commands.ts            # NEW: SyncGeoserverCommand + Handler
│   │   └── mappers/
│   │       ├── sync.mappers.ts             # NEW: SyncMapper
│   │       ├── station.mappers.ts          # MODIFY: include new fields
│   │       └── sub-basin.mappers.ts        # MODIFY: include new fields
│   │
│   ├── domain/
│   │   ├── entities/
│   │   │   ├── geo-punto-saih.entity.ts    # NEW: read-only GeoServer entity
│   │   │   ├── geo-subcuenca.entity.ts     # NEW: read-only GeoServer entity
│   │   │   ├── station.entity.ts           # MODIFY: add columns, remove UNIQUE
│   │   │   └── sub-basin.entity.ts         # MODIFY: add columns
│   │   ├── ports/
│   │   │   └── geoserver-repository.port.ts # NEW: IGeoserverRepository
│   │   ├── results/
│   │   │   ├── sync.results.ts             # NEW: SyncGeoserverResult
│   │   │   ├── station.results.ts          # MODIFY: add new fields
│   │   │   └── sub-basin.results.ts        # MODIFY: add new fields
│   │   └── types/
│   │       ├── station-type.enum.ts        # MODIFY: 3→7 enum values
│   │       └── geoserver-mappings.ts       # NEW: zona/tipoCod mapping utils
│   │
│   └── infrastructure/
│       ├── persistence/
│       │   ├── geoserver-database-provider.module.ts  # NEW: named 'geoserver' connection
│       │   └── geoserver.repository.ts     # NEW: raw SQL spatial queries
│       └── infrastructure.module.ts        # MODIFY: import GeoServer provider + repo
│
├── migrations/
│   └── 1771556000000-add-geoserver-fields.ts  # NEW: enum + columns + drop constraint
│
└── .env.example                            # MODIFY: add GEOSERVER_DB_* vars
```

**Structure Decision**: Follows existing hexagonal architecture. GeoServer config in `configuration/geoserver/`, read-only entities in `domain/entities/`, repository in `infrastructure/persistence/`. All new code follows established patterns.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Second DataSource (named 'geoserver') | Need read-only access to external PostGIS DB for spatial joins | HTTP/WFS API would lose spatial query capability and add latency |
| Raw SQL in GeoserverRepository | ST_Contains spatial join requires PostGIS functions not available in TypeORM QueryBuilder | TypeORM has no built-in spatial support for cross-table PostGIS joins |
