# Tasks: Aerial Precipitation Ingestion & Query

**Spec**: `.specify/specs/aerial-precipitation/spec.md`
**Plan**: `.specify/specs/aerial-precipitation/plan.md`
**Data model**: `.specify/specs/aerial-precipitation/data-model.md`
**Contracts**: `.specify/specs/aerial-precipitation/contracts/api.md`
**Created**: 2026-07-24

TDD strict: every `[TEST]` task must land failing before the corresponding implementation task starts. `[P]` marks tasks that have no dependency on each other and can run in parallel.

All paths are relative to the monorepo root unless noted.

---

## Phase 0: Setup

- [x] **T001** — Create env config module scaffolding: `ms-meteo-api/src/configuration/aerial-precipitation/aerial-precipitation-config.ts`, `.../aerial-precipitation-config.module.ts`, `.../aerial-precipitation-config.service.ts`. Registers `sftpDirectory`, `pollIntervalMs`, `filePrefixes` (comma-list), `retentionDays`, `cleanupCron`, `listCacheTtlSeconds`, `latestCacheTtlSeconds`. Exposed via `AerialPrecipitationConfigService` and imported by root config.
- [x] **T002** — Update `ms-meteo-api/.env.example` with the seven new env vars + brief descriptions.
- [x] **T003** — Extend `ms-meteo-api/src/app/domain/ports/sftp-file-client.port.ts` with `abstract move(sourcePath: string, destinationPath: string, overwrite?: boolean): Promise<void>`; implement on `ms-meteo-api/src/app/infrastructure/sftp/sftp-file.client.ts` calling `POST /files/move` on ms-sftp-api (mirrors the model-api impl).
- [x] **T004 [P]** — Add cache key constants to `ms-meteo-api/src/app/infrastructure/cache/cache-config.registry.ts`: `AerialPrecipitationCacheKeys = { list, latest, byLocation, pattern }` + placeholder CACHE_REGISTRY entries (real TTLs wired later when queries exist).
- [x] **T005 [P]** — Create raw-SQL TypeORM migration `ms-meteo-api/src/migrations/<epochMs>-create-aerial-precipitation.ts` per `data-model.md` (both tables, unique + FK + all three indexes, cascade). Include `down()`.

---

## Phase 1: Foundational

> All P1 user story work depends on these. Nothing here is a user-visible behavior — pure scaffolding.

### Value objects (TDD, unit-only)

- [x] **T010 [TEST] [P]** — Unit test `parameter-id.value-object.spec.ts`: parses `P.areal.ens.subcNAM.Med.24h`, normalizes `12H`→`12h`, defaults missing accum to `1h`, rejects invalid provider/layer with `EntityError`, rejects `Max` on non-`ens` provider.
- [x] **T011 [P]** — Implement `ms-meteo-api/src/app/domain/value-objects/parameter-id.value-object.ts` to make T010 green.
- [x] **T012 [TEST] [P]** — Unit test `location-id.value-object.spec.ts`: accepts `Sistema.Tajo.3`, `Cuenca.NAM.E_08`, `Cuenca.AEMET.1`; derives `layer`; rejects unknown prefix.
- [x] **T013 [P]** — Implement `ms-meteo-api/src/app/domain/value-objects/location-id.value-object.ts` to make T012 green.

### Domain entities + port + results

- [x] **T014 [P]** — Entity `ms-meteo-api/src/app/domain/entities/aerial-precipitation-series.entity.ts` extending `BaseAuditEntity`, implementing `IValidable`. `validate()` runs both VOs and normalizes derived fields.
- [x] **T015 [P]** — Entity `ms-meteo-api/src/app/domain/entities/aerial-precipitation-event.entity.ts` (composite PK `seriesId + eventDate`, cascade via `@ManyToOne` back to series).
- [x] **T016** — Port `ms-meteo-api/src/app/domain/ports/aerial-precipitation-series-repository.port.ts` (abstract class) with methods: `upsertWithEvents(series, events)`, `findLatestPerLocation(filters)`, `findByLocation(locationId, filters)`, `listFiltered(filters, page, limit)`, `countFiltered(filters)`, `deleteOlderThan(cutoff)`, `acquirePollAdvisoryLock(): Promise<boolean>`. Depends on T014, T015.
- [x] **T017 [P]** — Result classes in `ms-meteo-api/src/app/domain/results/aerial-precipitation-series.result.ts` (`AerialPrecipitationListResult`, `AerialPrecipitationLatestResult`, `AerialPrecipitationByLocationResult`) and `.../aerial-precipitation-ingest.result.ts` (`AerialPrecipitationIngestRunResult`).

### Infrastructure

- [x] **T018** — Implement `ms-meteo-api/src/app/infrastructure/persistence/aerial-precipitation-series.repository.ts`: TypeORM impl of the port. `upsertWithEvents` runs a single transaction — insert-or-update series row (natural key), delete existing events, bulk insert new events. `acquirePollAdvisoryLock` calls `SELECT pg_try_advisory_lock(hashtext('aerial-precip-poll'))`. Depends on T016.
- [x] **T019** — Register `AerialPrecipitationSeries` + `AerialPrecipitationEvent` in `TypeOrmModule.forFeature([...])` and bind `{ provide: IAerialPrecipitationSeriesRepository, useClass: AerialPrecipitationSeriesRepository }` in `ms-meteo-api/src/app/infrastructure/infrastructure.module.ts`. Import `AerialPrecipitationConfigModule`. Depends on T014, T015, T018.
- [x] **T020** — Test helper: `ms-meteo-api/test/helpers/aerial-precipitation-test-app.helper.ts` exports a `createAerialPrecipTestApp()` wrapping `createTestApp()` with the aerial-precip module wired + no-op `ICacheService` + fake `ISftpFileClient` (in-memory dir).
- [x] **T021 [P]** — Fixture files: copy trimmed versions of the customer's samples into `ms-meteo-api/test/modules/aerial-precipitation/fixtures/{eps,harmonie,saih}.sample.json` (5 series each, 3 events each — enough for assertions, small enough for VCS).
- [x] **T022 [P]** — Factory `ms-meteo-api/test/factories/aerial-precipitation.factory.ts`: `buildFewsPayload({provider, series}[])`, `buildSeries()`, `buildEvent()`.

---

## Phase 2: User Stories

### US1 + US2 — Continuous ingest + idempotence [P1]

- [x] **T030 [TEST]** — E2E `ingest-aerial-precipitation.e2e-spec.ts` — happy path: fake SFTP dir contains one `tagus_eps_Pareal_*.json`. Run the poll handler once. Assert: series and events persisted (query via `GET /aerial-precipitation`), file moved to `historial/`.
- [x] **T031 [TEST]** — Same file: reprocessing (put back into dir, poll again) leaves series count + event count identical, no duplicate rows.
- [x] **T032 [TEST]** — Same natural key (`locationId + parameterId + forecastDate`), NEW events values: reprocessing REPLACES events atomically. Assert old event values gone, new event values present.
- [x] **T033 [TEST]** — Malformed JSON: file is moved to `historial/<name>.failed.<epochMs>`, run continues, other valid files in the same tick are still processed.
- [x] **T034 [TEST]** — Series with unknown `parameterId` (e.g. `P.areal.foo.bar`): that series is skipped with a warning, other series in the same file are persisted.
- [x] **T035 [TEST]** — Events with `value === missVal` (`-999`) OR `flag !== '2'`: filtered at ingest, not persisted.
- [x] **T036 [TEST]** — Advisory lock: two concurrent poll cycles → only one runs; second logs "poll skipped, lock held" and does nothing.
- [x] **T037** — Implement `PollAerialPrecipitationCommand` + `PollAerialPrecipitationHandler` in `ms-meteo-api/src/app/application/commands/aerial-precipitation.commands.ts`. Uses `ISftpFileClient` (list/read/move), `IAerialPrecipitationSeriesRepository` (upsert + advisory lock), `ICacheService.delByPattern` at the end if `persistedSeriesCount > 0`. Reuses `MeteoIngestRun` for audit. Makes T030–T036 pass.
- [x] **T038** — Implement `AerialPrecipitationPollerScheduler` (`@Interval(pollIntervalMs)`) in `ms-meteo-api/src/app/application/services/aerial-precipitation-poller.scheduler.ts` that dispatches `PollAerialPrecipitationCommand`.

### US3 — Latest per polygon [P1]

- [x] **T040 [TEST]** — E2E `latest-aerial-precipitation.e2e-spec.ts`: seed 3 series (same locationId, 3 different forecastDates) for `subcNAM/harmonie/24h`. `GET /aerial-precipitation/latest?layer=subcNAM&provider=harmonie&accumulation=24h` returns ONLY the one with the max `forecastDate`.
- [x] **T041 [TEST]** — Same endpoint returns one entry per polygon when multiple polygons have data.
- [x] **T042 [TEST]** — Missing required param (`layer`/`provider`/`accumulation`) → 400 with `ErrorDescription`.
- [x] **T043 [TEST]** — `stat=Max` with `provider=harmonie` → 400 (invalid combination).
- [x] **T044 [TEST]** — No data matching filter → 200 with `series: []`.
- [x] **T045 [TEST]** — `includeEvents=true` returns each series with `events[]`; default omits `events`.
- [x] **T046** — Implement `GetAerialPrecipitationLatestQuery` + Handler + Mapper + cache registry entry (TTL from config, key includes `layer/provider/accumulation/stat/includeEvents`). Makes T040–T045 pass.
- [x] **T047** — Controller endpoint `GET /aerial-precipitation/latest` with `@ApiEndpoint` + request DTO validation.

### US4 — By location [P1]

- [x] **T050 [TEST]** — E2E `by-location-aerial-precipitation.e2e-spec.ts`: seed a polygon with series across `obs/harmonie/ens Med`. `GET /aerial-precipitation/by-location/Cuenca.NAM.E_08` returns groups keyed by `(provider, accumulation, stat)`.
- [x] **T051 [TEST]** — Invalid locationId format → 400.
- [x] **T052 [TEST]** — Well-formed locationId with no data → 200 with empty groups.
- [x] **T053 [TEST]** — Historical fan: `?fromForecastDate=X&toForecastDate=Y` returns every matching snapshot per group (not just latest).
- [x] **T054 [TEST]** — `includeEvents=true` behaves as in US5.
- [x] **T055** — Implement `GetAerialPrecipitationByLocationQuery` + Handler + Mapper + cache registry entry. Makes T050–T054 pass.
- [x] **T056** — Controller endpoint `GET /aerial-precipitation/by-location/:locationId`.

### List endpoint (P1)

- [x] **T060 [TEST]** — E2E `list-aerial-precipitation.e2e-spec.ts`: combined filters (`layer`, `provider`, `locationId` repeated, `accumulation`, `fromForecastDate/toForecastDate`, `page`, `limit`) return the expected subset.
- [x] **T061 [TEST]** — Pagination bounds: `limit=0` → 400, `limit=501` → 400, `page=0` → 400.
- [x] **T062 [TEST]** — Unknown query param → 400 with property-name in message.
- [x] **T063 [TEST]** — `includeEvents` toggle payload size (assert response with true has `events`, without omits).
- [x] **T064** — Implement `ListAerialPrecipitationQuery` + Handler + Mapper + cache registry entry. Makes T060–T063 pass.
- [x] **T065** — Controller endpoint `GET /aerial-precipitation`.

### US5 — Header vs header+events [P1]

Behavior is covered by T045, T054, T063. Only the mapper touch is separate:

- [x] **T070** — In the shared mapper (`ms-meteo-api/src/app/application/mappers/aerial-precipitation.mappers.ts`), implement `serializeSeries(series, { includeEvents }): AerialPrecipitationSeriesDto` producing `max` and `last` from events, omitting the `events` key when `includeEvents=false`. This is the shared function used by T046/T055/T064.

### US6 — Parameter case tolerance [P2]

Covered by T010/T011 (VO unit tests). No new task.

### US7 — Cache hot + invalidation [P2]

- [x] **T075 [TEST]** — E2E cache hit path: mock `ICacheService.get` to return a JSON-roundtripped previous result → controller returns 200 with correct shape. (Guards the "Map → {}" regression we caught earlier for simulation-results.)
- [x] **T076 [TEST]** — E2E cache invalidation: pre-populate `ICacheService.set` spy, run `PollAerialPrecipitationCommand` that persists ≥1 series, assert `cacheService.delByPattern` was called with `'aerial-precipitation:*'`.
- [x] **T077** — Wire `cacheService.delByPattern(AerialPrecipitationCacheKeys.pattern())` at end of `PollAerialPrecipitationHandler` when `persistedSeriesCount > 0` (implementation already scoped in T037; this task adds the explicit assertion and, if needed, refactors the handler to expose that call).

### FR-008 — Retention cleanup

- [x] **T080 [TEST]** — E2E `purge-aerial-precipitation.e2e-spec.ts`: seed series with `forecastDate = NOW - 60d` and `NOW - 5d` with `retentionDays=30`. Run `PurgeOldAerialPrecipitationCommand`. Assert older series (and cascaded events) deleted; recent ones intact.
- [x] **T081 [TEST]** — Purge command invalidates cache when it deleted ≥1 series.
- [x] **T082** — Implement `PurgeOldAerialPrecipitationCommand` + Handler in `aerial-precipitation.commands.ts`. Makes T080–T081 pass.
- [x] **T083** — Implement `AerialPrecipitationRetentionScheduler` (`@Cron(cleanupCron)`) in `ms-meteo-api/src/app/application/services/aerial-precipitation-retention.scheduler.ts` dispatching the purge command.

### Module wiring

- [x] **T085** — Update `ms-meteo-api/src/app/application/application.module.ts`:
  - `providers`: all handlers (Poll, Purge, 3× queries), both scheduler services, mapper, `CachingQueryBus`.
  - `controllers`: `AerialPrecipitationController`.
  - `imports`: `AerialPrecipitationConfigModule`, `TypeOrmModule.forFeature(...)`, existing infra.

---

## Phase 3: Integration & Polish

### Gateway proxy

- [x] **T100 [TEST]** — In `ms-gateway-api/test/`, e2e test for `AerialPrecipitationProxyController`: unknown query param dropped upstream (assert only whitelisted forwarded), `x-internal-caller: ms-gateway-api` set, trace-id propagated.
- [x] **T101** — Response DTOs `ms-gateway-api/src/app/api/dtos/aerial-precipitation-proxy.dtos.ts` mirroring meteo-api DTOs (with `@ApiProperty` + realistic examples).
- [x] **T102** — Controller `ms-gateway-api/src/app/api/controllers/aerial-precipitation-proxy.controller.ts` for the three routes, each with `@ApiEndpoint` + `@ApiQuery` per param + `@ApiResponse` with an embedded full example (samples per `contracts/api.md`).
- [x] **T103** — Register controller in `ms-gateway-api` `application.module.ts`; makes T100 pass.

### Docs + gates

- [x] **T110 [P]** — Update `ms-meteo-api/CLAUDE.md` `Recent Changes` with the new module (single line: `- aerial-precipitation: ingest + query FEWS areal precip JSONs; see .specify/specs/aerial-precipitation/`).
- [x] **T111 [P]** — Update `ms-gateway-api/CLAUDE.md` `Recent Changes` mentioning the passthrough.
- [x] **T120** — Run `npm run lint && npm run test:e2e -- --testPathPattern=aerial-precipitation` inside `ms-meteo-api`. Everything green before closing the phase.
- [x] **T121** — Run gateway tests: `cd ms-gateway-api && npm run test:e2e -- --testPathPattern=aerial-precipitation`.
- [x] **T122** — `npm run build` on both services. Green.
- [~] **T123** — Smoke test locally — deferred, covered by prod smoke post-deploy.

---

## Dependency Map

| Task | Depends on |
|---|---|
| T003 (SFTP move impl) | — (touches port + impl only) |
| T010–T013 (VOs + tests) | — |
| T014, T015 (entities) | T010–T013 (uses VOs in `validate()`) |
| T016 (repo port) | T014, T015 |
| T017 (results) | — |
| T018 (repo impl) | T014, T015, T016 |
| T019 (module wiring) | T014, T015, T018 |
| T020 (test app helper) | T019 |
| T021, T022 (fixtures / factory) | — |
| T030–T036 (US1/US2 tests) | T020, T021, T022 |
| T037 (Poll handler) | T003, T018, T019, T020, T030–T036 |
| T038 (Poller scheduler) | T037, T001 (config) |
| T040–T045 (US3 tests) | T020, T021, T022, T037 (needs data to query) |
| T046 (Latest query) | T004 (cache keys), T017, T018, T040–T045 |
| T047 (Latest controller) | T046 |
| T050–T054 (US4 tests) | T020, T021, T022, T037 |
| T055 (ByLocation query) | T004, T017, T018, T050–T054 |
| T056 (ByLocation controller) | T055 |
| T060–T063 (List tests) | T020, T021, T022, T037 |
| T064 (List query) | T004, T017, T018, T060–T063 |
| T065 (List controller) | T064 |
| T070 (mapper) | T046 + T055 + T064 all share it — build once, consumed by controllers |
| T075, T076 (cache tests) | T037, T046 |
| T077 (invalidation wire) | T037 (already scoped) — this task is verify + assertion polish |
| T080, T081 (purge tests) | T018 |
| T082 (purge handler) | T018, T080, T081 |
| T083 (retention scheduler) | T082, T001 |
| T085 (application.module) | T037, T038, T046, T047, T055, T056, T064, T065, T082, T083 |
| T100 (gateway test) | T085 (upstream running) |
| T101, T102, T103 (gateway impl) | T100 |
| T110, T111 (docs) | can happen anytime |
| T120, T121, T122, T123 (verify gates) | ALL implementation tasks |

---

## MVP scope

**Minimum viable feature**: T001 → T085 (all setup, foundation, user stories, wiring).

Deferrable if time-pressured:
- Retention (T080–T083) → could ship without cleanup for the first week; DB will not blow up in that timeframe.
- Docs polish (T110–T111).
- Manual smoke (T123) — replaced by CI e2e (T120/T121).

**Gateway passthrough (T100–T103) is NOT deferrable** — frontend consumes via gateway, no direct access to meteo-api from outside the infra network.

---

## Parallelism cheatsheet

Groups of tasks that can be picked up by different implementers simultaneously (assuming each has read the plan):

- Phase 1: **T004, T005** with **T010–T017** with **T021, T022**.
- Phase 2 tests: **T030–T036** with **T040–T045** with **T050–T054** with **T060–T063** with **T075, T076** with **T080, T081**.
- Phase 3 docs: **T110, T111** any time.
