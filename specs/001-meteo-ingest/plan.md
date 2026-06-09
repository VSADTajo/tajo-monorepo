# Implementation Plan: Meteo Data Ingestion to GeoServer

**Branch**: `001-meteo-ingest` | **Date**: 2026-04-06 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-meteo-ingest/spec.md`

## Summary

Build `ms-meteo-api`, a new NestJS microservice in the North Labs platform that continuously ingests meteorological raster data deposited by external providers (RADAR, HARMONIE, EPS, SAIH) into the SFTP storage and publishes it as time-aware ImageMosaic layers in the existing GeoServer instance, so that the Vue frontend and downstream services can consume forecasts and observations through standard OGC services (WMS, WCS).

The service exposes two HTTP endpoints — `GET /meteo/info` (metadata) and `POST /meteo/sync` (manual trigger) — both accepting the same optional `?provider=...&variable=...` filters so the same handler covers "all", "by provider" and "by dataset" use cases. It also runs an automatic cron worker (default every 3 hours) that:

1. Discovers `(provider, variable)` datasets dynamically by listing the meteo storage tree via `ms-sftp-api` HTTP endpoints (no volume mount).
2. Reads each dataset's `info.json` and computes the expected timestamps (`fecha_inicio + step * paso_de_tiempo`).
3. Diffs against the granules already published in GeoServer for the corresponding layer.
4. Downloads only the missing files via `ms-sftp-api`, converts ESRI ASCII Grid → GeoTIFF with `gdal_translate`, drops them in `/opt/datasets/meteo/<provider>_<variable>/` (bind-mounted to GeoServer), and publishes each as a granule of an ImageMosaic store with TIME dimension in workspace `tajo`.
5. The first time a dataset is seen, the corresponding ImageMosaic store + layer is bootstrapped automatically.

A second daily cron purges granules older than `METEO_RETENTION_DAYS` (default 7) so storage stays bounded. Every run records an audit row in `meteo_ingest_run`. Idempotency is achieved by treating GeoServer as the source of truth for "what is published"; if anything fails, the next cycle reprocesses only the missing items.

## Technical Context

**Language/Version**: TypeScript 5.7+ (strict) on Node.js >= 22
**Primary Dependencies**: NestJS 11, @nestjs/cqrs 11, @nestjs/schedule 4, TypeORM 0.3, class-validator, class-transformer, nestjs-pino, ioredis, pg, axios, swagger
**External Tools**: `gdal-bin` (provides `gdal_translate`) installed in the container image
**Storage**: PostgreSQL 16 (own database `ms_meteo` on `infra-db-meteo`) for the audit table; Redis 7 (existing `infra-redis`) for short-lived caching of metadata responses
**External Services**: `ms-sftp-api` (HTTP, internal-caller header), GeoServer 2.24.2 REST API (basic auth, workspace `tajo`)
**Filesystem**: Bind mount `/opt/geoserver/datasets` (host) → `/opt/datasets` (container). The service writes generated GeoTIFFs under `/opt/datasets/meteo/<provider>_<variable>/`.
**Testing**: Jest + Supertest + Testcontainers (real Postgres for repository/audit tests, mocked HTTP clients for sftp-api and GeoServer REST, mocked GDAL adapter)
**Target Platform**: Linux container (node:22-alpine + apk gdal). Deployed via Jenkins Docker run on the existing Hetzner VM, joined to `infra-network`.
**Project Type**: Single project (NestJS microservice, hexagonal layers).
**Performance Goals**: Metadata endpoints < 1s p95 (cached). Full sync of all current datasets (≈13 variables × 48 files) under 5 minutes on a cold cycle. No-op cycles (nothing to do) under 5 seconds total.
**Constraints**: Service MUST NOT mount the SFTP volume. Service MUST NOT delete files from the SFTP. Service MUST NOT serve raster pixels. Service MUST be safe under concurrent triggers (cron + manual). Hexagonal + CQRS as per project constitution.
**Scale/Scope**: Currently 4 providers, ~13 datasets (provider/variable combinations), ~48 hourly time steps per dataset, ~1MB per raster after compression → ~620 MB peak per full forecast set, ~4.5 GB total under 7-day retention.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|---|---|---|
| I. Hexagonal Architecture | ✅ Pass | New `meteo` module respects `api / application / domain / infrastructure` layering. The SFTP HTTP client, GDAL invoker, GeoServer REST client and audit repository are all infrastructure adapters bound to domain ports. |
| II. CQRS with MediatR Pattern | ✅ Pass | The metadata endpoint dispatches a single `MeteoInfoQuery({ provider?, variable? })`. The sync endpoint and the cron dispatch a single `SyncMeteoCommand({ provider?, variable?, triggeredBy })`. The retention task dispatches `PurgeMeteoGranulesCommand`. |
| III. Dependency Inversion via Ports | ✅ Pass | New domain ports: `ISftpFileClient`, `IGeoserverImageMosaicClient`, `IRasterConverter`, `IMeteoIngestRunRepository`. All bound in `infrastructure.module.ts`. No infrastructure imports from application/domain. |
| IV. Domain-Driven Validation | ✅ Pass | New value objects: `ProviderName`, `VariableName`, `MeteoInfoJson` (validates schema, parses dates, computes timestamps). `MeteoIngestRun` entity has `validate()` and business methods (`markCompleted`, `markFailed`, `markNoop`). |
| V. Integration Testing through Endpoints | ✅ Pass | E2E tests will exercise `/meteo/info` and `/meteo/sync` endpoints with real Postgres (Testcontainers). External HTTP services (`ms-sftp-api`, GeoServer REST) and the GDAL adapter are mocked because they are external systems, not the database. |
| VI. Type Safety & Strictness | ✅ Pass | Inherited from scaffolding: `strict: true`, path aliases, no `any`. |
| VII. Structured Error Hierarchy | ✅ Pass | New errors reuse the existing hierarchy: `ProviderError` for sftp-api/GeoServer/GDAL failures, `EntityError` for invalid `info.json`, `ApiError` for not-found provider/variable in metadata endpoints. |

**Result**: GATE PASSES. No deviations require justification.

## Project Structure

### Documentation (this feature)

```text
specs/001-meteo-ingest/
├── spec.md              # ✅ done
├── plan.md              # this file
├── research.md          # Phase 0 — technical research and decisions
├── data-model.md        # Phase 1 — entities, value objects, schema
├── quickstart.md        # Phase 1 — local dev quickstart
├── contracts/
│   ├── http-api.md      # Public HTTP contract of ms-meteo-api
│   ├── sftp-api.md      # HTTP contract consumed from ms-sftp-api
│   └── geoserver-rest.md # GeoServer REST endpoints used
├── checklists/
│   └── requirements.md  # ✅ done
└── tasks.md             # Phase 2 — generated by /speckit.tasks
```

### Source Code (ms-meteo-api repository)

```text
ms-meteo-api/
├── Dockerfile                              # add gdal-bin install in dev/build/prod stages
├── Jenkinsfile                             # already configured (port 3010, infra-db-meteo)
├── docker-compose.yml                      # local dev (already configured)
├── package.json                            # add @nestjs/schedule
├── .env.example                            # already configured
├── src/
│   ├── main.ts                             # bootstrap (unchanged)
│   ├── app.module.ts                       # imports MeteoModule (new)
│   ├── app/
│   │   ├── api/
│   │   │   ├── controllers/
│   │   │   │   └── meteo.controller.ts     # 2 endpoints (GET /info, POST /sync) with optional filters
│   │   │   └── dtos/
│   │   │       └── meteo.dtos.ts           # request/response DTOs
│   │   ├── application/
│   │   │   ├── application.module.ts       # registers handlers + controller
│   │   │   ├── commands/
│   │   │   │   └── meteo.commands.ts       # SyncMeteo, PurgeMeteoGranules
│   │   │   ├── queries/
│   │   │   │   └── meteo.queries.ts        # MeteoInfo (with optional provider/variable filters)
│   │   │   └── mappers/
│   │   │       └── meteo.mappers.ts        # DTO ↔ Command/Query/Result
│   │   ├── domain/
│   │   │   ├── entities/
│   │   │   │   └── meteo-ingest-run.entity.ts
│   │   │   ├── value-objects/
│   │   │   │   ├── provider-name.value-object.ts
│   │   │   │   ├── variable-name.value-object.ts
│   │   │   │   └── meteo-info-json.value-object.ts
│   │   │   ├── ports/
│   │   │   │   ├── sftp-file-client.port.ts
│   │   │   │   ├── geoserver-image-mosaic-client.port.ts
│   │   │   │   ├── raster-converter.port.ts
│   │   │   │   └── meteo-ingest-run-repository.port.ts
│   │   │   ├── results/
│   │   │   │   └── meteo.results.ts        # MeteoInfoResult, SyncResult
│   │   │   ├── errors/                     # reuses existing hierarchy
│   │   │   └── types/
│   │   │       ├── meteo-provider.enum.ts
│   │   │       └── ingest-status.enum.ts
│   │   └── infrastructure/
│   │       ├── infrastructure.module.ts    # registers new ports/impls
│   │       ├── persistence/
│   │       │   └── meteo-ingest-run.repository.ts
│   │       ├── sftp/
│   │       │   └── sftp-file.client.ts     # axios → ms-sftp-api
│   │       ├── geoserver/
│   │       │   ├── geoserver-image-mosaic.client.ts  # axios → GeoServer REST
│   │       │   └── image-mosaic-bootstrap.ts          # creates store/layer first time
│   │       ├── gdal/
│   │       │   └── gdal-raster-converter.ts          # spawns gdal_translate
│   │       └── scheduling/
│   │           └── meteo-sync.scheduler.ts           # @nestjs/schedule cron
│   ├── migrations/
│   │   └── XXXXXXXXXXXXX-create-meteo-ingest-run.ts
│   ├── configuration/
│   │   ├── meteo/
│   │   │   ├── meteo-config.module.ts
│   │   │   ├── meteo-config.service.ts
│   │   │   ├── meteo-config.type.ts
│   │   │   └── meteo-config.ts             # loads SFTP_API_URL, GEOSERVER_URL, METEO_*
│   │   └── configuration.type.ts           # add 'meteo': MeteoConfig
│   └── ...                                 # rest unchanged from scaffold
└── test/
    ├── factories/
    │   └── meteo-info-json.factory.ts
    ├── helpers/
    │   ├── sftp-api.mock.ts
    │   ├── geoserver-rest.mock.ts
    │   └── gdal.mock.ts
    └── modules/
        └── meteo/
            ├── get-meteo-info.e2e-spec.ts
            ├── sync-meteo-variable.e2e-spec.ts
            ├── sync-all-meteo.e2e-spec.ts
            └── purge-meteo-granules.e2e-spec.ts
```

**Structure Decision**: Single-project NestJS service following the platform's hexagonal + CQRS convention. One feature module (`meteo`) bundles all the new code; everything else inherited from the scaffold remains untouched. Cross-cutting infrastructure (cache, messaging, logging) reused as-is.

### Cross-repo changes (also covered by `/speckit.tasks`)

| Repo | Change | Reason |
|---|---|---|
| `ms-sftp-api` | Add `ms-meteo-api` to client whitelist; add `GET /files/read?path=...` endpoint | This service needs to read text contents (`info.json`) over HTTP without `Content-Disposition: attachment`. |
| `infra` | New service `ms-meteo-api` in `docker-compose.apps.yml` with bind `/opt/geoserver/datasets:/opt/datasets:rw` | Container needs write access to the GeoTIFF directory that GeoServer already serves. |
| `infra` | New DB `infra-db-meteo` (Postgres 16) in `docker-compose.yml` (port 5440) | One database per microservice (project convention). |
| `infra` | New Jenkins multibranch pipeline entry in `jenkins/casc.yaml` | Same pattern as the existing 8 services. |
| `ms-gateway-api` | New `meteo-proxy.controller.ts` exposing `GET /meteo/info` and `POST /meteo/sync` (with the same optional `provider`/`variable` query params), proxying to `ms-meteo-api:3010` | External clients enter through the gateway. |

## Complexity Tracking

> No constitution violations. This section is empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| — | — | — |
