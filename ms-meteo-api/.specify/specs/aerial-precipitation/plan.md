# Plan: Aerial Precipitation Ingestion & Query

**Spec**: `.specify/specs/aerial-precipitation/spec.md`
**Created**: 2026-07-21
**Stack**: NestJS 11

---

## Summary

Adds a new `aerial-precipitation` module to `ms-meteo-api` that (a) polls a configured SFTP directory via the existing `ISftpFileClient`, ingests three flavors of FEWS-standard JSON (EPS, Harmonie, SAIH) into two new Postgres tables (`aerial_precipitation_series` + `aerial_precipitation_events`), (b) exposes three cached read endpoints (`GET /aerial-precipitation`, `.../latest`, `.../by-location/:id`) filterable by layer/provider/accumulation/location, and (c) runs a nightly retention cron. `ms-gateway-api` gains a matching passthrough. No changes to model-api or predictions-api. The ingest pipeline is idempotent by natural key `(locationId, parameterId, forecastDate)` and archives processed / failed files under `historial/`.

---

## Technical Context

| Aspect | Detail |
|--------|--------|
| Language / Version | TypeScript 5.7+ strict / NestJS 11 |
| Primary dependencies | `@nestjs/cqrs`, `@nestjs/schedule`, `@nestjs/axios`, `typeorm@0.3`, `class-validator`, `class-transformer`, `nestjs-pino`, `ioredis` (via CachingQueryBus), `tajo-toolkit` (trace context) |
| Storage | Postgres 16 on `infra-db-meteo:5441`, DB `ms_meteo`; two new tables + one migration |
| Cache | Redis 7 via `ICacheService` / `CachingQueryBus`; new keys under `aerial-precipitation:*` |
| External services | `ms-sftp-api` (HTTP `GET /files`, `GET /files/download`, `POST /files/move`) — via existing `ISftpFileClient` (extended with `move`) |
| Messaging | **Not used.** No publish/consume on RabbitMQ for this feature. |
| Scheduler | `@nestjs/schedule` — one `@Interval` (SFTP poll) + one `@Cron` (retention) |
| Testing | Jest + Supertest + `@testcontainers/postgresql`, HTTP-first e2e |
| Target environment | Docker Compose (`infra/docker-compose.apps.yml` `ms-meteo-api` service) |

Notes:
- `ScheduleModule.forRoot()` is already imported in `app.module.ts`.
- `ISftpFileClient` already exists with `listDirectory`, `readText`, `download`. Adds `move(source, destination, overwrite)` in this feature (implementation hits `POST /files/move` on ms-sftp-api — same endpoint model-api already uses).
- `MeteoIngestRun` entity is reused conceptually (audit log of every scheduled run: files processed, success/failure counts).

---

## Architecture

### High-level flow

```
┌───────────────────────────────────────────────────────────────────────┐
│                  Scheduler (@Interval, every N min)                   │
│                            │                                          │
│                            ▼                                          │
│   PollAerialPrecipitationCommand — application/commands              │
│                            │                                          │
│      ┌─────────────────────┼─────────────────────┐                    │
│      ▼                     ▼                     ▼                    │
│  ISftpFileClient    IAerialPrecipitationSeries   ICacheService        │
│  (list/download/    Repository (upsert)          (delByPattern at     │
│   move)                                           end of run)         │
└──┬───────────────────────────┬────────────────────────────────────────┘
   │                           │
   ▼                           ▼
sftp-api HTTP           Postgres — aerial_precipitation_series
(files/*)                          + aerial_precipitation_events
```

```
Read side (GET) — cached via CachingQueryBus
─────────────────────────────────────────────
Controller ──► Mapper.toQuery ──► CachingQueryBus.execute
                                     │  (cache hit? return)
                                     ▼
                                Query Handler ──► IAerialPrecipRepository ──► Postgres
                                     │
                                     ▼
                                Mapper.toResponseDto ──► HTTP JSON
```

### Layers touched

- **New in `ms-meteo-api`:**
  - `api/`: 1 controller (`aerial-precipitation.controller.ts`), request/response DTOs in `aerial-precipitation.dtos.ts`
  - `application/`: 2 commands (`aerial-precipitation.commands.ts`: `PollAerialPrecipitationCommand`, `PurgeOldAerialPrecipitationCommand`), 1 query file (`aerial-precipitation.queries.ts`: 3 queries + handlers), 1 mapper file, 2 scheduler services under `application/services/`
  - `domain/`: 2 entities (`aerial-precipitation-series.entity.ts`, `aerial-precipitation-event.entity.ts`), 1 port (`aerial-precipitation-series-repository.port.ts`), 2 value objects (`parameter-id.value-object.ts`, `location-id.value-object.ts`), 3 result classes, error extensions where needed
  - `infrastructure/`: 1 repository (`aerial-precipitation-series.repository.ts`), extension of `SftpFileClient` (add `move`), cache key constants in `cache-config.registry.ts`, DI bindings in `infrastructure.module.ts`
  - `configuration/`: new `aerial-precipitation-config` module (env vars)
  - `migrations/`: 1 new migration (`<timestamp>-create-aerial-precipitation.ts`) raw SQL
  - `test/`: factories + e2e specs
- **In `ms-gateway-api`:** new proxy controller `aerial-precipitation-proxy.controller.ts` + DTOs `aerial-precipitation-proxy.dtos.ts`

### Directory structure (files to create)

```
ms-meteo-api/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── controllers/
│   │   │   │   └── aerial-precipitation.controller.ts             # NEW
│   │   │   └── dtos/
│   │   │       └── aerial-precipitation.dtos.ts                   # NEW
│   │   ├── application/
│   │   │   ├── commands/
│   │   │   │   └── aerial-precipitation.commands.ts               # NEW (Poll + Purge)
│   │   │   ├── queries/
│   │   │   │   └── aerial-precipitation.queries.ts                # NEW (List/Latest/ByLocation)
│   │   │   ├── mappers/
│   │   │   │   └── aerial-precipitation.mappers.ts                # NEW
│   │   │   ├── services/
│   │   │   │   ├── aerial-precipitation-poller.scheduler.ts       # NEW  @Interval
│   │   │   │   └── aerial-precipitation-retention.scheduler.ts    # NEW  @Cron
│   │   │   └── application.module.ts                              # EDIT (register handlers + schedulers + controller)
│   │   ├── domain/
│   │   │   ├── entities/
│   │   │   │   ├── aerial-precipitation-series.entity.ts          # NEW
│   │   │   │   └── aerial-precipitation-event.entity.ts           # NEW
│   │   │   ├── ports/
│   │   │   │   ├── aerial-precipitation-series-repository.port.ts # NEW
│   │   │   │   └── sftp-file-client.port.ts                       # EDIT (add move method)
│   │   │   ├── value-objects/
│   │   │   │   ├── parameter-id.value-object.ts                   # NEW
│   │   │   │   └── location-id.value-object.ts                    # NEW
│   │   │   └── results/
│   │   │       ├── aerial-precipitation-series.result.ts          # NEW (list + latest results)
│   │   │       └── aerial-precipitation-ingest.result.ts          # NEW (poll run summary)
│   │   └── infrastructure/
│   │       ├── persistence/
│   │       │   └── aerial-precipitation-series.repository.ts      # NEW
│   │       ├── sftp/
│   │       │   └── sftp-file.client.ts                            # EDIT (impl move)
│   │       ├── cache/
│   │       │   └── cache-config.registry.ts                       # EDIT (AerialPrecipCacheKeys)
│   │       └── infrastructure.module.ts                           # EDIT (register entities + repo binding)
│   ├── configuration/
│   │   └── aerial-precipitation/
│   │       ├── aerial-precipitation-config.ts                     # NEW
│   │       ├── aerial-precipitation-config.module.ts              # NEW
│   │       └── aerial-precipitation-config.service.ts             # NEW
│   └── migrations/
│       └── <ts>-create-aerial-precipitation.ts                    # NEW
└── test/
    ├── factories/
    │   └── aerial-precipitation.factory.ts                        # NEW
    └── modules/aerial-precipitation/
        ├── ingest-aerial-precipitation.e2e-spec.ts                # NEW
        ├── list-aerial-precipitation.e2e-spec.ts                  # NEW
        ├── latest-aerial-precipitation.e2e-spec.ts                # NEW
        ├── by-location-aerial-precipitation.e2e-spec.ts           # NEW
        ├── purge-aerial-precipitation.e2e-spec.ts                 # NEW
        └── fixtures/
            ├── tagus_eps_Pareal_sample.json                       # NEW (trimmed)
            ├── tagus_harmonie_Pareal_sample.json                  # NEW
            └── tagus_saih_Pareal_sample.json                      # NEW

ms-gateway-api/
├── src/app/api/
│   ├── controllers/aerial-precipitation-proxy.controller.ts       # NEW
│   └── dtos/aerial-precipitation-proxy.dtos.ts                    # NEW
```

### Rules honored

- **Hexagonal** — new code cleanly split across the four layers.
- **CQRS** — writes (`Poll…`, `PurgeOld…`) via `CommandBus`; reads via `CachingQueryBus`.
- **Ports as abstract classes** — `IAerialPrecipitationSeriesRepository` is `abstract class`; `ISftpFileClient` was already one.
- **Value objects** — `ParameterIdValueObject` parses + normalizes case (`12H` → `12h`); `LocationIdValueObject` validates prefix belongs to one of the three layers.
- **Entities** — extend `BaseAuditEntity`, implement `IValidable`. Constructor takes `Partial<...>`. `validate()` is called by the command handler before persisting.
- **Controllers** — thin, `Mapper.toQuery → CachingQueryBus.execute → Mapper.toResponseDto`, standard try/catch (`EntityError → 400`, `ApiError → statusCode`, else 500).
- **Cache** — invalidated via `cacheService.delByPattern(AerialPrecipitationCacheKeys.pattern())` at the end of every ingest run that persisted at least one series.

---

## Data Model

See detail in [`data-model.md`](./data-model.md).

Two new tables:

- `aerial_precipitation_series` — one row per unique `(locationId, parameterId, forecastDate)`. Holds the FEWS header + derived parsed fields (`provider`, `layer`, `stat`, `accumulation`).
- `aerial_precipitation_events` — hourly events keyed by `(seriesId, eventDate)`, cascade-deleted with the parent series.

Migration is a single raw-SQL file registering both tables + all their indexes + foreign keys.

---

## API Contracts

See detail in [`contracts/api.md`](./contracts/api.md). Three new endpoints on `ms-meteo-api` (`:3010`), mirrored as passthrough on `ms-gateway-api` (`:3000`):

- `GET /aerial-precipitation` — filtered list (paginated).
- `GET /aerial-precipitation/latest` — one series per polygon (latest `forecastDate` per key).
- `GET /aerial-precipitation/by-location/:locationId` — all active series for one polygon.

All three accept `?includeEvents=true|false` (default `false`) — same "summary vs full" pattern we established for the manual-simulation results endpoint. Filters are case-insensitive where they logically should be (`locationId`, `parameterId` accumulation suffix).

Cache TTLs (constants in `cache-config.registry.ts`):

| Query | TTL |
|---|---|
| `ListAerialPrecipitationQuery` | 60s |
| `GetAerialPrecipitationLatestQuery` | 300s |
| `GetAerialPrecipitationByLocationQuery` | 60s |

Invalidation: `AerialPrecipitationCacheKeys.pattern() = 'aerial-precipitation:*'` — `delByPattern` at the end of a successful ingest run (i.e., ≥ 1 file processed with ≥ 1 series persisted).

---

## Events

**None.** This feature does not publish to or consume from RabbitMQ. All triggering is scheduler-driven.

`messaging.registry.ts` is not modified.

---

## Configuration

New env vars (loaded via `@nestjs/config` + `AerialPrecipitationConfigService`):

| Env var | Default | Purpose |
|---|---|---|
| `AERIAL_PRECIP_SFTP_DIRECTORY` | `tajo/pareal` | SFTP directory (relative to ms-sftp-api STORAGE_BASE_PATH) where the FEWS precipitation JSONs land |
| `AERIAL_PRECIP_POLL_INTERVAL_MS` | `300000` | How often the poller scheduler runs (5 min) |
| `AERIAL_PRECIP_FILE_PREFIXES` | `tagus_eps_Pareal_,tagus_harmonie_Pareal_,tagus_saih_Pareal_` | Comma-separated list of accepted file-name prefixes |
| `AERIAL_PRECIP_RETENTION_DAYS` | `30` | How many days of forecast snapshots to keep |
| `AERIAL_PRECIP_CLEANUP_CRON` | `0 3 * * *` | When to run the retention cleanup (daily 03:00 UTC) |
| `AERIAL_PRECIP_LIST_CACHE_TTL_SECONDS` | `60` | TTL for filtered list queries |
| `AERIAL_PRECIP_LATEST_CACHE_TTL_SECONDS` | `300` | TTL for the "latest per polygon" query |

The existing `SFTP_API_URL` (already in ms-meteo-api) is reused.

`.env.example` gets the seven new lines with commentary.

---

## Idempotence & Concurrency

- **Idempotent by natural key** `(locationId, parameterId, forecastDate)`: on ingest, the repository performs an `UPSERT` on the series row; then deletes all events of that series (cascade or explicit `DELETE FROM events WHERE seriesId = ?`) and re-inserts the fresh set from the file. Everything wrapped in one transaction.
- **Concurrency safety**: only one `@Interval` fires from the scheduler; if a run is still in-flight when the next tick occurs, the poller uses a Postgres advisory lock (`pg_try_advisory_lock(hashtext('aerial-precip-poll'))`) → if not acquired, that tick is skipped and logged. This matches the pattern documented in the repo (`meteo-ingest-run` currently records runs). No need for external distributed locks.

---

## File processing lifecycle

Per file discovered by `listDirectory(sftpDirectory)`:

1. If name does NOT start with one of the whitelisted prefixes OR does NOT end with `.json` → **skip silently**.
2. `readText(path)` → parse JSON. On JSON parse error → move to `historial/{basename}.failed.<epochMs>` and continue with next file.
3. Iterate `data.timeSeries[]`:
   - Parse `header.parameterId` with `ParameterIdValueObject`. On invalid pattern → log warning + skip that series.
   - Build `AerialPrecipitationSeries` entity with derived fields. Call `series.validate()`.
   - Build events, filtering out those where value is `missVal` OR flag indicates non-approved (only `flag === '2'` is kept).
   - Repository upserts.
4. If steps 3 completed without a fatal DB error → move source file to `historial/{basename}`.
5. If any step 3 error is fatal (e.g., DB constraint / connection lost mid-file): the file's transactional unit rolls back for the affected series, the file is moved to `historial/{basename}.failed.<epochMs>` with the reason in a sibling `.err.txt`.
6. After all files processed: if `persistedSeriesCount > 0` → `cacheService.delByPattern('aerial-precipitation:*')`.
7. Persist a summary row in `MeteoIngestRun` (reusing existing entity) with counts + timings.

---

## Retention cleanup

- `@Cron(AERIAL_PRECIP_CLEANUP_CRON)` → dispatch `PurgeOldAerialPrecipitationCommand({ cutoff: NOW - retentionDays })`.
- Handler executes `DELETE FROM aerial_precipitation_series WHERE forecastDate < :cutoff` — `aerial_precipitation_events` follows via `ON DELETE CASCADE`.
- Logs the count deleted. If count > 0, invalidates cache.

---

## Constitution Compliance

| Principle | Status | Notes |
|---|---|---|
| I. Hexagonal Architecture | ✅ | All new code separated into api/application/domain/infrastructure; domain has zero framework deps (VOs, entities, port). |
| II. CQRS with MediatR Pattern | ✅ | Writes via `CommandBus` (`Poll…`, `PurgeOld…`), reads via `CachingQueryBus`. Controllers do not touch repositories. |
| III. Dependency Inversion via Ports | ✅ | `IAerialPrecipitationSeriesRepository` is an abstract class, bound in `infrastructure.module.ts`. |
| IV. Domain-Driven Validation | ✅ | `ParameterIdValueObject` + `LocationIdValueObject` validate on construction. Entity `validate()` called explicitly by command handler before persist. |
| V. Integration Testing through Endpoints | ✅ | All e2e specs hit `/aerial-precipitation/*` via Supertest against a testcontainer Postgres. `ISftpFileClient` and `ICacheService` are the only mocks. |
| VI. Type Safety & Strictness | ✅ | Strict TS + `noImplicitAny` + `strictNullChecks`. |
| VII. Structured Error Hierarchy | ✅ | `RepositoryError` on DB failures, `ProviderError` on sftp-api failures, `EntityError` from VOs, `ApiError` for query-time not-found (`by-location/:id` when locationId format is invalid). |

No conflicts with the constitution.

---

## Open Questions

None. All ambiguities were resolved in `/speckit-clarify` (see spec.md `Last Updated: 2026-07-20`).

---

## Deployment considerations

- New migration MUST run on `infra-db-meteo` before the app can start with this feature. Follows the standard: `npm run migration:run:prod` invoked by the container entrypoint (already in place).
- No new infra services (no new Docker container, no new RabbitMQ queue).
- `.env.example` updated so operators know the new knobs.
- Gateway image and predictions-api are unchanged.
