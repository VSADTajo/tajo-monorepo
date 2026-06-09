# Tasks: Hydrological Reference Data Layer

**Input**: Design documents from `/specs/002-hydro-reference-data/`
**Prerequisites**: plan.md, spec.md, data-model.md, contracts/, quickstart.md, research.md

**Tests**: E2E tests INCLUDED (explicitly requested). Testcontainers + Supertest, same patterns as ms-model-api/ms-sftp-api.

**Organization**: Tasks grouped by user story. Each story is independently testable after Foundational phase.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Shared types, value objects, and enum that all entities depend on

- [x] T001 [P] Create StationType enum in src/app/domain/types/station-type.enum.ts (HYDROLOGICAL, METEOROLOGICAL, PLUVIOMETRIC)
- [x] T002 [P] Create BasinCodeValueObject in src/app/domain/value-objects/basin-code.value-object.ts (trim, uppercase, alphanumeric + hyphens, max 20 chars)
- [x] T003 [P] Create StationCodeValueObject in src/app/domain/value-objects/station-code.value-object.ts (trim, uppercase, alphanumeric + hyphens, max 50 chars)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: All 3 entities, ports, repositories, results, migrations, cache keys, and module registration. MUST complete before any user story.

**⚠️ CRITICAL**: Basin → SubBasin → Station hierarchy means all 3 must exist before any endpoint works.

### Entities (create in dependency order)

- [x] T004 Create Basin entity in src/app/domain/entities/basin.entity.ts — extends BaseAuditEntity, implements IValidable, fields: id, name, code, description, isActive. OneToMany to SubBasin. validate() uses NameValueObject + BasinCodeValueObject.
- [x] T005 Create SubBasin entity in src/app/domain/entities/sub-basin.entity.ts — extends BaseAuditEntity, implements IValidable, fields: id, name, code, basinId, description, isActive. ManyToOne to Basin, OneToMany to Station. validate() uses NameValueObject + BasinCodeValueObject + basinId check.
- [x] T006 Create Station entity in src/app/domain/entities/station.entity.ts — extends BaseAuditEntity, implements IValidable, fields: id, name, subBasinName, stationCode, umbral, stationType, subBasinId, latitude, longitude, altitude, description, isActive. ManyToOne to SubBasin. validate() uses NameValueObject + StationCodeValueObject + subBasinId/subBasinName/stationType checks.

### Results (grouped per domain, all operations in one file)

- [x] T007 [P] Create basin results in src/app/domain/results/basin.results.ts — CreateBasinResult, GetBasinResult (with subBasins array), ListBasinsResult (items + total), UpdateBasinResult, ToggleBasinResult
- [x] T008 [P] Create sub-basin results in src/app/domain/results/sub-basin.results.ts — CreateSubBasinResult, GetSubBasinResult (with stations array), ListSubBasinsResult, UpdateSubBasinResult, ToggleSubBasinResult
- [x] T009 [P] Create station results in src/app/domain/results/station.results.ts — CreateStationResult, GetStationResult, GetStationBySubBasinNameResult, ListStationsResult, UpdateStationResult, ToggleStationResult, UpdateThresholdResult, GetThresholdResult

### Ports (abstract repository classes)

- [x] T010 [P] Create IBasinRepository port in src/app/domain/ports/basin-repository.port.ts — create, findById, findByIdWithSubBasins, findByName, findByCode, findAll (pagination + isActive filter), update
- [x] T011 [P] Create ISubBasinRepository port in src/app/domain/ports/sub-basin-repository.port.ts — create, findById, findByIdWithStations, findByCode, findByNameAndBasinId, findAll (pagination + basinId/isActive filters), update
- [x] T012 [P] Create IStationRepository port in src/app/domain/ports/station-repository.port.ts — create, findById, findBySubBasinName, findByStationCode, findAll (pagination + subBasinId/stationType/isActive filters), update

### Repository implementations

- [x] T013 [P] Implement BasinRepository in src/app/infrastructure/persistence/basin.repository.ts — implements IBasinRepository using TypeORM, RepositoryError wrapping, Logger injection
- [x] T014 [P] Implement SubBasinRepository in src/app/infrastructure/persistence/sub-basin.repository.ts — implements ISubBasinRepository using TypeORM, RepositoryError wrapping, Logger injection
- [x] T015 [P] Implement StationRepository in src/app/infrastructure/persistence/station.repository.ts — implements IStationRepository using TypeORM, RepositoryError wrapping, Logger injection

### Cache keys

- [x] T016 Extend cache-config.registry.ts in src/app/infrastructure/cache/cache-config.registry.ts — add BasinCacheKeys, SubBasinCacheKeys, StationCacheKeys constants and CACHE_REGISTRY entries for all query types

### Migrations (must be sequential: basins → sub_basins → stations)

- [x] T017 Create migration for basins table in src/migrations/ — raw SQL per data-model.md Migration 1
- [x] T018 Create migration for sub_basins table in src/migrations/ — raw SQL per data-model.md Migration 2 (includes station_type_enum creation)
- [x] T019 Create migration for stations table in src/migrations/ — raw SQL per data-model.md Migration 3

### Module registration

- [x] T020 Register all 3 entities, ports, and repositories in src/app/infrastructure/infrastructure.module.ts — add Basin, SubBasin, Station to TypeOrmModule.forFeature, bind IBasinRepository→BasinRepository, ISubBasinRepository→SubBasinRepository, IStationRepository→StationRepository

### Test factories

- [x] T021 [P] Create basin factory in test/factories/basin.factory.ts — buildCreateBasinDto() with unique name/code per call
- [x] T022 [P] Create sub-basin factory in test/factories/sub-basin.factory.ts — buildCreateSubBasinDto(basinId) with unique name/code per call
- [x] T023 [P] Create station factory in test/factories/station.factory.ts — buildCreateStationDto(subBasinId) with unique name/subBasinName/stationCode per call, default stationType HYDROLOGICAL

**Checkpoint**: Foundation ready — all entities, repos, migrations, cache keys registered. User story implementation can begin.

---

## Phase 3: User Story 1 — Station Threshold Lookup for Predictions (Priority: P1) 🎯 MVP

**Goal**: ms-predictions-api can call `GET /stations/:id` and receive `{ ..., "umbral": number | null }`. Also supports lookup by sub-basin name and dedicated threshold endpoints.

**Independent Test**: Create a station via POST (requires basin + sub-basin), then verify GET /stations/:id returns umbral, GET /stations/by-sub-basin-name/:name works, and PUT/GET threshold endpoints work.

### Implementation

- [x] T024 [P] [US1] Create station DTOs in src/app/api/dtos/station.dtos.ts — CreateStationRequestDto, CreateStationResponseDto, GetStationResponseDto, GetStationBySubBasinNameResponseDto, UpdateThresholdRequestDto, UpdateThresholdResponseDto, GetThresholdResponseDto (only DTOs needed for US1 endpoints)
- [x] T025 [P] [US1] Create station queries in src/app/application/queries/station.queries.ts — GetStationByIdQuery+Handler, GetStationBySubBasinNameQuery+Handler, GetStationThresholdQuery+Handler
- [x] T026 [P] [US1] Create station commands (partial) in src/app/application/commands/station.commands.ts — CreateStationCommand+Handler (needed to create test data), UpdateStationThresholdCommand+Handler
- [x] T027 [US1] Create station mappers (partial) in src/app/application/mappers/station.mappers.ts — CreateStationMapper, GetStationByIdMapper, GetStationBySubBasinNameMapper, UpdateThresholdMapper, GetThresholdMapper
- [x] T028 [US1] Create StationController (partial) in src/app/api/controllers/station.controller.ts — POST /stations, GET /stations/:id, GET /stations/by-sub-basin-name/:subBasinName, PUT /stations/:id/threshold, GET /stations/:id/threshold
- [x] T029 [US1] Register station handlers and controller in src/app/application/application.module.ts — add CreateStationHandler, UpdateStationThresholdHandler, GetStationByIdHandler, GetStationBySubBasinNameHandler, GetStationThresholdHandler + StationController

**Note**: US1 also needs basin + sub-basin creation to set up test data. Add minimal basin/sub-basin support:

- [x] T030 [P] [US1] Create basin DTOs (partial) in src/app/api/dtos/basin.dtos.ts — CreateBasinRequestDto, CreateBasinResponseDto
- [x] T031 [P] [US1] Create sub-basin DTOs (partial) in src/app/api/dtos/sub-basin.dtos.ts — CreateSubBasinRequestDto, CreateSubBasinResponseDto
- [x] T032 [P] [US1] Create basin commands (partial) in src/app/application/commands/basin.commands.ts — CreateBasinCommand+Handler
- [x] T033 [P] [US1] Create sub-basin commands (partial) in src/app/application/commands/sub-basin.commands.ts — CreateSubBasinCommand+Handler
- [x] T034 [US1] Create basin mappers (partial) in src/app/application/mappers/basin.mappers.ts — CreateBasinMapper
- [x] T035 [US1] Create sub-basin mappers (partial) in src/app/application/mappers/sub-basin.mappers.ts — CreateSubBasinMapper
- [x] T036 [US1] Create BasinController (partial) in src/app/api/controllers/basin.controller.ts — POST /basins only
- [x] T037 [US1] Create SubBasinController (partial) in src/app/api/controllers/sub-basin.controller.ts — POST /sub-basins only
- [x] T038 [US1] Register basin/sub-basin handlers and controllers in src/app/application/application.module.ts — add CreateBasinHandler, CreateSubBasinHandler + BasinController, SubBasinController

### E2E Tests

- [x] T039 [US1] E2E test: get-station.e2e-spec.ts in test/modules/stations/ — create basin→sub-basin→station, GET /stations/:id with umbral, null umbral, not found 404 (CRITICAL: verify umbral field present)
- [x] T040 [US1] E2E test: get-station-by-sub-basin-name.e2e-spec.ts in test/modules/stations/ — lookup by subBasinName, not found 404
- [x] T041 [US1] E2E test: update-threshold.e2e-spec.ts in test/modules/stations/ — PUT threshold, verify GET reflects change, clear threshold (null), not found 404
- [x] T042 [US1] E2E test: create-station.e2e-spec.ts in test/modules/stations/ — create station, duplicate subBasinName 409, duplicate stationCode 409, invalid subBasinId 404, all stationType values

**Checkpoint**: US1 complete — ms-predictions-api integration point works. `GET /stations/:id` returns `{ umbral: number | null }`.

---

## Phase 4: User Story 2 — Station Management (Priority: P2)

**Goal**: Full CRUD for stations — list with filters/pagination, update, toggle active status.

**Independent Test**: Create stations, list with various filters, update fields, toggle active status.

### Implementation

- [x] T043 [US2] Add remaining station DTOs to src/app/api/dtos/station.dtos.ts — ListStationsRequestDto (query params), ListStationsResponseDto, UpdateStationRequestDto, UpdateStationResponseDto, ToggleStationResponseDto
- [x] T044 [US2] Add station list query to src/app/application/queries/station.queries.ts — ListStationsQuery+Handler (pagination + subBasinId/stationType/isActive filters)
- [x] T045 [US2] Add remaining station commands to src/app/application/commands/station.commands.ts — UpdateStationCommand+Handler, ToggleStationCommand+Handler
- [x] T046 [US2] Add remaining station mappers to src/app/application/mappers/station.mappers.ts — ListStationsMapper, UpdateStationMapper, ToggleStationMapper
- [x] T047 [US2] Add remaining endpoints to StationController in src/app/api/controllers/station.controller.ts — GET /stations (list), PUT /stations/:id, PATCH /stations/:id/toggle
- [x] T048 [US2] Register new station handlers in src/app/application/application.module.ts — ListStationsHandler, UpdateStationHandler, ToggleStationHandler

### E2E Tests

- [x] T049 [US2] E2E test: list-stations.e2e-spec.ts in test/modules/stations/ — list all, filter by subBasinId, stationType, isActive, pagination with total count
- [x] T050 [US2] E2E test: update-station.e2e-spec.ts in test/modules/stations/ — update all fields, not found 404, subBasinName conflict 409, stationCode conflict 409
- [x] T051 [US2] E2E test: toggle-station.e2e-spec.ts in test/modules/stations/ — toggle active→inactive→active, not found 404

**Checkpoint**: US2 complete — full station CRUD operational.

---

## Phase 5: User Story 3 — Basin Management (Priority: P3)

**Goal**: Full CRUD for basins — list with filters, get by ID with sub-basins, update, toggle.

**Independent Test**: Create basins, list with isActive filter, get by ID (verify sub-basins included), update, toggle.

### Implementation

- [x] T052 [US3] Add remaining basin DTOs to src/app/api/dtos/basin.dtos.ts — ListBasinsRequestDto, ListBasinsResponseDto, GetBasinResponseDto (with subBasins array), UpdateBasinRequestDto, UpdateBasinResponseDto, ToggleBasinResponseDto
- [x] T053 [US3] Create basin queries in src/app/application/queries/basin.queries.ts — GetBasinByIdQuery+Handler (with subBasins), ListBasinsQuery+Handler (pagination + isActive filter)
- [x] T054 [US3] Add remaining basin commands to src/app/application/commands/basin.commands.ts — UpdateBasinCommand+Handler, ToggleBasinCommand+Handler
- [x] T055 [US3] Add remaining basin mappers to src/app/application/mappers/basin.mappers.ts — GetBasinByIdMapper, ListBasinsMapper, UpdateBasinMapper, ToggleBasinMapper
- [x] T056 [US3] Add remaining endpoints to BasinController in src/app/api/controllers/basin.controller.ts — GET /basins (list), GET /basins/:id, PUT /basins/:id, PATCH /basins/:id/toggle
- [x] T057 [US3] Register basin handlers in src/app/application/application.module.ts — GetBasinByIdHandler, ListBasinsHandler, UpdateBasinHandler, ToggleBasinHandler

### E2E Tests

- [x] T058 [US3] E2E test: create-basin.e2e-spec.ts in test/modules/basins/ — create basin, duplicate name 409, duplicate code 409, validation errors 400
- [x] T059 [US3] E2E test: list-basins.e2e-spec.ts in test/modules/basins/ — list all, filter by isActive, pagination
- [x] T060 [US3] E2E test: get-basin.e2e-spec.ts in test/modules/basins/ — get with sub-basins included, not found 404
- [x] T061 [US3] E2E test: update-basin.e2e-spec.ts in test/modules/basins/ — update, not found 404, name/code conflict 409
- [x] T062 [US3] E2E test: toggle-basin.e2e-spec.ts in test/modules/basins/ — toggle active→inactive→active, not found 404

**Checkpoint**: US3 complete — full basin CRUD operational.

---

## Phase 6: User Story 4 — SubBasin Management (Priority: P4)

**Goal**: Full CRUD for sub-basins — list with filters, get by ID with stations, update, toggle.

**Independent Test**: Create basin + sub-basins, list with basinId filter, get by ID (verify stations included), update, toggle.

### Implementation

- [x] T063 [US4] Add remaining sub-basin DTOs to src/app/api/dtos/sub-basin.dtos.ts — ListSubBasinsRequestDto, ListSubBasinsResponseDto, GetSubBasinResponseDto (with stations array), UpdateSubBasinRequestDto, UpdateSubBasinResponseDto, ToggleSubBasinResponseDto
- [x] T064 [US4] Create sub-basin queries in src/app/application/queries/sub-basin.queries.ts — GetSubBasinByIdQuery+Handler (with stations), ListSubBasinsQuery+Handler (pagination + basinId/isActive filters)
- [x] T065 [US4] Add remaining sub-basin commands to src/app/application/commands/sub-basin.commands.ts — UpdateSubBasinCommand+Handler, ToggleSubBasinCommand+Handler
- [x] T066 [US4] Add remaining sub-basin mappers to src/app/application/mappers/sub-basin.mappers.ts — GetSubBasinByIdMapper, ListSubBasinsMapper, UpdateSubBasinMapper, ToggleSubBasinMapper
- [x] T067 [US4] Add remaining endpoints to SubBasinController in src/app/api/controllers/sub-basin.controller.ts — GET /sub-basins (list), GET /sub-basins/:id, PUT /sub-basins/:id, PATCH /sub-basins/:id/toggle
- [x] T068 [US4] Register sub-basin handlers in src/app/application/application.module.ts — GetSubBasinByIdHandler, ListSubBasinsHandler, UpdateSubBasinHandler, ToggleSubBasinHandler

### E2E Tests

- [x] T069 [US4] E2E test: create-sub-basin.e2e-spec.ts in test/modules/sub-basins/ — create, invalid basinId 404, duplicate code 409, duplicate name+basinId 409
- [x] T070 [US4] E2E test: list-sub-basins.e2e-spec.ts in test/modules/sub-basins/ — list all, filter by basinId/isActive, pagination
- [x] T071 [US4] E2E test: get-sub-basin.e2e-spec.ts in test/modules/sub-basins/ — get with stations included, not found 404
- [x] T072 [US4] E2E test: update-sub-basin.e2e-spec.ts in test/modules/sub-basins/ — update, not found 404, code conflict 409
- [x] T073 [US4] E2E test: toggle-sub-basin.e2e-spec.ts in test/modules/sub-basins/ — toggle, not found 404

**Checkpoint**: US4 complete — full sub-basin CRUD operational.

---

## Phase 7: User Story 5 — Soft Delete (Priority: P5)

**Goal**: DELETE endpoints for all 3 entities that set `isActive = false` (soft delete). Idempotent.

**Independent Test**: Create entities, DELETE them, verify isActive=false, delete again (idempotent).

### Implementation

- [x] T074 [P] [US5] Add DeleteBasinCommand+Handler to src/app/application/commands/basin.commands.ts — find by ID, set isActive=false, save, invalidate cache
- [x] T075 [P] [US5] Add DeleteSubBasinCommand+Handler to src/app/application/commands/sub-basin.commands.ts — find by ID, set isActive=false, save, invalidate cache
- [x] T076 [P] [US5] Add DeleteStationCommand+Handler to src/app/application/commands/station.commands.ts — find by ID, set isActive=false, save, invalidate cache
- [x] T077 [P] [US5] Add delete DTOs: DeleteBasinResponseDto to basin.dtos.ts, DeleteSubBasinResponseDto to sub-basin.dtos.ts, DeleteStationResponseDto to station.dtos.ts
- [x] T078 [P] [US5] Add delete mappers: DeleteBasinMapper to basin.mappers.ts, DeleteSubBasinMapper to sub-basin.mappers.ts, DeleteStationMapper to station.mappers.ts
- [x] T079 [US5] Add DELETE endpoints: DELETE /basins/:id to BasinController, DELETE /sub-basins/:id to SubBasinController, DELETE /stations/:id to StationController
- [x] T080 [US5] Register delete handlers in src/app/application/application.module.ts — DeleteBasinHandler, DeleteSubBasinHandler, DeleteStationHandler

### E2E Tests

- [x] T081 [US5] E2E test: delete-station.e2e-spec.ts in test/modules/stations/ — soft delete (isActive=false), already inactive (idempotent), not found 404
- [x] T082 [P] [US5] E2E test: delete-basin.e2e-spec.ts in test/modules/basins/ — soft delete, sub-basins remain unchanged, not found 404
- [x] T083 [P] [US5] E2E test: delete-sub-basin.e2e-spec.ts in test/modules/sub-basins/ — soft delete, stations remain unchanged, not found 404

**Checkpoint**: US5 complete — all DELETE endpoints operational with soft delete behavior.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Build validation, lint, and full e2e test run

- [ ] T084 Run `npm run build` and fix any compilation errors
- [ ] T085 Run `npm run lint` and fix any lint issues
- [ ] T086 Run `npm run test:e2e` and verify all tests pass

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (T001-T003) for enum and value objects
- **User Stories (Phase 3-7)**: ALL depend on Foundational (Phase 2) completion
  - US1 (Phase 3): First priority — creates basin/sub-basin commands as part of US1 to enable station creation in tests
  - US2 (Phase 4): Depends on US1 (extends station controller/commands already created)
  - US3 (Phase 5): Depends on US1 (extends basin controller/commands already created)
  - US4 (Phase 6): Depends on US1 (extends sub-basin controller/commands already created)
  - US5 (Phase 7): Depends on US1-US4 (adds delete to all 3 controllers)
- **Polish (Phase 8)**: Depends on all user stories

### User Story Dependencies

- **US1 (P1)**: After Foundational — creates minimal basin/sub-basin support for test data
- **US2 (P2)**: After US1 — extends StationController, station.commands.ts, station.queries.ts
- **US3 (P3)**: After US1 — extends BasinController, basin.commands.ts, basin.queries.ts
- **US4 (P4)**: After US1 — extends SubBasinController, sub-basin.commands.ts, sub-basin.queries.ts
- **US5 (P5)**: After US2+US3+US4 — adds delete commands to all 3 domains

### Within Each User Story

- DTOs and commands/queries can be created in parallel [P]
- Mappers depend on DTOs + commands/queries
- Controller depends on mappers
- Module registration depends on handlers + controllers
- E2E tests depend on all implementation tasks in the story

### Parallel Opportunities

- Phase 1: All 3 tasks (T001-T003) can run in parallel
- Phase 2: Entities must be sequential (T004→T005→T006), but results (T007-T009), ports (T010-T012), repos (T013-T015), factories (T021-T023) can all run in parallel after entities
- Phase 3: T024-T026 and T030-T033 can run in parallel (different files)
- Phase 5+6: US3 and US4 are independent of each other — can run in parallel if staffed
- Phase 7: Delete commands (T074-T076) and DTOs (T077) can run in parallel

---

## Parallel Example: Foundational Phase

```bash
# After entities T004-T006 are complete, launch in parallel:
Task: T007 "Create basin results"
Task: T008 "Create sub-basin results"
Task: T009 "Create station results"
Task: T010 "Create IBasinRepository port"
Task: T011 "Create ISubBasinRepository port"
Task: T012 "Create IStationRepository port"
Task: T013 "Implement BasinRepository"
Task: T014 "Implement SubBasinRepository"
Task: T015 "Implement StationRepository"
Task: T021 "Create basin factory"
Task: T022 "Create sub-basin factory"
Task: T023 "Create station factory"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T003)
2. Complete Phase 2: Foundational (T004-T023)
3. Complete Phase 3: User Story 1 (T024-T042)
4. **STOP and VALIDATE**: Run `npm run test:e2e -- --testPathPattern=stations`
5. ms-predictions-api can now call `GET /stations/:id` and get `{ umbral: number | null }`

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. US1 → Test independently → Deploy (MVP! predictions-api integration works)
3. US2 → Test independently → Deploy (full station CRUD)
4. US3 → Test independently → Deploy (basin management)
5. US4 → Test independently → Deploy (sub-basin management)
6. US5 → Test independently → Deploy (soft delete for all entities)
7. Polish → Full validation → Final deploy

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story
- Each user story is independently testable after its phase completes
- US1 bootstraps minimal basin/sub-basin support (create only) to enable station e2e tests
- US2-US4 extend the controllers/commands already created in US1
- All e2e tests follow Testcontainers + Supertest pattern from 001-user-roles
- Factories generate unique data per call (timestamp + random)
- Cache invalidation must be in every command handler that mutates data
