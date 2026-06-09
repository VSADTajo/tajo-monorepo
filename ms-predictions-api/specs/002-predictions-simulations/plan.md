# Implementation Plan: Predictions & Simulations Layer

**Branch**: `002-predictions-simulations` | **Date**: 2026-03-11 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-predictions-simulations/spec.md`

## Summary

Migrate the predictions/simulations data layer from the Python things-board-backend to ms-predictions-api (NestJS 11). The service consumes normalized time series from ms-model-api via RabbitMQ, persists them as Simulation → Prediction → PredictionResult records, provides query APIs for the frontend dashboard, and generates threshold-based notifications. Station/Basin entities live in hydro-api; this service only references stationId.

## Technical Context

**Language/Version**: TypeScript 5.7+ on Node.js >= 22
**Primary Dependencies**: NestJS 11, @nestjs/cqrs 11, @nestjs/microservices, TypeORM 0.3, class-validator, ioredis, amqplib, axios (for hydro-api calls)
**Storage**: PostgreSQL 16 via TypeORM (tables: prediction_types, simulations, predictions, prediction_results, notifications) + Redis 7 (query cache + station threshold cache)
**Testing**: Jest + Supertest + Testcontainers (real Postgres)
**Target Platform**: Linux server (Docker container)
**Project Type**: NestJS microservice (hexagonal architecture + CQRS + RabbitMQ hybrid)
**Performance Goals**: Ingest 100 concurrent time series messages; query response < 2s for 6 months of data
**Constraints**: Bulk insert for prediction results (1000+ rows per message); idempotent message processing
**Scale/Scope**: 5 entities, ~20 endpoints, 1 RabbitMQ consumer, 1 HTTP client (hydro-api)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Hexagonal Architecture | PASS | api → application → domain ← infrastructure. Consumer in application/consumers/. |
| II. CQRS with MediatR | PASS | All ops through CommandBus/CachingQueryBus. Consumer dispatches commands. |
| III. Dependency Inversion via Ports | PASS | New ports: ISimulationRepository, IPredictionRepository, IPredictionResultRepository, IPredictionTypeRepository, INotificationRepository, IStationThresholdService. |
| IV. Domain-Driven Validation | PASS | Value objects for SimulationDate, Ensemble, Percentile. Entity validate() methods. |
| V. Integration Testing through Endpoints | PASS | E2E tests via HTTP + mock RabbitMQ consumer dispatch. Real Postgres via Testcontainers. |
| VI. Type Safety & Strictness | PASS | Strict TS, path aliases, zero any. |
| VII. Structured Error Hierarchy | PASS | ApiError, EntityError, RepositoryError, ProviderError for hydro-api calls. |

No violations. All principles fully compatible.

## Project Structure

### Documentation (this feature)

```text
specs/002-predictions-simulations/
├── plan.md              # This file
├── research.md          # Phase 0: research decisions
├── data-model.md        # Phase 1: entity definitions
├── quickstart.md        # Phase 1: integration scenarios
├── contracts/           # Phase 1: OpenAPI contract
│   └── openapi.yaml
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 output (via /speckit.tasks)
```

### Source Code (repository root)

```text
src/app/
├── api/
│   ├── controllers/
│   │   ├── simulation.controller.ts          # Simulation CRUD + finalize
│   │   ├── prediction.controller.ts          # Prediction queries
│   │   └── notification.controller.ts        # Notification queries + verify/read
│   └── dtos/
│       ├── simulation.dtos.ts                # Simulation request/response DTOs
│       ├── prediction.dtos.ts                # Prediction request/response DTOs
│       └── notification.dtos.ts              # Notification request/response DTOs
│
├── application/
│   ├── commands/
│   │   ├── simulation.commands.ts            # CreateSimulation, FinalizeSimulation, BatchIngest
│   │   ├── prediction.commands.ts            # ProcessTimeSeries (from consumer)
│   │   └── notification.commands.ts          # CreateNotification, VerifyNotification, MarkNotificationRead
│   ├── queries/
│   │   ├── simulation.queries.ts             # ListSimulations, GetByDate, Latest, Historical
│   │   ├── prediction.queries.ts             # HistoricalByStation, RawByProvider, LatestByEnsemble, AvailableDates, MaxAndLatest
│   │   └── notification.queries.ts           # ListNotifications
│   ├── consumers/
│   │   └── timeseries-ingested.consumer.ts   # RabbitMQ topic listener → dispatches ProcessTimeSeriesCommand
│   └── mappers/
│       ├── simulation.mappers.ts
│       ├── prediction.mappers.ts
│       └── notification.mappers.ts
│
├── domain/
│   ├── entities/
│   │   ├── prediction-type.entity.ts
│   │   ├── simulation.entity.ts
│   │   ├── prediction.entity.ts
│   │   ├── prediction-result.entity.ts
│   │   └── notification.entity.ts
│   ├── value-objects/
│   │   ├── simulation-date.value-object.ts   # Validates YYYYMMDDHHMMSS format
│   │   ├── ensemble.value-object.ts          # Validates 3-digit string (000-999)
│   │   └── percentile.value-object.ts        # Validates 0.0-100.0 range
│   ├── ports/
│   │   ├── prediction-type-repository.port.ts
│   │   ├── simulation-repository.port.ts
│   │   ├── prediction-repository.port.ts
│   │   ├── prediction-result-repository.port.ts
│   │   ├── notification-repository.port.ts
│   │   └── station-threshold-service.port.ts # Abstract class for fetching thresholds from hydro-api
│   └── results/
│       ├── prediction-type.result.ts
│       ├── simulation.result.ts
│       ├── prediction.result.ts
│       ├── prediction-result.result.ts
│       └── notification.result.ts
│
└── infrastructure/
    ├── persistence/
    │   ├── prediction-type.repository.ts
    │   ├── simulation.repository.ts
    │   ├── prediction.repository.ts
    │   ├── prediction-result.repository.ts
    │   └── notification.repository.ts
    └── services/
        └── station-threshold.service.ts      # HTTP call to hydro-api + Redis cache

src/configuration/
└── hydro-api/                                # New config module
    ├── hydro-api-config.ts
    ├── hydro-api-config.type.ts
    ├── hydro-api-config.service.ts
    └── hydro-api-config.module.ts

src/migrations/
├── XXXXX-create-prediction-types-table.ts
├── XXXXX-create-simulations-table.ts
├── XXXXX-create-predictions-table.ts
├── XXXXX-create-prediction-results-table.ts
└── XXXXX-create-notifications-table.ts

test/
├── factories/
│   ├── simulation.factory.ts
│   ├── prediction.factory.ts
│   └── notification.factory.ts
└── modules/
    ├── simulations/
    │   ├── create-simulation.e2e-spec.ts
    │   └── query-simulation.e2e-spec.ts
    ├── predictions/
    │   └── query-prediction.e2e-spec.ts
    └── notifications/
        └── notification.e2e-spec.ts
```

**Structure Decision**: Follows existing hexagonal architecture. New domain files grouped by entity (simulation, prediction, notification). Consumer pattern reuses existing RabbitMQ infrastructure. Station threshold resolution via new IStationThresholdService port + HTTP/Redis implementation.

## Complexity Tracking

No constitution violations — table not needed.
