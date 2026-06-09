# Implementation Plan: Data Provider Layer

**Branch**: `002-data-provider-layer` | **Date**: 2026-03-11 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/002-data-provider-layer/spec.md`

## Summary

Build the external data ingestion layer for ms-model-api. The system connects to external hydrological data sources (Deltares FEWS REST API and SFTP files via ms-sftp-api), fetches time series forecast data, normalizes it to a common format, and publishes it to RabbitMQ for downstream consumption by predictions-api. Includes CRON-based scheduling, provider configuration CRUD, ingestion run logging, and manual trigger capabilities.

## Technical Context

**Language/Version**: TypeScript 5.7+ on Node.js >= 22
**Primary Dependencies**: NestJS 11, @nestjs/cqrs 11, @nestjs/schedule 4, TypeORM 0.3, axios
**Storage**: PostgreSQL 16 via TypeORM (tables: `provider_configs`, `ingestion_runs`)
**Cache**: Redis 7 via ioredis (CachingQueryBus for provider config queries)
**Messaging**: RabbitMQ 3.13 via amqplib — publishes to topic exchange `model-events` with routing key `timeseries.ingested`
**Testing**: Jest + Supertest + Testcontainers (real Postgres, mock external HTTP calls)
**Target Platform**: Linux server (Docker container on Hetzner VM)
**Project Type**: Single NestJS microservice (hexagonal architecture)
**Performance Goals**: Ingest ~275 series x ~576 events (~158K data points) within 60 seconds including parse + normalize + publish
**Constraints**: Must not block other providers during ingestion; must handle external source failures gracefully
**Scale/Scope**: 2-10 active providers, each polling every 1-6 hours; ~55 locations x 10 parameters per ingestion

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Hexagonal Architecture | PASS | 4 layers: api (controllers+DTOs), application (commands+queries+mappers), domain (entities+ports+VOs+errors), infrastructure (repos+services+parsers) |
| II. CQRS with MediatR | PASS | Controllers use CommandBus/CachingQueryBus. ProviderConfig CRUD and IngestionRun queries go through handlers. |
| III. Dependency Inversion via Ports | PASS | `IDataProvider`, `IProviderConfigRepository`, `IIngestionRunRepository` as abstract classes bound in infrastructure.module.ts |
| IV. Domain-Driven Validation | PASS | ProviderConfig and IngestionRun entities implement IValidable with validate(). Value objects for ProviderType, PollingInterval, BaseUrl. |
| V. Integration Testing | PASS | E2E tests via HTTP endpoints. Mock external HTTP calls (FEWS API, ms-sftp-api). Real Postgres via Testcontainers. |
| VI. Type Safety & Strictness | PASS | Full strict mode. Path aliases. No any. |
| VII. Structured Error Hierarchy | PASS | ProviderError for external source failures. RepositoryError for DB. EntityError for validation. ApiError for business rules (409 duplicate run). |

**Gate Result**: ALL PASS — no violations, no justifications needed.

## Project Structure

### Documentation (this feature)

```text
specs/002-data-provider-layer/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── rest-api.md      # REST endpoint contracts
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── main.ts
├── app.module.ts
├── app/
│   ├── api/
│   │   ├── controllers/
│   │   │   ├── provider-config.controller.ts
│   │   │   └── ingestion-run.controller.ts
│   │   └── dtos/
│   │       ├── provider-config.dtos.ts
│   │       └── ingestion-run.dtos.ts
│   │
│   ├── application/
│   │   ├── commands/
│   │   │   ├── provider-config.commands.ts      # Create, Update, Delete, Toggle, TriggerIngestion
│   │   │   └── ingestion.commands.ts            # ExecuteIngestion (internal, called by scheduler+trigger)
│   │   ├── queries/
│   │   │   ├── provider-config.queries.ts       # List, GetById
│   │   │   └── ingestion-run.queries.ts         # List (filterable by provider), GetById
│   │   ├── mappers/
│   │   │   ├── provider-config.mappers.ts
│   │   │   └── ingestion-run.mappers.ts
│   │   └── application.module.ts
│   │
│   ├── domain/
│   │   ├── entities/
│   │   │   ├── provider-config.entity.ts
│   │   │   └── ingestion-run.entity.ts
│   │   ├── value-objects/
│   │   │   ├── provider-type.value-object.ts    # FEWS_API | SFTP_FILE enum validation
│   │   │   ├── polling-interval.value-object.ts # min 5 minutes
│   │   │   └── base-url.value-object.ts         # URL format validation
│   │   ├── ports/
│   │   │   ├── provider-config-repository.port.ts
│   │   │   ├── ingestion-run-repository.port.ts
│   │   │   └── data-provider.port.ts            # IDataProvider abstract class
│   │   ├── errors/                              # (reuse existing hierarchy)
│   │   ├── results/
│   │   │   ├── provider-config.result.ts
│   │   │   ├── ingestion-run.result.ts
│   │   │   └── normalized-timeseries.result.ts  # Common format for parsed data
│   │   └── types/
│   │       ├── provider-type.enum.ts
│   │       └── ingestion-status.enum.ts
│   │
│   └── infrastructure/
│       ├── persistence/
│       │   ├── provider-config.repository.ts
│       │   └── ingestion-run.repository.ts
│       ├── services/
│       │   ├── fews-api-provider.service.ts     # IDataProvider impl for FEWS REST API
│       │   ├── sftp-file-provider.service.ts    # IDataProvider impl — calls ms-sftp-api, receives pre-parsed JSON, maps to NormalizedTimeSeries[]
│       │   ├── data-provider-factory.service.ts # Resolves IDataProvider by ProviderType
│       │   └── provider-scheduler.service.ts    # @nestjs/schedule CRON orchestrator
│       ├── cache/                               # (extend existing cache registry)
│       ├── messaging/                           # (extend existing messaging registry)
│       └── infrastructure.module.ts
│
├── configuration/
│   ├── fews-api/                                # FEWS_API_BASE_URL env config
│   │   ├── fews-api-config.module.ts
│   │   ├── fews-api-config.ts
│   │   ├── fews-api-config.service.ts
│   │   └── fews-api-config.type.ts
│   └── sftp-api/                                # SFTP_API_BASE_URL env config
│       ├── sftp-api-config.module.ts
│       ├── sftp-api-config.ts
│       ├── sftp-api-config.service.ts
│       └── sftp-api-config.type.ts
│
├── migrations/
│   └── XXXX-add-provider-configs-and-ingestion-runs.ts
│
test/
├── factories/
│   ├── provider-config.factory.ts
│   └── ingestion-run.factory.ts
└── modules/
    ├── provider-config/
    │   ├── create-provider-config.e2e-spec.ts
    │   ├── list-provider-configs.e2e-spec.ts
    │   └── trigger-ingestion.e2e-spec.ts
    └── ingestion-run/
        └── list-ingestion-runs.e2e-spec.ts
```

**Structure Decision**: Single NestJS microservice following established hexagonal architecture. New domains: `provider-config` (CRUD + trigger) and `ingestion-run` (read-only logs). Parsers are infrastructure services. Provider implementations behind `IDataProvider` port with factory pattern for type-based resolution.

## Complexity Tracking

No violations — no justifications needed.
