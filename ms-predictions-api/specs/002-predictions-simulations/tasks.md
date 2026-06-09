# Tasks: Predictions & Simulations Layer

**Input**: Design documents from `/specs/002-predictions-simulations/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/openapi.yaml, quickstart.md
**Tests**: REQUIRED (e2e with Testcontainers, same patterns as ms-model-api / ms-sftp-api)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Configuration modules, env vars, messaging registry updates

- [x] T001 Add HYDRO_API_BASE_URL and STATION_THRESHOLD_CACHE_TTL to src/configuration/ — create hydro-api config module (hydro-api-config.ts, hydro-api-config.type.ts, hydro-api-config.service.ts, hydro-api-config.module.ts) following the same 4-file pattern as redis/ and rabbitmq/
- [x] T002 Add HYDRO_API_BASE_URL and STATION_THRESHOLD_CACHE_TTL entries to .env.example
- [x] T003 Update src/app/infrastructure/messaging/messaging.registry.ts — add Topics.MODEL_EVENTS with exchange "model-events" and routing key TIMESERIES_INGESTED: "timeseries.ingested", and add Queues.PREDICTIONS_TIMESERIES_PROCESSING: "predictions-timeseries-processing"

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: All 5 entities, value objects, ports, results, repositories, migrations — MUST complete before user stories

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Value Objects

- [x] T004 [P] Create SimulationDateValueObject in src/app/domain/value-objects/simulation-date.value-object.ts — validates exactly 14 digits (YYYYMMDDHHMMSS), normalizes ISO date strings to 14-digit format, throws EntityError
- [x] T005 [P] Create EnsembleValueObject in src/app/domain/value-objects/ensemble.value-object.ts — validates 1-5 chars alphanumeric, pads numeric to 3 digits (e.g., "1" → "001"), throws EntityError
- [x] T006 [P] Create PercentileValueObject in src/app/domain/value-objects/percentile.value-object.ts — validates 0.0-100.0 range, throws EntityError

### Entities

- [x] T007 [P] Create PredictionType entity in src/app/domain/entities/prediction-type.entity.ts — extends BaseAuditEntity, implements IValidable, fields: id (UUID PK), name (varchar 100, unique, NOT NULL), unit (varchar 20, NOT NULL). validate() checks name required + max 100, unit required + max 20. Trim name.
- [x] T008 [P] Create Simulation entity in src/app/domain/entities/simulation.entity.ts — extends BaseAuditEntity, implements IValidable, fields per data-model.md (id UUID PK, simulationDate varchar 14, jobType, method, modmeteo, modmeteots, ensemble, status enum, type enum, environment, state, basin, description, createdBy). validate() uses SimulationDateValueObject. Business methods: advanceStatus(), finalize(), fail(). OneToMany → Prediction.
- [x] T009 [P] Create Prediction entity in src/app/domain/entities/prediction.entity.ts — extends BaseAuditEntity, implements IValidable, fields per data-model.md (id UUID PK, stationId UUID NOT NULL, stationName nullable, predictionTypeId FK, simulationId FK, predictionDate, predictionStartDate, predictionEndDate, ensemble, percentile, predictionProvider, predictedBy). validate() checks required FKs, optional EnsembleValueObject + PercentileValueObject. ManyToOne → PredictionType, ManyToOne → Simulation, OneToMany → PredictionResult.
- [x] T010 [P] Create PredictionResult entity in src/app/domain/entities/prediction-result.entity.ts — fields: id (bigint PK auto-increment), predictionId (UUID FK NOT NULL), date (timestamp NOT NULL), value (double precision NOT NULL), flag (integer default 0), createdAt (timestamp). NO updatedAt (immutable). ManyToOne → Prediction, OneToMany → Notification. validate() checks predictionId, date, value required.
- [x] T011 [P] Create Notification entity in src/app/domain/entities/notification.entity.ts — extends BaseAuditEntity, implements IValidable, fields per data-model.md (id UUID PK, stationId UUID NOT NULL, predictionResultId bigint FK, identifierId UUID default, thresholdValue double NOT NULL, actualValue double NOT NULL, status enum PENDING/VERIFIED, resultOfPrediction enum FULFILLED/NOT_FULFILLED/UNDEFINED, isRead boolean default false). ManyToOne → PredictionResult. validate() checks required fields.

### Results

- [x] T012 [P] Create PredictionTypeResult in src/app/domain/results/prediction-type.result.ts
- [x] T013 [P] Create SimulationResult in src/app/domain/results/simulation.result.ts — includes all simulation fields + optional predictionCount summary
- [x] T014 [P] Create PredictionResult (result DTO) in src/app/domain/results/prediction.result.ts — includes prediction fields + optional nested results
- [x] T015 [P] Create PredictionResultResult in src/app/domain/results/prediction-result.result.ts — id, predictionId, date, value, flag
- [x] T016 [P] Create NotificationResult in src/app/domain/results/notification.result.ts — all notification fields

### Ports

- [x] T017 [P] Create IPredictionTypeRepository port in src/app/domain/ports/prediction-type-repository.port.ts — abstract class with: create, findById, findByName, findAll, findOrCreateByName
- [x] T018 [P] Create ISimulationRepository port in src/app/domain/ports/simulation-repository.port.ts — abstract class with: create, findById, findByDate, findByDateAndEnvAndModmeteo, findLatestFinalized, findAll (paginated + filterable), findHistorical (grouped by date), update, findAvailableDates
- [x] T019 [P] Create IPredictionRepository port in src/app/domain/ports/prediction-repository.port.ts — abstract class with: create, findById, findByStationId (filterable), findBySimulationId, findByProviderAndDate, findLatestByEnsemble, findMaxAndLatestValues, findByUniqueConstraint
- [x] T020 [P] Create IPredictionResultRepository port in src/app/domain/ports/prediction-result-repository.port.ts — abstract class with: bulkCreate, findByPredictionId (date range), findByPredictionIds
- [x] T021 [P] Create INotificationRepository port in src/app/domain/ports/notification-repository.port.ts — abstract class with: create, findById, findAll (paginated + filterable by status, stationId, isRead), update
- [x] T022 [P] Create IStationThresholdService port in src/app/domain/ports/station-threshold-service.port.ts — abstract class with: getThreshold(stationId: string): Promise<number | null>

### Repositories

- [x] T023 [P] Implement PredictionTypeRepository in src/app/infrastructure/persistence/prediction-type.repository.ts — uses @InjectRepository(PredictionType), wraps in RepositoryError, implements findOrCreateByName with upsert logic
- [x] T024 [P] Implement SimulationRepository in src/app/infrastructure/persistence/simulation.repository.ts — paginated queries with QueryBuilder, filterable by status/date/modmeteo/environment, findHistorical with GROUP BY simulationDate, findAvailableDates with DISTINCT
- [x] T025 [P] Implement PredictionRepository in src/app/infrastructure/persistence/prediction.repository.ts — complex queries: findByStationId with date range + type + predictedBy filters, findLatestByEnsemble with subquery, findMaxAndLatestValues with aggregation, findByUniqueConstraint for idempotency
- [x] T026 [P] Implement PredictionResultRepository in src/app/infrastructure/persistence/prediction-result.repository.ts — bulkCreate using createQueryBuilder().insert().values([...]).execute(), findByPredictionId with date range
- [x] T027 [P] Implement NotificationRepository in src/app/infrastructure/persistence/notification.repository.ts — paginated + filterable (status, stationId, isRead)

### Station Threshold Service

- [x] T028 Implement StationThresholdService in src/app/infrastructure/services/station-threshold.service.ts — implements IStationThresholdService, injects ICacheService + HydroApiConfigService, getThreshold(): check Redis (key "station-threshold:{stationId}", TTL from config), on miss → HTTP GET to hydro-api/stations/{stationId} → extract umbral → cache → return. On HTTP error → log warning, return null.

### Migrations

- [x] T029 Create migration for prediction_types table in src/migrations/ — id UUID PK, name varchar(100) UNIQUE NOT NULL, unit varchar(20) NOT NULL, createdAt, updatedAt. Seed initial values (Precipitation_forecast/mm, Discharge_forecast/m3s, Precipitation/mm, Discharge/m3s).
- [x] T030 Create migration for simulations table in src/migrations/ — all fields per data-model.md, CREATE TYPE for status and type enums, UNIQUE constraint on (simulationDate, environment, modmeteo), indexes on (simulationDate) and (status, createdAt)
- [x] T031 Create migration for predictions table in src/migrations/ — all fields per data-model.md, FKs to prediction_types and simulations, UNIQUE constraint on (simulationId, stationId, predictionTypeId, ensemble, percentile), all indexes per data-model.md
- [x] T032 Create migration for prediction_results table in src/migrations/ — id BIGSERIAL PK, predictionId UUID FK ON DELETE CASCADE, date TIMESTAMP NOT NULL, value DOUBLE PRECISION NOT NULL, flag INTEGER DEFAULT 0, createdAt TIMESTAMP. Composite index on (predictionId, date), index on (date, createdAt). NO updatedAt column.
- [x] T033 Create migration for notifications table in src/migrations/ — all fields per data-model.md, CREATE TYPE for status and resultOfPrediction enums, FK to prediction_results ON DELETE CASCADE, indexes per data-model.md

### Module Registration

- [x] T034 Register all new entities in TypeOrmModule.forFeature([...]) in src/app/infrastructure/infrastructure.module.ts — PredictionType, Simulation, Prediction, PredictionResult, Notification. Bind all ports: IPredictionTypeRepository, ISimulationRepository, IPredictionRepository, IPredictionResultRepository, INotificationRepository, IStationThresholdService. Import HydroApiConfigModule.
- [x] T035 Add cache keys to src/app/infrastructure/cache/cache-config.registry.ts — SimulationCacheKeys (list, latest, byDate, availableDates, pattern), PredictionCacheKeys (historicalByStation, maxAndLatest, pattern), NotificationCacheKeys (list, pattern). Register in CACHE_REGISTRY for all query classes.

**Checkpoint**: Foundation ready — all entities, ports, repos, migrations, cache keys in place. User story implementation can now begin.

---

## Phase 3: User Story 1 — Ingest Prediction Data from Message Queue (Priority: P1) 🎯 MVP

**Goal**: Consume normalized time series from RabbitMQ, persist as Simulation → Prediction → PredictionResults, generate notifications on threshold breach.

**Independent Test**: Dispatch ProcessTimeSeriesCommand directly in tests (mock RabbitMQ), verify all records created in DB.

### Implementation for User Story 1

- [x] T036 [US1] Create ProcessTimeSeriesCommand + ProcessTimeSeriesHandler in src/app/application/commands/prediction.commands.ts — receives single series data + metadata (providerConfigId, providerName, providerType). Handler: 1) findOrCreate PredictionType by parameterId, 2) findOrCreate Simulation by simulationDate+env+modmeteo (reject if FINALIZED), 3) check idempotency via unique constraint, 4) create Prediction, 5) bulk insert PredictionResults (skip isMissing events), 6) get threshold via IStationThresholdService, 7) if max(value) > threshold → create Notification. Invalidate cache keys.
- [x] T037 [US1] Create TimeSeriesIngestedConsumer in src/app/application/consumers/timeseries-ingested.consumer.ts — @EventPattern(Topics.MODEL_EVENTS.routingKeys.TIMESERIES_INGESTED), receives full message payload, for each series in timeSeries[] dispatches ProcessTimeSeriesCommand via CommandBus, ack on all success, nack(requeue) on failure.
- [x] T038 [US1] Register ProcessTimeSeriesHandler in src/app/application/application.module.ts providers, register TimeSeriesIngestedConsumer in controllers
- [x] T039 [US1] Update src/main.ts — register topic consumer transport for model-events exchange if RABBITMQ_ENABLED, similar to existing queue transport but for topic exchange

### Tests for User Story 1

- [x] T040 [US1] Create test/factories/simulation.factory.ts — buildProcessTimeSeriesData() that generates valid series data with random stationId, parameterId, forecastDate, events[]
- [x] T041 [US1] Create test/factories/prediction.factory.ts — buildBatchIngestDto() for batch endpoint testing (reusable in US5)
- [x] T042 [US1] Create e2e test test/modules/predictions/process-timeseries.e2e-spec.ts — test ProcessTimeSeriesCommand via CommandBus dispatch (not RabbitMQ). Tests: 1) process valid series creates PredictionType+Simulation+Prediction+Results, 2) duplicate message is idempotent, 3) isMissing events are skipped, 4) threshold exceeded creates Notification, 5) threshold not exceeded creates no Notification, 6) invalid data returns error. Mock IStationThresholdService and IMessageBroker.

**Checkpoint**: Data ingestion pipeline fully functional. Can process messages and persist all records.

---

## Phase 4: User Story 2 — Query Simulations (Priority: P2)

**Goal**: REST endpoints for listing, filtering, and inspecting simulations. Manual finalize endpoint.

**Independent Test**: Create simulations via ProcessTimeSeriesCommand, then query/filter/finalize via REST.

### Implementation for User Story 2

- [x] T043 [P] [US2] Create SimulationResult mapping and all simulation DTOs in src/app/api/dtos/simulation.dtos.ts — ListSimulationsQueryDto (status, startDate, endDate, modmeteo, environment, page, limit), ListSimulationsResponseDto, GetSimulationByDateResponseDto, LatestSimulationResponseDto, HistoricalSimulationsResponseDto, FinalizeSimulationResponseDto
- [x] T044 [P] [US2] Create simulation mappers in src/app/application/mappers/simulation.mappers.ts — ListSimulationsMapper, GetSimulationByDateMapper, LatestSimulationMapper, HistoricalSimulationsMapper, FinalizeSimulationMapper
- [x] T045 [US2] Create simulation queries in src/app/application/queries/simulation.queries.ts — ListSimulationsQuery+Handler (paginated, filterable), GetSimulationByDateQuery+Handler, GetLatestSimulationQuery+Handler, GetHistoricalSimulationsQuery+Handler, GetAvailableDatesQuery+Handler
- [x] T046 [US2] Create FinalizeSimulationCommand+Handler in src/app/application/commands/simulation.commands.ts — validates simulation exists and is in IN_PROGRESS status, calls simulation.finalize(), updates via repository, invalidates cache
- [x] T047 [US2] Create SimulationController in src/app/api/controllers/simulation.controller.ts — GET /simulations (list), GET /simulations/latest, GET /simulations/historical, GET /simulations/:simulationDate, PATCH /simulations/:id/finalize. All with @ApiEndpoint, standard error handling pattern.
- [x] T048 [US2] Register all simulation query handlers + FinalizeSimulationHandler in src/app/application/application.module.ts, register SimulationController

### Tests for User Story 2

- [x] T049 [US2] Create e2e test test/modules/simulations/query-simulation.e2e-spec.ts — Tests: 1) list simulations returns paginated results, 2) filter by status, 3) get by simulationDate returns simulation with predictions, 4) get latest returns most recent finalized, 5) finalize simulation changes status, 6) finalize non-IN_PROGRESS returns 409, 7) get non-existent returns 404. Setup: use ProcessTimeSeriesCommand to create test data.

**Checkpoint**: Simulation query API fully functional.

---

## Phase 5: User Story 3 — Query Predictions and Time Series (Priority: P3)

**Goal**: REST endpoints for historical predictions, raw by provider, latest by ensemble, available dates, max/latest values.

**Independent Test**: Create predictions via ingestion, then query via all prediction endpoints.

### Implementation for User Story 3

- [x] T050 [P] [US3] Create prediction DTOs in src/app/api/dtos/prediction.dtos.ts — HistoricalPredictionsQueryDto (startDate, endDate, predictionType, predictedBy), HistoricalPredictionsResponseDto, RawPredictionsResponseDto, LatestByEnsembleResponseDto, AvailableDatesResponseDto, MaxAndLatestValuesQueryDto, MaxAndLatestValuesResponseDto
- [x] T051 [P] [US3] Create prediction mappers in src/app/application/mappers/prediction.mappers.ts — HistoricalPredictionsMapper, RawPredictionsMapper, LatestByEnsembleMapper, AvailableDatesMapper, MaxAndLatestValuesMapper
- [x] T052 [US3] Create prediction queries in src/app/application/queries/prediction.queries.ts — GetHistoricalPredictionsQuery+Handler (by stationId, filterable), GetRawPredictionsQuery+Handler (by provider+date), GetLatestByEnsembleQuery+Handler, GetAvailableDatesQuery+Handler, GetMaxAndLatestValuesQuery+Handler
- [x] T053 [US3] Create PredictionController in src/app/api/controllers/prediction.controller.ts — GET /predictions/historical/:stationId, GET /predictions/raw/:provider/:simulationDate, GET /predictions/latest-by-ensemble/:simulationDate, GET /predictions/available-dates, GET /predictions/max-and-latest-values. All with @ApiEndpoint.
- [x] T054 [US3] Register all prediction query handlers in src/app/application/application.module.ts, register PredictionController

### Tests for User Story 3

- [x] T055 [US3] Create e2e test test/modules/predictions/query-prediction.e2e-spec.ts — Tests: 1) historical by stationId returns time series, 2) filter by date range, 3) filter by predictionType, 4) raw by provider returns correct subset, 5) latest by ensemble returns one per ensemble, 6) available dates returns distinct dates, 7) max-and-latest-values returns aggregated data, 8) empty results for non-existent station (200, not 404). Setup: use ProcessTimeSeriesCommand to create test data.

**Checkpoint**: Prediction query API fully functional.

---

## Phase 6: User Story 4 — Threshold Alerts and Notifications (Priority: P4)

**Goal**: REST endpoints for listing, verifying, and marking notifications as read.

**Independent Test**: Ingest data that exceeds threshold, verify notification created, then query/verify/mark-read via REST.

### Implementation for User Story 4

- [x] T056 [P] [US4] Create notification DTOs in src/app/api/dtos/notification.dtos.ts — ListNotificationsQueryDto (status, stationId, isRead, page, limit), ListNotificationsResponseDto, NotificationResponseDto, VerifyNotificationResponseDto, MarkReadResponseDto
- [x] T057 [P] [US4] Create notification mappers in src/app/application/mappers/notification.mappers.ts — ListNotificationsMapper, VerifyNotificationMapper, MarkNotificationReadMapper
- [x] T058 [US4] Create notification queries in src/app/application/queries/notification.queries.ts — ListNotificationsQuery+Handler (paginated, filterable by status/stationId/isRead)
- [x] T059 [US4] Create notification commands in src/app/application/commands/notification.commands.ts — VerifyNotificationCommand+Handler (find by id, check status PENDING, set VERIFIED, invalidate cache), MarkNotificationReadCommand+Handler (find by id, set isRead=true, invalidate cache)
- [x] T060 [US4] Create NotificationController in src/app/api/controllers/notification.controller.ts — GET /notifications (list), PATCH /notifications/:id/verify, PATCH /notifications/:id/read. All with @ApiEndpoint.
- [x] T061 [US4] Register notification handlers + NotificationController in src/app/application/application.module.ts

### Tests for User Story 4

- [x] T062 [US4] Create test/factories/notification.factory.ts — helper to create notification test data via ProcessTimeSeriesCommand with threshold-exceeding values
- [x] T063 [US4] Create e2e test test/modules/notifications/notification.e2e-spec.ts — Tests: 1) notification auto-created when value exceeds threshold, 2) list pending notifications, 3) filter by stationId, 4) verify notification changes status to VERIFIED, 5) verify already-verified returns 409, 6) mark as read, 7) filter by isRead. Mock IStationThresholdService to return known threshold.

**Checkpoint**: Notification system fully functional.

---

## Phase 7: User Story 5 — Batch Ingestion via REST Endpoint (Priority: P5)

**Goal**: POST /simulations/with-predictions endpoint for manual/testing batch ingestion.

**Independent Test**: POST batch request, verify all records created via query endpoints.

### Implementation for User Story 5

- [x] T064 [US5] Create BatchIngestDto in src/app/api/dtos/simulation.dtos.ts — BatchIngestRequestDto (simulationDate, method, modmeteo, environment, type, basin, createdBy, predictions[]: { stationId, stationName, typeName, units, ensemble, percentile, predictionProvider, predictedBy, events[]: { timestamp, value, flag } }), BatchIngestResponseDto
- [x] T065 [US5] Create BatchIngestCommand+Handler in src/app/application/commands/simulation.commands.ts — validates input, creates/finds simulation with type=MANUAL, for each prediction dispatches ProcessTimeSeriesCommand via CommandBus (reuses US1 logic), returns simulation + prediction count
- [x] T066 [US5] Create BatchIngestMapper in src/app/application/mappers/simulation.mappers.ts — maps BatchIngestRequestDto to BatchIngestCommand, maps result to BatchIngestResponseDto
- [x] T067 [US5] Add POST /simulations/with-predictions endpoint to SimulationController in src/app/api/controllers/simulation.controller.ts — @ApiEndpoint with body BatchIngestRequestDto, response 201
- [x] T068 [US5] Register BatchIngestHandler in src/app/application/application.module.ts

### Tests for User Story 5

- [x] T069 [US5] Create e2e test test/modules/simulations/batch-ingest.e2e-spec.ts — Tests: 1) batch ingest creates simulation + predictions + results (201), 2) batch with invalid simulationDate returns 400, 3) batch with empty predictions array returns 400, 4) batch ingest triggers notification on threshold breach, 5) batch with 50 predictions processes all correctly. Uses buildBatchIngestDto() from T041.

**Checkpoint**: Batch ingestion endpoint fully functional.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Build verification, lint, full test suite run

- [x] T070 Run `npm run lint` and fix any linting errors across all new files
- [x] T071 Run `npm run build` and fix any TypeScript compilation errors
- [x] T072 Run `npm run test:e2e` and verify all tests pass (existing + new)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Phase 2 — MVP, must complete first
- **US2 (Phase 4)**: Depends on Phase 2 + uses ProcessTimeSeriesCommand from US1 for test data setup
- **US3 (Phase 5)**: Depends on Phase 2 + uses ProcessTimeSeriesCommand from US1 for test data setup
- **US4 (Phase 6)**: Depends on Phase 2 + US1 (notification creation logic lives in ProcessTimeSeriesHandler)
- **US5 (Phase 7)**: Depends on Phase 2 + US1 (reuses ProcessTimeSeriesCommand)
- **Polish (Phase 8)**: Depends on all previous phases

### User Story Dependencies

- **US1 (P1)**: Independent after Phase 2. MVP.
- **US2 (P2)**: Can start after Phase 2. Uses US1 command for test setup only.
- **US3 (P3)**: Can start after Phase 2. Uses US1 command for test setup only.
- **US4 (P4)**: Depends on US1 notification logic in ProcessTimeSeriesHandler.
- **US5 (P5)**: Depends on US1 command (reuses it internally).

### Within Each User Story

- DTOs + Mappers can run in parallel [P]
- Queries/Commands depend on DTOs + Mappers
- Controllers depend on Queries/Commands
- Module registration depends on all above
- Tests run after full story implementation

### Parallel Opportunities

- Phase 2: All value objects (T004-T006) in parallel, all entities (T007-T011) in parallel, all results (T012-T016) in parallel, all ports (T017-T022) in parallel, all repositories (T023-T027) in parallel, migrations (T029-T033) sequential
- Phase 3+: DTOs and Mappers within a story can run in parallel [P]
- US2 and US3 can run in parallel after US1 completes

---

## Parallel Example: Phase 2 Foundation

```bash
# Wave 1: Value Objects (all parallel)
T004: SimulationDateValueObject
T005: EnsembleValueObject
T006: PercentileValueObject

# Wave 2: Entities (all parallel, depend on VOs)
T007: PredictionType entity
T008: Simulation entity
T009: Prediction entity
T010: PredictionResult entity
T011: Notification entity

# Wave 3: Results + Ports (all parallel)
T012-T016: Results (parallel)
T017-T022: Ports (parallel)

# Wave 4: Repositories (all parallel, depend on entities + ports)
T023-T027: Repositories (parallel)
T028: StationThresholdService

# Wave 5: Migrations (sequential — FK dependencies)
T029 → T030 → T031 → T032 → T033

# Wave 6: Module registration + cache keys
T034 + T035
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T003)
2. Complete Phase 2: Foundational (T004-T035)
3. Complete Phase 3: User Story 1 (T036-T042)
4. **STOP and VALIDATE**: Run e2e tests, verify ingestion works end-to-end
5. Deploy if ready — service can consume messages and store data

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. US1 → Test independently → Deploy (MVP — data flows in!)
3. US2 → Test independently → Deploy (dashboard can query simulations)
4. US3 → Test independently → Deploy (dashboard can query predictions/time series)
5. US4 → Test independently → Deploy (operators get threshold alerts)
6. US5 → Test independently → Deploy (manual batch ingestion available)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- All tests use Testcontainers (real Postgres), mock only IMessageBroker, ICacheService, and IStationThresholdService
- Factory functions generate unique test data per invocation (random UUIDs, timestamps)
- PredictionResult uses bigint PK (not UUID) for high-volume performance
- ProcessTimeSeriesCommand is the central workhorse — US1 implements it, US5 reuses it
- Migrations must run in order due to FK dependencies
