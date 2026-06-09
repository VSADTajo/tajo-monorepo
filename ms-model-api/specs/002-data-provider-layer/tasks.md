# Tasks: Data Provider Layer

**Input**: Design documents from `/specs/002-data-provider-layer/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/rest-api.md

**Tests**: Included — e2e tests via Supertest + Testcontainers (real Postgres), mock external HTTP calls (FEWS API, ms-sftp-api) and IMessageBroker. Follows CLAUDE.md testing philosophy.

**Organization**: Tasks grouped by user story. US5 (Normalization + Publishing) is implemented as part of US2 (Ingestion Pipeline) since they share the same code path.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install dependencies and create configuration modules for external services

- [x] T001 Install `@nestjs/schedule` dependency via `npm install @nestjs/schedule`
- [x] T002 [P] Create FEWS API config module (`src/configuration/fews-api/fews-api-config.ts`, `fews-api-config.type.ts`, `fews-api-config.service.ts`, `fews-api-config.module.ts`) following existing `registerAs` pattern — env var `FEWS_API_BASE_URL`
- [x] T003 [P] Create SFTP API config module (`src/configuration/sftp-api/sftp-api-config.ts`, `sftp-api-config.type.ts`, `sftp-api-config.service.ts`, `sftp-api-config.module.ts`) following existing `registerAs` pattern — env var `SFTP_API_BASE_URL` (default: `http://localhost:3003`)
- [x] T004 Add `FEWS_API_BASE_URL` and `SFTP_API_BASE_URL` to `.env.example`
- [x] T005 Import `ScheduleModule.forRoot()`, `FewsApiConfigModule`, and `SftpApiConfigModule` in `src/app.module.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Domain layer (entities, value objects, ports, enums, results), migration, repositories, messaging topic, and module bindings

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Domain Types & Value Objects

- [x] T006 [P] Create `ProviderType` enum (`FEWS_API`, `SFTP_FILE`) in `src/app/domain/types/provider-type.enum.ts`
- [x] T007 [P] Create `IngestionStatus` enum (`RUNNING`, `SUCCESS`, `FAILED`, `PARTIAL`) in `src/app/domain/types/ingestion-status.enum.ts`
- [x] T008 [P] Create `ProviderTypeValueObject` (validates against ProviderType enum) in `src/app/domain/value-objects/provider-type.value-object.ts`
- [x] T009 [P] Create `PollingIntervalValueObject` (validates >= 5 minutes) in `src/app/domain/value-objects/polling-interval.value-object.ts`
- [x] T010 [P] Create `BaseUrlValueObject` (validates URL format) in `src/app/domain/value-objects/base-url.value-object.ts`

### Domain Entities

- [x] T011 [P] Create `ProviderConfig` entity in `src/app/domain/entities/provider-config.entity.ts` — extends `BaseAuditEntity`, implements `IValidable`, fields: id (UUID PK), name (VARCHAR 255 UNIQUE), type (VARCHAR 20), baseUrl (VARCHAR 500), pollingIntervalMinutes (INTEGER DEFAULT 360), isActive (BOOLEAN DEFAULT false), settings (JSONB DEFAULT '{}'), `@OneToMany` to IngestionRun. `validate()` delegates to ProviderType, PollingInterval, BaseUrl VOs
- [x] T012 [P] Create `IngestionRun` entity in `src/app/domain/entities/ingestion-run.entity.ts` — extends `BaseAuditEntity`, implements `IValidable`, fields: id (UUID PK), providerConfigId (UUID FK), status (VARCHAR 20), startedAt (TIMESTAMP), completedAt (TIMESTAMP nullable), seriesCount (INTEGER DEFAULT 0), eventsCount (INTEGER DEFAULT 0), errorMessage (TEXT nullable), `@ManyToOne` to ProviderConfig with `onDelete: CASCADE`. `validate()` checks required fields

### Domain Ports

- [x] T013 [P] Create `IProviderConfigRepository` port in `src/app/domain/ports/provider-config-repository.port.ts` — abstract methods: `create`, `findAll`, `findById`, `findByName`, `findActive`, `update`, `delete`
- [x] T014 [P] Create `IIngestionRunRepository` port in `src/app/domain/ports/ingestion-run-repository.port.ts` — abstract methods: `create`, `findById`, `findByProviderConfigId`, `findRunningByProviderConfigId`, `update`
- [x] T015 [P] Create `IDataProvider` port in `src/app/domain/ports/data-provider.port.ts` — abstract class with method: `fetch(config: ProviderConfig): Promise<NormalizedTimeSeriesResult[]>`

### Domain Results

- [x] T016 [P] Create `ProviderConfigResult` in `src/app/domain/results/provider-config.result.ts`
- [x] T017 [P] Create `IngestionRunResult` in `src/app/domain/results/ingestion-run.result.ts`
- [x] T018 [P] Create `NormalizedTimeSeriesResult` (with nested `TimeSeriesEventResult`) in `src/app/domain/results/normalized-timeseries.result.ts` — fields per data-model.md: locationId, parameterId, moduleInstanceId, stationName, lat, lon, x?, y?, z?, units, timeStep, forecastDate, startDate, endDate, events[]

### Migration

- [x] T019 Create database migration for `provider_configs` and `ingestion_runs` tables in `src/migrations/` — SQL from data-model.md including constraints (CHK_provider_configs_type, CHK_provider_configs_interval, CHK_ingestion_runs_status, FK cascade, indexes)

### Infrastructure Persistence

- [x] T020 [P] Create `ProviderConfigRepository` in `src/app/infrastructure/persistence/provider-config.repository.ts` — implements `IProviderConfigRepository`, uses `@InjectRepository(ProviderConfig)`, wraps in try/catch with `RepositoryError`
- [x] T021 [P] Create `IngestionRunRepository` in `src/app/infrastructure/persistence/ingestion-run.repository.ts` — implements `IIngestionRunRepository`, query by providerConfigId with `ORDER BY startedAt DESC`

### Messaging Registry

- [x] T022 Add `MODEL_EVENTS` topic to `src/app/infrastructure/messaging/messaging.registry.ts` — exchange: `model-events`, routingKeys: `TIMESERIES_INGESTED: 'timeseries.ingested'`

### Module Wiring

- [x] T023 Register entities (`ProviderConfig`, `IngestionRun`) in `TypeOrmModule.forFeature([...])`, bind ports to repositories (`IProviderConfigRepository` → `ProviderConfigRepository`, `IIngestionRunRepository` → `IngestionRunRepository`) in `src/app/infrastructure/infrastructure.module.ts`

### Test Factories

- [x] T024 [P] Create `provider-config.factory.ts` in `test/factories/` — `buildCreateProviderConfigDto(overrides?)` returns `{ name, type, baseUrl, pollingIntervalMinutes, settings }` with sensible defaults (type: 'FEWS_API', baseUrl: 'https://fews.example.com/...', pollingIntervalMinutes: 60, settings: { filterId, locationIds, parameterIds, documentFormat })
- [x] T025 [P] Create `ingestion-run.factory.ts` in `test/factories/` — `buildIngestionRunData(overrides?)` returns `{ providerConfigId, status, startedAt, ... }` with defaults

**Checkpoint**: Foundation ready — domain model, persistence, messaging, and test factories configured. User story implementation can begin.

---

## Phase 3: User Story 1 — Configure a Data Provider (Priority: P1) 🎯 MVP

**Goal**: Operators can CRUD provider configurations and toggle active/inactive status via REST API

**Independent Test**: Create a FEWS_API provider via POST, verify via GET, update polling interval via PUT, toggle active via PATCH, delete via DELETE. All through HTTP endpoints.

### Implementation for User Story 1

- [x] T026 [P] [US1] Create `provider-config.dtos.ts` in `src/app/api/dtos/` — DTOs: `CreateProviderConfigRequestDto` (name, type, baseUrl, pollingIntervalMinutes, settings), `UpdateProviderConfigRequestDto`, `ProviderConfigResponseDto`, validation decorators per contracts/rest-api.md
- [x] T027 [P] [US1] Create `provider-config.commands.ts` in `src/app/application/commands/` — commands + handlers: `CreateProviderConfig` (validate entity, check unique name → 409, persist, invalidate cache), `UpdateProviderConfig` (find or 404, validate, check name conflict → 409, update, invalidate cache), `DeleteProviderConfig` (find or 404, delete, invalidate cache), `ToggleProviderConfig` (find or 404, flip isActive, persist, invalidate cache)
- [x] T028 [P] [US1] Create `provider-config.queries.ts` in `src/app/application/queries/` — queries + handlers: `ListProviderConfigs`, `GetProviderConfigById` (404 if not found)
- [x] T029 [P] [US1] Create `provider-config.mappers.ts` in `src/app/application/mappers/` — mappers for Create, Update, Delete, Toggle, List, GetById
- [x] T030 [US1] Create `ProviderConfigController` in `src/app/api/controllers/provider-config.controller.ts` — endpoints: `POST /provider-configs` (201), `GET /provider-configs` (200), `GET /provider-configs/:id` (200/404), `PUT /provider-configs/:id` (200/404/409), `PATCH /provider-configs/:id/toggle` (200/404), `DELETE /provider-configs/:id` (200/404). Standard error handling pattern per CLAUDE.md
- [x] T031 [US1] Add ProviderConfig cache keys and registry entries in `src/app/infrastructure/cache/cache-config.registry.ts` — keys: `byId`, `list`, `pattern`. Invalidate on Create/Update/Delete/Toggle commands
- [x] T032 [US1] Register US1 handlers (`CreateProviderConfigHandler`, `UpdateProviderConfigHandler`, `DeleteProviderConfigHandler`, `ToggleProviderConfigHandler`, `ListProviderConfigsHandler`, `GetProviderConfigByIdHandler`) and `ProviderConfigController` in `src/app/application/application.module.ts`

### E2E Tests for User Story 1

- [x] T033 [US1] Create `create-provider-config.e2e-spec.ts` in `test/modules/provider-config/` — tests: create FEWS_API provider (201), create SFTP_FILE provider (201), create with duplicate name (409), create with invalid baseUrl (400), create with pollingInterval < 5 (400), create with missing required fields (400). Uses `createTestApp` with real Postgres, mock `ICacheService` and `IMessageBroker`
- [x] T034 [P] [US1] Create `update-provider-config.e2e-spec.ts` covers list/get tests in `test/modules/provider-config/` — tests: list empty (200, []), list after creating 2 providers (200, 2 items), get by id (200), get by non-existent id (404)
- [x] T035 [P] [US1] Create `update-provider-config.e2e-spec.ts` in `test/modules/provider-config/` — tests: update polling interval (200), update name to duplicate (409), update non-existent (404), toggle active/inactive (200 with isActive flipped), delete (200, confirm GET returns 404)

**Checkpoint**: Provider CRUD fully functional and tested. Operators can manage data source configurations via REST API.

---

## Phase 4: User Story 2 + 5 — Ingestion Pipeline + Normalization + Publishing (Priority: P1)

**Goal**: Active providers are polled on schedule, data is fetched from external sources (FEWS API / ms-sftp-api), normalized to `NormalizedTimeSeries[]`, and published to RabbitMQ topic `model-events` with routing key `timeseries.ingested`

**Independent Test**: Create and activate a provider pointing to a mock FEWS endpoint, trigger ingestion, verify IngestionRun logged with status SUCCESS and `IMessageBroker.publishToTopic` called with correct payload.

### Implementation for User Story 2 + 5

- [x] T036 [P] [US2] Create `FewsApiProviderService` in `src/app/infrastructure/services/fews-api-provider.service.ts` — implements `IDataProvider`, injects `FewsApiConfigService` for default baseUrl. `fetch(config)`: builds FEWS REST URL with filterId, locationIds, parameterIds, documentFormat=PI_JSON from config.settings, calls via axios, maps PI-JSON response to `NormalizedTimeSeriesResult[]` (combine date+time → ISO timestamp, detect missVal → isMissing). Throws `ProviderError` on HTTP failures
- [x] T037 [P] [US2] Create `SftpFileProviderService` in `src/app/infrastructure/services/sftp-file-provider.service.ts` — implements `IDataProvider`, injects `SftpApiConfigService` for baseUrl. `fetch(config)`: calls ms-sftp-api REST endpoints to get pre-parsed JSON data, maps JSON response to `NormalizedTimeSeriesResult[]`. Throws `ProviderError` on failures
- [x] T038 [US2] Create `DataProviderFactoryService` in `src/app/infrastructure/services/data-provider-factory.service.ts` — injects both provider services, `getProvider(type: ProviderType): IDataProvider` with switch/case, throws `ApiError(400)` for unknown type
- [x] T039 [US2] Create `ingestion.commands.ts` in `src/app/application/commands/` — `ExecuteIngestionCommand` + handler: (1) find ProviderConfig by ID or throw, (2) concurrency guard — check in-memory `Set<string>` of running provider IDs, reject 409 if already running, (3) create IngestionRun with status=RUNNING, (4) resolve provider via factory, (5) call `provider.fetch(config)`, (6) publish `TimeSeriesIngestedEvent` to RabbitMQ topic (`Topics.MODEL_EVENTS.exchange`, `Topics.MODEL_EVENTS.routingKeys.TIMESERIES_INGESTED`), (7) update IngestionRun with status=SUCCESS/FAILED/PARTIAL + seriesCount + eventsCount + completedAt, (8) remove from concurrency set in finally block
- [x] T040 [US2] Create `ProviderSchedulerService` in `src/app/infrastructure/services/provider-scheduler.service.ts` — implements `OnModuleInit`, injects `SchedulerRegistry`, `IProviderConfigRepository`, `CommandBus`. On init: load all active providers, register interval per provider. Methods: `registerJob(config)` (setInterval → `ExecuteIngestionCommand`), `removeJob(configId)` (deleteInterval). Uses `provider-${configId}` as interval key
- [x] T041 [US2] Update `ToggleProviderConfigHandler` in `src/app/application/commands/provider-config.commands.ts` — inject `ProviderSchedulerService`, call `registerJob` on activate and `removeJob` on deactivate
- [x] T042 [US2] Update `DeleteProviderConfigHandler` in `src/app/application/commands/provider-config.commands.ts` — inject `ProviderSchedulerService`, call `removeJob` before deleting
- [x] T043 [US2] Register `FewsApiProviderService`, `SftpFileProviderService`, `DataProviderFactoryService`, `ProviderSchedulerService` in `src/app/infrastructure/infrastructure.module.ts` (export scheduler). Register `ExecuteIngestionHandler` in `src/app/application/application.module.ts`

### E2E Tests for User Story 2 + 5

- [x] T044 [US2] Create `trigger-ingestion.e2e-spec.ts` in `test/modules/provider-config/` — tests: create provider → trigger ingestion → verify IngestionRun created with status (mock `IDataProvider` to return sample `NormalizedTimeSeriesResult[]`), verify `IMessageBroker.publishToTopic` called with `model-events` exchange and `timeseries.ingested` key and correct payload structure. Mock external HTTP calls (FEWS API / ms-sftp-api), real Postgres via Testcontainers. Tests: successful ingestion (SUCCESS), provider fetch failure (FAILED with errorMessage), concurrent ingestion guard (409)

**Checkpoint**: Full ingestion pipeline operational and tested. Active providers auto-poll, fetch data, normalize to common format, and publish to RabbitMQ. IngestionRuns logged.

---

## Phase 5: User Story 3 — Manual Ingestion Trigger (Priority: P2)

**Goal**: Operators can trigger an immediate data fetch for any provider via REST API, bypassing the scheduled interval

**Independent Test**: POST `/provider-configs/:id/trigger` for an existing provider → returns IngestionRun with status=RUNNING. Poll GET `/ingestion-runs/:id` until completed.

### Implementation for User Story 3

- [x] T045 [US3] Add `TriggerIngestionCommand` + handler to `src/app/application/commands/ingestion.commands.ts` — find provider config or 404, dispatch `ExecuteIngestionCommand`, return the IngestionRun. Works for both active and inactive providers (manual override)
- [x] T046 [US3] Add `TriggerIngestionResponseDto` to `src/app/api/dtos/provider-config.dtos.ts` and `TriggerIngestionMapper` to `src/app/application/mappers/provider-config.mappers.ts`
- [x] T047 [US3] Add `POST /provider-configs/:id/trigger` endpoint (201) to `ProviderConfigController` in `src/app/api/controllers/provider-config.controller.ts` — returns IngestionRunResult, errors: 404 (not found), 409 (already running)
- [x] T048 [US3] Register `TriggerIngestionHandler` in `src/app/application/application.module.ts`

### E2E Tests for User Story 3

- [x] T049 [US3] Add trigger tests to `trigger-ingestion.e2e-spec.ts` in `test/modules/provider-config/` (or create separate file) — tests: trigger active provider (201), trigger inactive provider (201, manual override works), trigger non-existent provider (404), trigger while already running (409)

**Checkpoint**: Manual trigger available and tested. Operators can test configs and recover from failures on demand.

---

## Phase 6: User Story 4 — View Ingestion History (Priority: P2)

**Goal**: Operators can view ingestion run history, filtered by provider, with status/timing/counts

**Independent Test**: GET `/ingestion-runs` returns list ordered by startedAt DESC. GET `/ingestion-runs?providerConfigId=X` filters by provider. GET `/ingestion-runs/:id` returns single run or 404.

### Implementation for User Story 4

- [x] T050 [P] [US4] Create `ingestion-run.dtos.ts` in `src/app/api/dtos/` — DTOs: `IngestionRunResponseDto`, `ListIngestionRunsQueryDto` (optional `providerConfigId` UUID query param)
- [x] T051 [P] [US4] Create `ingestion-run.queries.ts` in `src/app/application/queries/` — queries + handlers: `ListIngestionRuns` (filter by providerConfigId, order by startedAt DESC), `GetIngestionRunById` (404 if not found)
- [x] T052 [P] [US4] Create `ingestion-run.mappers.ts` in `src/app/application/mappers/` — mappers for List, GetById
- [x] T053 [US4] Create `IngestionRunController` in `src/app/api/controllers/ingestion-run.controller.ts` — endpoints: `GET /ingestion-runs` (200, optional query param providerConfigId), `GET /ingestion-runs/:id` (200/404). Standard error handling
- [x] T054 [US4] Register US4 handlers (`ListIngestionRunsHandler`, `GetIngestionRunByIdHandler`) and `IngestionRunController` in `src/app/application/application.module.ts`

### E2E Tests for User Story 4

- [x] T055 [US4] Create `list-ingestion-runs.e2e-spec.ts` in `test/modules/ingestion-run/` — tests: list empty (200, []), create provider + trigger ingestion (mock provider) + list runs (200, 1+ items, ordered by startedAt DESC), filter by providerConfigId (returns only matching runs), get by id (200), get non-existent id (404). Real Postgres via Testcontainers, mock `IDataProvider`, `ICacheService`, `IMessageBroker`

**Checkpoint**: Full observability and tested. Operators can monitor ingestion health and troubleshoot failures.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and cleanup

- [x] T056 Verify `.env.example` has all new env vars (`FEWS_API_BASE_URL`, `SFTP_API_BASE_URL`)
- [x] T057 Run `npm run lint` and fix any issues
- [x] T058 Run `npm run build` and verify clean compilation
- [x] T059 Run `npm run test:e2e` and verify all tests pass
- [x] T060 Validate quickstart.md flow end-to-end (create provider, activate, trigger, check runs)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 completion — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Phase 2 — No dependencies on other stories
- **US2+US5 (Phase 4)**: Depends on Phase 2 + Phase 3 (needs ProviderConfig CRUD + Toggle/Delete handlers to inject scheduler)
- **US3 (Phase 5)**: Depends on Phase 4 (needs ExecuteIngestionCommand)
- **US4 (Phase 6)**: Depends on Phase 2 only (IngestionRun entity + repo) — can run in parallel with Phase 4/5
- **Polish (Phase 7)**: Depends on all phases complete

### User Story Dependencies

```
Phase 1 (Setup)
    ↓
Phase 2 (Foundational)
    ↓
Phase 3 (US1: Provider Config CRUD)
    ↓                              ↘
Phase 4 (US2+US5: Ingestion)    Phase 6 (US4: History) [parallel]
    ↓
Phase 5 (US3: Manual Trigger)
    ↓
Phase 7 (Polish)
```

### Within Each User Story

- DTOs, commands, queries, mappers marked [P] can run in parallel (different files)
- Controllers depend on commands/queries/mappers being done
- Module registration is last step per story

### Parallel Opportunities

- **Phase 1**: T002 + T003 (config modules) in parallel
- **Phase 2**: T006–T010 (types+VOs) in parallel, T011+T012 (entities) in parallel, T013–T015 (ports) in parallel, T016–T018 (results) in parallel, T020+T021 (repos) in parallel, T024+T025 (factories) in parallel
- **Phase 3**: T026–T029 (DTOs, commands, queries, mappers) in parallel, T034+T035 (test files) in parallel
- **Phase 4**: T036+T037 (provider services) in parallel
- **Phase 4 + Phase 6**: Can run in parallel (US4 doesn't depend on US2)
- **Phase 6**: T050–T052 (DTOs, queries, mappers) in parallel

---

## Parallel Example: Phase 2 (Foundational)

```bash
# Wave 1: All types, VOs, entities, ports, results, and factories in parallel
Task: T006 "Create ProviderType enum"
Task: T007 "Create IngestionStatus enum"
Task: T008 "Create ProviderTypeValueObject"
Task: T009 "Create PollingIntervalValueObject"
Task: T010 "Create BaseUrlValueObject"
Task: T011 "Create ProviderConfig entity"
Task: T012 "Create IngestionRun entity"
Task: T013 "Create IProviderConfigRepository port"
Task: T014 "Create IIngestionRunRepository port"
Task: T015 "Create IDataProvider port"
Task: T016 "Create ProviderConfigResult"
Task: T017 "Create IngestionRunResult"
Task: T018 "Create NormalizedTimeSeriesResult"
Task: T024 "Create provider-config.factory.ts"
Task: T025 "Create ingestion-run.factory.ts"

# Wave 2: Migration + repos (depend on entities/ports)
Task: T019 "Create migration"
Task: T020 "Create ProviderConfigRepository"
Task: T021 "Create IngestionRunRepository"
Task: T022 "Add MODEL_EVENTS topic to messaging registry"

# Wave 3: Module wiring (depends on everything above)
Task: T023 "Register entities and ports in infrastructure.module.ts"
```

---

## Implementation Strategy

### MVP First (US1 Only — Phase 1 + 2 + 3)

1. Complete Phase 1: Setup (deps + config modules)
2. Complete Phase 2: Foundational (domain + migration + repos)
3. Complete Phase 3: US1 — Provider Config CRUD
4. **STOP and VALIDATE**: Test CRUD via REST API
5. Deploy if ready — operators can start creating configs

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add US1 (Provider Config CRUD) → Test → Deploy (MVP!)
3. Add US2+US5 (Ingestion Pipeline) → Test → Deploy (core value!)
4. Add US3 (Manual Trigger) + US4 (History) → Test → Deploy (full feature)
5. Polish → Final deploy

### Task Count Summary

| Phase | Story | Impl | Tests | Total |
|-------|-------|------|-------|-------|
| Phase 1: Setup | — | 5 | 0 | 5 |
| Phase 2: Foundational | — | 18 | 2 (factories) | 20 |
| Phase 3: US1 | Configure Provider | 7 | 3 | 10 |
| Phase 4: US2+US5 | Ingestion + Normalization | 8 | 1 | 9 |
| Phase 5: US3 | Manual Trigger | 4 | 1 | 5 |
| Phase 6: US4 | Ingestion History | 5 | 1 | 6 |
| Phase 7: Polish | — | 5 | 0 | 5 |
| **Total** | | **52** | **8** | **60** |

---

## Notes

- [P] tasks = different files, no dependencies — safe to parallelize
- [Story] label maps task to specific user story for traceability
- US5 (Normalization) is merged into US2 (Ingestion) since they share the same implementation path
- RabbitMQ is already in the infra docker-compose — no additional setup needed
- ms-sftp-api returns pre-parsed JSON (Option B) — no XML/CSV parsing in model-api
- FEWS API returns PI-JSON natively — no XML parsing needed
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
