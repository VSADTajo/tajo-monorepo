# Tasks: Meteo Data Ingestion to GeoServer

**Input**: Design documents from `/specs/001-meteo-ingest/`
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: REQUIRED. The platform constitution (Principle V — Integration Testing through Endpoints) makes e2e tests through HTTP endpoints with real Postgres (Testcontainers) mandatory for every feature. Test tasks are therefore included for every user story.

**Organization**: Tasks are grouped by user story so each story can be implemented, tested and demoed independently. User stories follow the priorities defined in [spec.md](./spec.md): US1, US2, US3 are P1 (MVP); US4, US5 are P2; US6 is P3.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel with other [P] tasks in the same phase (different files, no shared dependencies inside the phase)
- **[Story]**: User story this task belongs to (US1..US6). Setup / Foundational / Polish phases have no story label.
- All file paths are absolute or rooted at the relevant repo root.

## Path Conventions

- `ms-meteo-api/` — new microservice, NestJS hexagonal layout (`src/app/{api,application,domain,infrastructure}`)
- `ms-sftp-api/` — sibling repo, only the whitelist + the new `GET /files/read` endpoint are touched
- `ms-gateway-api/` — sibling repo, only the new `meteo-proxy.controller.ts`
- `infra/` — root of this monorepo, `docker-compose.*.yml` + `jenkins/casc.yaml`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project bootstrap. The hexagonal scaffolding already exists from the spec preparation phase; this phase wires the meteo-specific configuration and dependencies.

- [X] T001 Add `@nestjs/schedule@^4` to `ms-meteo-api/package.json` dependencies and run `npm install` to refresh `package-lock.json`.
- [X] T002 Add `gdal-bin` to all three stages (`dev`, `build`, `prod`) of `ms-meteo-api/Dockerfile` via `apk add --no-cache gdal` after the existing `apk add libc6-compat` line, so `gdal_translate` is available at runtime.
- [X] T003 [P] Create `ms-meteo-api/src/configuration/meteo/meteo-config.type.ts` defining the `MeteoConfig` type (sftpApiUrl, sftpApiInternalCaller, meteoBasePath, geoserverUrl, geoserverUser, geoserverPassword, geoserverWorkspace, meteoGeotiffDir, meteoSyncCron, meteoRetentionCron, meteoRetentionDays, meteoIngestConcurrency).
- [X] T004 [P] Create `ms-meteo-api/src/configuration/meteo/meteo-config.ts` with the joi/class-validator schema and default values matching `.env.example` (defaults: cron `0 */3 * * *`, retentionDays 7, concurrency 4).
- [X] T005 [P] Create `ms-meteo-api/src/configuration/meteo/meteo-config.service.ts` exposing typed getters.
- [X] T006 [P] Create `ms-meteo-api/src/configuration/meteo/meteo-config.module.ts` registering `meteo-config.ts` as a `ConfigModule.forFeature` and exporting the service.
- [X] T007 Update `ms-meteo-api/src/configuration/configuration.type.ts` to add `'meteo': MeteoConfig` to the `AllConfig` type.
- [X] T008 Add `ScheduleModule.forRoot()` to `ms-meteo-api/src/app.module.ts` `imports` and import the new `MeteoModule` (placeholder, will be created in Foundational phase).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: All work that every user story depends on. After this phase the SFTP can be read, the audit table exists, and the meteo module skeleton is wired.

**⚠️ CRITICAL**: No user-story phase may begin until this phase is complete.

### Cross-repo prerequisite: ms-sftp-api

- [X] T009 Add `'ms-meteo-api'` to the `ALLOWED_CALLERS` list in `ms-sftp-api/src/app/api/middlewares/client-whitelist.middleware.ts`.
- [X] T010 Implement `ReadFileTextQuery` + `ReadFileTextHandler` in `ms-sftp-api/src/app/application/queries/file.queries.ts` (mirror `DownloadFileHandler` but read text up to 1 MB and return `{ path, size, modifiedAt, content }`).
- [X] T011 Add `ReadFileTextResponseDto` to `ms-sftp-api/src/app/api/dtos/file.dtos.ts` (with `@ApiProperty` decorators).
- [X] T012 Add a `@Get('read')` endpoint in `ms-sftp-api/src/app/api/controllers/file.controller.ts` that dispatches `ReadFileTextQuery` and returns `ReadFileTextResponseDto`. Reject paths outside `/data/files` with 400.
- [X] T013 Register `ReadFileTextHandler` in the providers array of `ms-sftp-api/src/app/application/application.module.ts`.
- [X] T014 [P] E2e test: `ms-sftp-api/test/modules/files/read-file-text.e2e-spec.ts` covering happy path, 404, 400 (path traversal), and 413 (file too large).

### Domain types and value objects

- [X] T015 [P] Create `ms-meteo-api/src/app/domain/types/meteo-provider.enum.ts` with `MeteoProvider` enum (`RADAR`, `HARMONIE`, `EPS`, `SAIH`) — used for typing only, the worker still trusts what is on disk.
- [X] T016 [P] Create `ms-meteo-api/src/app/domain/types/ingest-status.enum.ts` with `IngestStatus` (`RUNNING`, `OK`, `PARTIAL`, `FAILED`, `NOOP`) and `TriggerSource` (`CRON`, `MANUAL`).
- [X] T017 [P] Create `ms-meteo-api/src/app/domain/value-objects/provider-name.value-object.ts` (`ProviderName`) — uppercases and validates against `/^[A-Z][A-Z0-9_]{1,31}$/`, throws `EntityError`.
- [X] T018 [P] Create `ms-meteo-api/src/app/domain/value-objects/variable-name.value-object.ts` (`VariableName`) — preserves casing, validates regex, exposes `toSnakeCase()`.
- [X] T019 [P] Create `ms-meteo-api/src/app/domain/value-objects/meteo-info-json.value-object.ts` (`MeteoInfoJson`) — validates required fields, parses `fecha_inicio` / `fecha_fin` from `YYYYMMDDHHMM`, exposes `expectedTimestamps(fileCount)`, `bbox()`, `crs()`, `noDataValue()`.
- [X] T020 [P] Create `ms-meteo-api/src/app/domain/value-objects/layer-name.value-object.ts` (`LayerName`) — `LayerName.compose(provider, variable | null)` returning `tajo:<provider_var>` snake-cased; RADAR special case → `tajo:radar_precipitacion`. Also `bareName()`.
- [X] T021 [P] Create `ms-meteo-api/src/app/domain/value-objects/meteo-raster-filename.value-object.ts` (`MeteoRasterFilename`) — `static parse(filename): MeteoRasterFilename | null`, regex `^.+0000\.(\d{3})$`, exposes `step: number`.

### Audit entity and persistence

- [X] T022 Create `ms-meteo-api/src/app/domain/entities/meteo-ingest-run.entity.ts` (`MeteoIngestRun`) extending `BaseAuditEntity`, implementing `IValidable`. Fields per [data-model.md](./data-model.md). Methods: `markRunning()`, `markOk(filesOk)`, `markPartial(filesOk, filesFailed, errorSummary)`, `markFailed(errorSummary)`, `markNoop()`. `validate()` enforces `files_processed = files_ok + files_failed` and provider/status formats.
- [X] T023 Create `ms-meteo-api/src/app/domain/ports/meteo-ingest-run-repository.port.ts` (`IMeteoIngestRunRepository` abstract class) with `create`, `update`, `findLatestByDataset`, `findLatestForAll`.
- [X] T024 Create `ms-meteo-api/src/migrations/<timestamp>-create-meteo-ingest-run.ts` raw-SQL migration: table, the three CHECKs and three indexes from [data-model.md](./data-model.md).
- [X] T025 Create `ms-meteo-api/src/app/infrastructure/persistence/meteo-ingest-run.repository.ts` (`MeteoIngestRunRepository`) implementing the port via `@InjectRepository(MeteoIngestRun)`. Wrap operations in try/catch and throw `RepositoryError` on failure. Implement `findLatestForAll` with a window-function query.

### SFTP HTTP client and discovery

- [X] T026 Create `ms-meteo-api/src/app/domain/ports/sftp-file-client.port.ts` (`ISftpFileClient` abstract class) with `listDirectory(path): Promise<SftpFileEntry[]>`, `readText(path): Promise<string>`, `download(path): Promise<Buffer>`. Define `SftpFileEntry` here as well.
- [X] T027 Create `ms-meteo-api/src/app/infrastructure/sftp/sftp-file.client.ts` (`SftpFileClient`) implementing the port with axios. Configure base URL from `MeteoConfigService`, send `x-internal-caller` header, throw `ProviderError` on non-2xx.
- [X] T028 Create `ms-meteo-api/src/app/domain/results/meteo.results.ts` with `DiscoveredDataset` (provider, variable | null, infoJson, files: MeteoRasterFilename[]), `MeteoInfoResult`, `SyncResult`, `DatasetSyncResult`.
- [X] T029 Create `ms-meteo-api/src/app/application/services/meteo-discovery.service.ts` (`MeteoDiscoveryService`) — uses `ISftpFileClient` to walk `tajo/METEO/`, detect provider folders, detect optional variable subfolders (RADAR has none), read each `info.json` via `readText`, parse with `MeteoInfoJson`, list raster files, return `DiscoveredDataset[]`. Skip folders without a valid `info.json` and log a warning. Honors an optional `{ provider?, variable? }` filter.

### Module skeleton

- [X] T030 Create `ms-meteo-api/src/app/api/controllers/meteo.controller.ts` with empty `@Controller('meteo')` class and constructor injecting `CommandBus` + `CachingQueryBus` (endpoints added by user-story phases).
- [X] T031 Create `ms-meteo-api/src/app/api/dtos/meteo.dtos.ts` with `MeteoFilterQueryDto` (`@IsOptional() @IsString() provider?: string; @IsOptional() @IsString() variable?: string;`) and a `@ValidateIf` rule that rejects `variable` without `provider`.
- [X] T032 Wire the new pieces into `ms-meteo-api/src/app/infrastructure/infrastructure.module.ts`: register `TypeOrmModule.forFeature([MeteoIngestRun])`, bind `IMeteoIngestRunRepository → MeteoIngestRunRepository`, bind `ISftpFileClient → SftpFileClient`, import `MeteoConfigModule`, export the new ports.
- [X] T033 Wire `MeteoController`, `MeteoDiscoveryService` and the (still empty) handlers into `ms-meteo-api/src/app/application/application.module.ts`.

### Test helpers (used by every user story phase)

- [X] T034 [P] Create `ms-meteo-api/test/helpers/sftp-api.mock.ts` exporting an `InMemorySftpFileClient` implementing `ISftpFileClient` plus helper builders `mockSftpTree({...})` and `mockSftpFailure(...)`.
- [X] T035 [P] Create `ms-meteo-api/test/helpers/geoserver-rest.mock.ts` exporting an `InMemoryGeoserverImageMosaicClient` (used by US1+) so the same instance can be reused.
- [X] T036 [P] Create `ms-meteo-api/test/helpers/gdal.mock.ts` exporting an `InMemoryRasterConverter` that records calls and writes a tiny stub `.tif` to disk so downstream code can `stat()` it.
- [X] T037 [P] Create `ms-meteo-api/test/factories/meteo-info-json.factory.ts` with `buildInfoJson(overrides)` and `buildInfoJsonRaw(overrides): string` (returns a JSON string with the exact provider format).

**Checkpoint**: Foundation ready. The SFTP can be read, the audit table exists, the discovery service can list datasets, and the test scaffolding is in place. User-story phases can begin in parallel.

---

## Phase 3: User Story 1 — Visualize Latest Meteo Forecast on the Map (Priority: P1) 🎯 MVP

**Goal**: After this phase, an operator (or the e2e test) can call `POST /meteo/sync?provider=harmonie&variable=Precipitacion` and the corresponding GeoTIFFs are produced, the ImageMosaic store is bootstrapped, the layer exists in workspace `tajo` with TIME dimension, and granules are added. A WMS client requesting that layer at any of the published timestamps gets a raster back.

**Independent Test**: Run the e2e test `sync-meteo-variable.e2e-spec.ts`. It loads a synthetic dataset into the in-memory SFTP mock, dispatches `POST /meteo/sync?provider=harmonie&variable=Precipitacion`, and verifies that the in-memory GeoServer mock received the bootstrap and 48 `addGranule` calls with the expected timestamps.

### GeoServer client and bootstrap

- [X] T038 [P] [US1] Create `ms-meteo-api/src/app/domain/ports/geoserver-image-mosaic-client.port.ts` (`IGeoserverImageMosaicClient` abstract class) with the methods listed in [contracts/geoserver-rest.md](./contracts/geoserver-rest.md): `storeExists`, `createImageMosaicStore`, `enableTimeDimension`, `listGranules`, `addGranule`, `deleteGranulesOlderThan`. Define `Granule { id, time, location }`.
- [X] T039 [US1] Create `ms-meteo-api/src/app/infrastructure/geoserver/geoserver-image-mosaic.client.ts` implementing the port with axios + basic auth. Each method maps 1:1 to the endpoint listed in `contracts/geoserver-rest.md`. Throw `ProviderError` on non-2xx (except 404 in `storeExists` which returns `false`).
- [X] T040 [US1] Create `ms-meteo-api/src/app/infrastructure/geoserver/image-mosaic-bootstrap.service.ts` (`ImageMosaicBootstrapService`) that, given a `DiscoveredDataset` and a target directory, ensures the directory exists, writes `indexer.properties` and `timeregex.properties` (idempotent — overwrite is safe), then calls `createImageMosaicStore` and `enableTimeDimension`. No-op if `storeExists` returns true.

### GDAL adapter

- [X] T041 [P] [US1] Create `ms-meteo-api/src/app/domain/ports/raster-converter.port.ts` (`IRasterConverter` abstract class) with `toGeoTiff({ sourceBuffer, outputPath, nodata, srs }): Promise<void>` and a `ConvertRequest` type.
- [X] T042 [US1] Create `ms-meteo-api/src/app/infrastructure/gdal/gdal-raster-converter.ts` (`GdalRasterConverter`) implementing the port: writes the source buffer to a temp file under `os.tmpdir()`, spawns `gdal_translate -of GTiff -a_srs <srs> -a_nodata <nodata> -co COMPRESS=DEFLATE -co TILED=YES <tmp> <outputPath>`, awaits exit, deletes the temp file. Throws `ProviderError` on non-zero exit code with stderr in the message.

### Sync command (single dataset path — orchestration)

- [X] T043 [US1] Create `ms-meteo-api/src/app/application/commands/meteo.commands.ts` with `SyncMeteoCommand({ provider?, variable?, triggeredBy })` and `SyncMeteoHandler`. The handler:
    1. Calls `MeteoDiscoveryService.discover({ provider, variable })`.
    2. For each `DiscoveredDataset`, dispatches an internal `processOne(dataset, triggeredBy)` (parallel with concurrency `meteoIngestConcurrency`).
    3. Aggregates results into `SyncResult`.
- [X] T044 [US1] Implement `processOne(dataset, triggeredBy)` inside `SyncMeteoHandler` (private method). Steps:
    1. Acquire in-process per-dataset mutex (Map<key, Promise>); if held, return `noop` immediately for this run.
    2. Create `MeteoIngestRun` row with status `RUNNING`.
    3. Call `ImageMosaicBootstrapService.ensure(dataset)`.
    4. Call `geoserverClient.listGranules(layer)` → set of already-published timestamps.
    5. Compute expected timestamps from `dataset.infoJson.expectedTimestamps(dataset.files.length)`.
    6. For each missing `(file, timestamp)`: download via `sftpClient.download(file.path)`, convert via `rasterConverter.toGeoTiff(...)` to `meteoGeotiffDir/<store>/<store>_<TIMESTAMP>.tif`, then `geoserverClient.addGranule(...)`. Track success/failure per file.
    7. If `files_processed == 0` → mark run `noop`. Else if all ok → `ok`; else if some ok → `partial`; else → `failed`. Persist via repository update.
    8. Return `DatasetSyncResult`.
    9. Always release the mutex.
- [X] T045 [US1] Add `POST /meteo/sync` endpoint to `ms-meteo-api/src/app/api/controllers/meteo.controller.ts`. Maps `MeteoFilterQueryDto` → `SyncMeteoCommand({ ..., triggeredBy: 'manual' })`, dispatches via `CommandBus`, returns `SyncResult`. Standard try/catch from constitution Principle VII.
- [X] T046 [US1] Add `SyncMeteoMapper` (toCommand / toResponseDto) inside `ms-meteo-api/src/app/application/mappers/meteo.mappers.ts`.
- [X] T047 [US1] Register `SyncMeteoHandler`, `MeteoDiscoveryService`, `ImageMosaicBootstrapService` in `ms-meteo-api/src/app/application/application.module.ts` providers array. Bind `IGeoserverImageMosaicClient → GeoserverImageMosaicClient` and `IRasterConverter → GdalRasterConverter` in `infrastructure.module.ts`.

### E2E tests for User Story 1

- [X] T048 [P] [US1] `ms-meteo-api/test/modules/meteo/sync-meteo-variable.e2e-spec.ts`:
    - **Initial publish**: empty GeoServer, full SFTP set → expects bootstrap to be called once + 48 `addGranule` calls + audit row `status=ok files_ok=48`.
    - **Re-sync no-op**: GeoServer already has 48 granules → expects 0 conversions + audit row `status=noop`.
    - **Partial reconcile**: GeoServer has 47/48 → expects exactly 1 conversion + 1 `addGranule` + audit row `status=ok files_ok=1`.
    - **GDAL failure on one file**: mock GDAL to throw on file index 5 → expects 47 ok + 1 failed + audit row `status=partial`. A second sync call recovers the missing one.
    - **GeoServer failure on one file**: mock `addGranule` to throw on index 10 → same partial+recovery shape.
    - **Malformed info.json**: mock `readText` to return invalid JSON → expects 422 (or `ProviderError` mapped to 502) and audit row `status=failed` with `error_summary`.

**Checkpoint**: User Story 1 fully functional and independently testable. After this phase, the MVP exists: data flows SFTP → GeoTIFF → GeoServer ImageMosaic.

---

## Phase 4: User Story 2 — Discover Available Meteo Datasets (Priority: P1)

**Goal**: A consumer can call `GET /meteo/info` (or with `?provider=...&variable=...`) and receive a JSON list of every dataset with its metadata, layer name, and last ingest run.

**Independent Test**: Run `get-meteo-info.e2e-spec.ts`. Loads a synthetic SFTP tree, optionally inserts some `meteo_ingest_run` rows directly via the repository, then calls the endpoint and asserts the response shape and filter behavior.

### Query and handler

- [X] T049 [US2] Create `ms-meteo-api/src/app/application/queries/meteo.queries.ts` with `MeteoInfoQuery({ provider?, variable? })` and `MeteoInfoHandler`. The handler:
    1. Calls `MeteoDiscoveryService.discover({ provider, variable })`.
    2. Calls `meteoIngestRunRepository.findLatestForAll()` once.
    3. Joins each discovered dataset with its latest run and produces a `MeteoInfoResult[]`.
    4. If both filters supplied and no dataset matches → throw `ApiError(404)`. If only `provider` supplied and no variables → throw `ApiError(404)`.
- [X] T050 [US2] Add `GET /meteo/info` endpoint to `ms-meteo-api/src/app/api/controllers/meteo.controller.ts`. Maps `MeteoFilterQueryDto` → `MeteoInfoQuery`, dispatches via `CachingQueryBus`, returns `MeteoInfoResponseDto[]`.
- [X] T051 [US2] Add `MeteoInfoMapper.toResponseDto(result)` to `ms-meteo-api/src/app/application/mappers/meteo.mappers.ts`.
- [X] T052 [US2] Add `MeteoInfoResponseDto` (and its nested `MeteoInfoBodyDto`, `MeteoLastRunDto`, `MeteoBboxDto`) to `ms-meteo-api/src/app/api/dtos/meteo.dtos.ts` with `@ApiProperty` decorators.
- [X] T053 [US2] Add `MeteoInfoCacheKeys` to `ms-meteo-api/src/app/infrastructure/cache/cache-config.registry.ts` and register `MeteoInfoQuery` in `CACHE_REGISTRY` with TTL 60 s and a key function that includes `provider`/`variable` from the query.
- [X] T054 [US2] Register `MeteoInfoHandler` in `application.module.ts` providers array.
- [X] T055 [US2] Make `SyncMeteoHandler` (from US1) invalidate the corresponding `MeteoInfoCacheKeys` after each successful dataset sync.

### E2E tests for User Story 2

- [X] T056 [P] [US2] `ms-meteo-api/test/modules/meteo/get-meteo-info.e2e-spec.ts`:
    - **Empty SFTP** → returns `[]`.
    - **Full tree** → returns one entry per `(provider, variable)` discovered in the mock; verifies `layerName` correctness for RADAR (no variable) and for normal providers.
    - **Filter by provider** (`?provider=harmonie`) → returns only HARMONIE entries.
    - **Filter by provider+variable** (`?provider=eps&variable=Precipitacion_25`) → returns 1 entry.
    - **Variable without provider** (`?variable=Precipitacion`) → 400.
    - **Unknown provider** → 404.
    - **Unknown variable inside known provider** → 404.
    - **`lastRun: null`** when no runs exist for that dataset.
    - **`lastRun` populated** when a `meteo_ingest_run` row exists (insert directly via repository in test setup).
    - **Cache hit**: second call within TTL does not call sftp-api again (verify mock call count).

**Checkpoint**: User Story 2 fully functional. Consumers have a stable metadata API. The MVP now has both halves: ingest (US1) and discovery (US2).

---

## Phase 5: User Story 3 — Automatic Continuous Ingestion (Priority: P1)

**Goal**: A cron tick fires `SyncMeteoCommand` automatically every 3 hours (configurable). Failed runs are retried by the next tick without operator action. Concurrent triggers for the same dataset are serialized.

**Independent Test**: Run `automatic-sync.e2e-spec.ts`. It manually invokes the scheduler method (instead of waiting), then asserts the same outcomes as US1's manual flow plus the recovery behavior.

### Scheduler

- [X] T057 [US3] Create `ms-meteo-api/src/app/infrastructure/scheduling/meteo-sync.scheduler.ts` (`MeteoSyncScheduler`). Inject `CommandBus` and `MeteoConfigService`. Use `@Cron(meteoConfig.meteoSyncCron)` on a `runIngestCycle()` method that dispatches `SyncMeteoCommand({ triggeredBy: 'cron' })`. Wrap in try/catch, log via Pino. Expose the cron expression dynamically so tests can inject a different one.
- [X] T058 [US3] Register `MeteoSyncScheduler` in `application.module.ts` providers array.
- [X] T059 [US3] Verify the per-dataset mutex implemented in T044 actually serializes concurrent calls: extract it into a small helper class `DatasetMutex` in `ms-meteo-api/src/app/application/services/dataset-mutex.ts` so it can be unit-tested.

### E2E test for User Story 3

- [X] T060 [P] [US3] `ms-meteo-api/test/modules/meteo/automatic-sync.e2e-spec.ts`:
    - **Scheduler fires** → invoke `scheduler.runIngestCycle()` directly (do not wait for cron); verify it dispatches `SyncMeteoCommand` with `triggeredBy: 'cron'`.
    - **Recovery across cycles**: cycle 1 with mocked failure on file 23 → audit row `partial`. Cycle 2 with mock cleared → expects exactly 1 conversion + audit row `ok`. After cycle 2, GeoServer mock holds 48 granules.
    - **Concurrency lock**: dispatch two `SyncMeteoCommand` for the same dataset in parallel via two `commandBus.execute(...)` calls inside `Promise.all`. Expect only one `processOne` body to fully run (assert via spy on `rasterConverter.toGeoTiff` call count).
    - **Independent failures**: in a multi-dataset cycle, force HARMONIE/Precipitacion to fail and assert that EPS/Precipitacion_media still completes successfully (FR-017).

**Checkpoint**: User Story 3 done. The service is now self-driving.

---

## Phase 6: User Story 4 — New Provider Variable Auto-Discovered (Priority: P2)

**Goal**: Adding a new variable folder to the SFTP automatically results in a new layer and audit rows on the next cycle, with no code change. Folders without a valid `info.json` are skipped without breaking other datasets.

**Independent Test**: `auto-discover-new-variable.e2e-spec.ts` mutates the in-memory SFTP between two cycles and asserts the new dataset appears in `/meteo/info` and is published in GeoServer.

> Most of the behavior is already enabled by the discovery service from Foundational. This phase only adds tests and any edge-case fixes that surface.

### Behavior tests

- [X] T061 [P] [US4] `ms-meteo-api/test/modules/meteo/auto-discover-new-variable.e2e-spec.ts`:
    - **New variable mid-cycle**: cycle 1 with HARMONIE/Temperatura only; assert layer count = 1. Add `HARMONIE/Viento/info.json` + 48 files to the SFTP mock. Cycle 2: expects new layer `tajo:harmonie_viento` bootstrapped + 48 granules + new entry in `/meteo/info`.
    - **Folder without info.json**: SFTP has `HARMONIE/Garbage/` with files but no `info.json` → discovery skips it, logs a warning, other variables process normally.
    - **Malformed info.json**: same as above but with a syntactically valid but schema-invalid JSON → same skip behavior, plus an audit row `status=failed` with `error_summary` mentioning the parse error (decision: when info.json is broken we still want a row so the operator notices).

### Discovery hardening

- [X] T062 [US4] Update `MeteoDiscoveryService` so a single bad folder is logged + skipped without aborting the discovery walk. Verify by re-running T061's malformed-info scenario.
- [X] T063 [US4] Ensure RADAR-style providers (no variable level) are handled by treating "the provider folder has files directly" as a sentinel for `variable = null`. Add an explicit unit-style assertion in the e2e test.

**Checkpoint**: User Story 4 done. Adding variables is zero-touch from operations' perspective.

---

## Phase 7: User Story 5 — Auditability of Ingest Operations (Priority: P2)

**Goal**: Every dataset attempt — including no-ops and failures — results in a queryable `meteo_ingest_run` row with accurate counts, status, timing and trigger source.

**Independent Test**: `audit-ingest-runs.e2e-spec.ts` runs a sequence of cycles with mixed outcomes and queries the table directly via the repository to verify each row.

> Most of the persistence already happens in US1/US3 handlers. This phase locks the behavior with explicit tests and adds the missing no-op/failed paths if any are missing.

### Audit completeness

- [X] T064 [US5] Verify `SyncMeteoHandler` writes a `noop` row even when `processOne` short-circuits because the in-process mutex is held. If not, fix it.
- [X] T065 [US5] Verify `SyncMeteoHandler` writes a `failed` row when discovery fails entirely for a dataset (info.json malformed) — wire the path so the row is created with `forecast_run = null` and a meaningful `error_summary`.
- [X] T066 [US5] Add an index check: confirm `idx_meteo_ingest_run_provider_variable_started_at` covers the `findLatestByDataset` query path. Add an `EXPLAIN` assertion in the e2e test (using TypeORM `query()`).

### E2E test for User Story 5

- [X] T067 [P] [US5] `ms-meteo-api/test/modules/meteo/audit-ingest-runs.e2e-spec.ts`:
    - Run a sequence: noop cycle → ok cycle → partial cycle → failed cycle → ok cycle.
    - After each, query `meteo_ingest_run` directly and assert `(provider, variable, status, files_ok, files_failed, triggered_by, started_at, finished_at, error_summary, forecast_run)` for the matching row.
    - Verify `triggered_by = 'manual'` for `POST /meteo/sync` and `triggered_by = 'cron'` for `scheduler.runIngestCycle()`.
    - Verify `files_processed = files_ok + files_failed` for every row (CHECK constraint).
    - Verify `findLatestForAll` returns one row per dataset.

**Checkpoint**: User Story 5 done. The audit substrate is ready for a future operations UI.

---

## Phase 8: User Story 6 — Bounded Storage Footprint (Priority: P3)

**Goal**: A daily retention task removes granules older than `METEO_RETENTION_DAYS` (default 7) from every meteo layer, both in GeoServer and on disk. Layers are preserved as empty time-aware containers if all their granules expire.

**Independent Test**: `purge-meteo-granules.e2e-spec.ts` seeds the GeoServer mock with old + recent granules and the disk with their `.tif` files, runs the retention command, and verifies what remains.

### Retention command

- [X] T068 [US6] Add `PurgeMeteoGranulesCommand` and `PurgeMeteoGranulesHandler` to `ms-meteo-api/src/app/application/commands/meteo.commands.ts`. The handler:
    1. Calls `MeteoDiscoveryService.discover({})` to get every known dataset (or alternatively iterates layers from a hardcoded prefix scan via `geoserverClient.listStores(workspace)` — pick whichever needs less GeoServer work).
    2. For each dataset, computes `threshold = now - retentionDays`.
    3. Calls `geoserverClient.deleteGranulesOlderThan(workspace, layer, threshold)` and captures the list of deleted `location` filenames.
    4. Deletes the corresponding `.tif` files under `meteoGeotiffDir/<store>/` (best effort, log on failure).
    5. Returns summary `{ datasetsScanned, granulesDeleted, filesDeleted, errors }`.
- [X] T069 [US6] Add a second cron in `MeteoSyncScheduler` (`@Cron(meteoConfig.meteoRetentionCron)`) that dispatches `PurgeMeteoGranulesCommand`.
- [X] T070 [US6] Register `PurgeMeteoGranulesHandler` in `application.module.ts` providers.

### E2E test for User Story 6

- [X] T071 [P] [US6] `ms-meteo-api/test/modules/meteo/purge-meteo-granules.e2e-spec.ts`:
    - Seed `InMemoryGeoserverImageMosaicClient` with granules dated `now-10d`, `now-8d`, `now-6d`, `now-1h`. Set retention 7 days. Run command.
    - Expect granules `now-10d` and `now-8d` removed; `now-6d` and `now-1h` kept.
    - Expect corresponding `.tif` files removed from disk.
    - Expect the layer itself still exists in the mock (no `deleteLayer` call).
    - Expect a row in `meteo_ingest_run` is **not** created by the retention task (retention is a separate operation; it should not pollute the ingest audit).

**Checkpoint**: User Story 6 done. Storage stays bounded.

---

## Phase 9: Polish & Cross-Cutting Concerns

### Cross-repo: ms-gateway-api

- [X] T072 [P] Create `ms-gateway-api/src/app/api/controllers/meteo-proxy.controller.ts` mirroring the pattern of `predictions-proxy.controller.ts`, exposing `GET /meteo/info` and `POST /meteo/sync` with optional `provider` / `variable` query params, forwarding to `http://ms-meteo-api:3010/meteo/...` with header `x-internal-caller: ms-gateway-api`.
- [X] T073 [P] Register `MeteoProxyController` in the relevant module of `ms-gateway-api`.

### Cross-repo: infra

- [X] T074 Add `infra-db-meteo` service (Postgres 16, port `5440`, volume `meteo-db-data`) to `infra/infra/docker-compose.yml`. Use the same healthcheck and `init-extensions.sql` mount as the other DB services.
- [X] T075 Add `ms-meteo-api` service to `infra/infra/docker-compose.apps.yml` joined to `infra-network`, depending on `infra-db-meteo`, with the env vars from `.env.example`, the bind mount `/opt/geoserver/datasets:/opt/datasets:rw`, and port `3010` exposed.
- [X] T076 Add the new Jenkins multibranch pipeline entry for `VSADTajo/ms-meteo-api` to `infra/jenkins/casc.yaml` following the existing 8-pipeline pattern.
- [X] T077 Update the table of services in `infra/CLAUDE.md` to add `ms-meteo-api` (port 3010) and `infra-db-meteo` (port 5440).

### Repo init and remote

- [ ] T078 From `infra/ms-meteo-api`, run `gh repo create VSADTajo/ms-meteo-api --private --source=. --remote=origin --push` to create the GitHub repo and push the existing local branches.

### Documentation cleanup

- [X] T079 [P] Rewrite the header and "Active Technologies" / "Recent Changes" sections of `ms-meteo-api/CLAUDE.md` to describe the meteo domain (instead of the inherited boilerplate copy from `ms-hydro-api`). Keep the architectural sections (CQRS, hexagonal, value objects, ports, tests) unchanged.
- [X] T080 [P] Update `ms-meteo-api/README.md` with a one-page overview pointing at `specs/001-meteo-ingest/` for full details.

### Swagger sweep

- [X] T081 [P] Add `@ApiEndpoint` decorators to both `MeteoController` endpoints (summary, query params, responses, errors) and verify Swagger UI renders them correctly.

### Health and readiness

- [X] T082 [P] Extend the existing `HealthModule` (`src/health/`) with two custom indicators: one that pings `ms-sftp-api/health` and one that pings `${GEOSERVER_URL}/web/`. Both contribute to `/health` so deployments fail fast if dependencies are unreachable.

### Manual verification

- [ ] T083 Run the [quickstart.md](./quickstart.md) end-to-end on a local docker-compose stack (Postgres + Redis + sftp-api + geoserver + meteo-api). Confirm a real `gdal_translate` runs and a real ImageMosaic layer appears in the GeoServer UI with a working time slider.

---

## Dependencies & Story Completion Order

```text
Phase 1 Setup
    │
    ▼
Phase 2 Foundational  ◄── Blocks every user story
    │
    ├──────────────┬──────────────┬───────────────┐
    ▼              ▼              ▼               │
US1 (P1)        US2 (P1)       (US3 needs US1)   │
    │              │              │               │
    │              ▼              │               │
    │           cache             │               │
    │           invalidation      │               │
    │           comes from US1    │               │
    └──────┬───────┴──────┬───────┘               │
           ▼              ▼                       │
        US4 (P2)       US5 (P2)                   │
        depends on     depends on                 │
        discovery      US1/US3 audit writes       │
        from Found.    │                          │
                       ▼                          │
                    US6 (P3)  ◄───────────────────┘
                    needs US1's bootstrap path
                    │
                    ▼
                Phase 9 Polish
```

**Story-level dependency notes**:

- **US1 → US3**: US3 reuses `SyncMeteoHandler` from US1. US3 only adds the cron entry point and the recovery test harness.
- **US1 → US5**: US5 verifies audit rows that are written by US1's handler. It can be implemented after US1 with no extra application code beyond fixing whatever cases US5's tests catch.
- **US2 ↔ US1**: Independent in code, but US2's tests need US1's `meteo_ingest_run` insert path to assert `lastRun` populated. If US2 ships first, those scenarios are skipped initially and re-enabled after US1.
- **US4 ⊆ Foundational**: Most behavior is already in the discovery service. US4 is mostly tests + hardening.
- **US6**: Independent and last because it is P3 and uses the same GeoServer client as US1.

## Parallel Execution Opportunities

**Inside Phase 1 (Setup)**:
T003, T004, T005, T006 → all in `src/configuration/meteo/` but different files → can run in parallel.

**Inside Phase 2 (Foundational)**:
T015–T021 (domain types + value objects) → all different files → fully parallel.
T034–T037 (test helpers) → all different files → fully parallel.
T009–T014 (cross-repo sftp-api work) → independent of the meteo-api work → parallel with the meteo-api Foundational tasks.

**Across user stories (after Phase 2)**:
US1, US2, US4 can be developed in parallel by different contributors. US3 should follow US1. US5 should follow US1+US3. US6 last.

**Inside Phase 9 (Polish)**:
T072+T073, T074, T075, T076, T077, T079, T080, T081, T082 → mostly independent → high parallelism.

## Suggested MVP Scope

**Phase 1 + Phase 2 + Phase 3 (US1) + Phase 4 (US2) + Phase 5 (US3)** = **Functional MVP**.

After this:
- Operators see real meteo layers in GeoServer (US1).
- Developers consume `/meteo/info` to discover datasets (US2).
- The system runs itself on schedule and recovers from failures (US3).

US4, US5, US6 add depth and operability but the platform is **already useful and demoable** at the end of Phase 5.

## Format Validation

Every task above:

- ✅ Starts with `- [ ]`
- ✅ Has a `Txxx` ID in execution order (T001..T083)
- ✅ Has `[P]` only when parallelizable in its phase
- ✅ Has `[USx]` only inside user-story phases (Phases 3–8)
- ✅ Includes the exact file path the contributor needs to touch

**Total tasks**: 83
**Per phase**: Setup 8 · Foundational 29 · US1 11 · US2 8 · US3 4 · US4 3 · US5 4 · US6 4 · Polish 12
**MVP boundary**: end of T060 (Phase 5)
