# Tasks: GeoServer Data Sync

**Input**: Design documents from `/specs/003-geoserver-sync/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/sync.contract.md, quickstart.md

**Tests**: Included — E2E tests with two Testcontainers (hydro-api DB + GeoServer PostGIS DB).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: GeoServer DB configuration and connection setup

- [x] T001 [P] Create GeoServer config type in `src/configuration/geoserver/geoserver-config.type.ts`
- [x] T002 [P] Create GeoServer config registration with env var validator in `src/configuration/geoserver/geoserver-config.ts`
- [x] T003 [P] Create GeoServer config service in `src/configuration/geoserver/geoserver-config.service.ts`
- [x] T004 Create GeoServer config module in `src/configuration/geoserver/geoserver-config.module.ts`
- [x] T005 Add `'geoserver-database': GeoserverDbConfig` to AllConfig in `src/configuration/configuration.type.ts`
- [x] T006 Add GEOSERVER_DB_* environment variables to `.env.example`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Migration, enum expansion, entity updates, and GeoServer DB provider — MUST complete before ANY user story

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T007 Create migration to recreate station_type_enum with 7 values, drop UNIQUE on subBasinName, add new columns to stations and sub_basins in `src/migrations/1771556000000-add-geoserver-fields.ts`
- [x] T008 Replace StationType enum with 7 GeoServer types in `src/app/domain/types/station-type.enum.ts`
- [x] T009 Create zona/tipoCod mapping utilities (zonaToBasinCode, zonaToBasinName, tipoCodToStationType) in `src/app/domain/types/geoserver-mappings.ts`
- [x] T010 [P] Add municipio, provincia, ccaa, tipoCod columns to Station entity and remove UNIQUE from subBasinName in `src/app/domain/entities/station.entity.ts`
- [x] T011 [P] Add area, perimetro, centroidX, centroidY columns to SubBasin entity in `src/app/domain/entities/sub-basin.entity.ts`
- [x] T012 [P] Create read-only GeoPuntoSaih entity mapping cht_puntos_saih in `src/app/domain/entities/geo-punto-saih.entity.ts`
- [x] T013 [P] Create read-only GeoSubcuenca entity mapping cht_subcuencas in `src/app/domain/entities/geo-subcuenca.entity.ts`
- [x] T014 Create GeoServer database provider module with named connection 'geoserver' in `src/app/infrastructure/persistence/geoserver-database-provider.module.ts`
- [x] T015 Create IGeoserverRepository port (abstract class) with findAllStationsWithSubcuenca, findAllSubcuencas, findAllSubcuencaZonaMappings in `src/app/domain/ports/geoserver-repository.port.ts`
- [x] T016 Implement GeoserverRepository with @InjectDataSource('geoserver') and raw SQL spatial joins (ST_Contains, ST_X, ST_Y) in `src/app/infrastructure/persistence/geoserver.repository.ts`
- [x] T017 Import GeoserverDatabaseProviderModule and bind IGeoserverRepository → GeoserverRepository in `src/app/infrastructure/infrastructure.module.ts`

**Checkpoint**: Foundation ready — GeoServer connection established, migration ready, entities updated

---

## Phase 3: User Story 1 - Sync Geographic Reference Data (Priority: P1) 🎯 MVP

**Goal**: Administrator triggers POST /sync/geoserver and all 254 stations, 119 sub-basins, and 11 basins are created/updated from GeoServer data

**Independent Test**: Call POST /sync/geoserver → verify counts. Call GET /basins, GET /sub-basins, GET /stations → verify records exist with correct data.

### Tests for User Story 1 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T018 [US1] Create GeoServer test helper that spins up a PostGIS Testcontainer, creates cht_puntos_saih and cht_subcuencas tables, and seeds sample data (3 stations, 2 subcuencas, 2 zonas) in `test/helpers/geoserver-test.helper.ts`
- [x] T019 [US1] Create E2E test for POST /sync/geoserver: first sync creates records, re-sync updates, umbral preserved in `test/modules/sync/sync-geoserver.e2e-spec.ts`

### Implementation for User Story 1

- [x] T020 [P] [US1] Create SyncGeoserverResult in `src/app/domain/results/sync.results.ts`
- [x] T021 [P] [US1] Create SyncGeoserverResponseDto with @ApiProperty in `src/app/api/dtos/sync.dtos.ts`
- [x] T022 [P] [US1] Create SyncMapper (result → responseDto) in `src/app/application/mappers/sync.mappers.ts`
- [x] T023 [US1] Create SyncGeoserverCommand + SyncGeoserverHandler with full sync logic (read GeoServer → upsert basins → upsert sub-basins → upsert stations → invalidate caches → return summary) in `src/app/application/commands/sync.commands.ts`
- [x] T024 [US1] Create SyncController with POST /sync/geoserver endpoint in `src/app/api/controllers/sync.controller.ts`
- [x] T025 [US1] Register SyncGeoserverHandler in providers and SyncController in controllers in `src/app/application/application.module.ts`

**Checkpoint**: POST /sync/geoserver works end-to-end. Basins, sub-basins, and stations are populated from GeoServer.

---

## Phase 4: User Story 2 - View Enriched Station Data (Priority: P2)

**Goal**: Existing station API responses include new geographic fields (municipio, provincia, ccaa, tipoCod) and use new 7-value station types

**Independent Test**: After sync, GET /stations returns items with municipio, provincia, ccaa, tipoCod populated. Filter by new stationType works.

### Tests for User Story 2 ⚠️

- [x] T026 [US2] Add test cases to sync E2E test verifying GET /stations returns enriched fields and new stationType values after sync in `test/modules/sync/sync-geoserver.e2e-spec.ts`

### Implementation for User Story 2

- [x] T027 [P] [US2] Add municipio, provincia, ccaa, tipoCod to all station result classes (CreateStationResult, GetStationResult, ListStationsResult, etc.) in `src/app/domain/results/station.results.ts`
- [x] T028 [P] [US2] Add municipio, provincia, ccaa, tipoCod @ApiProperty to station response DTOs (CreateStationResponseDto, GetStationResponseDto, ListStationsResponseDto) and update stationType enum reference in `src/app/api/dtos/station.dtos.ts`
- [x] T029 [US2] Update station mappers to pass through new fields in toResponseDto and toCommand methods in `src/app/application/mappers/station.mappers.ts`

**Checkpoint**: GET /stations and GET /stations/:id return enriched data with geographic fields and new station types

---

## Phase 5: User Story 3 - Updated Station Classification (Priority: P2)

**Goal**: Station type enum uses 7 domain-specific types; filtering by new types works

**Independent Test**: Create a station with stationType EMBALSE_SAIH via POST, filter via GET /stations?stationType=EMBALSE_SAIH.

> **Note**: The enum change and migration were done in Phase 2 (Foundational). This phase ensures DTOs, validation, and filtering work correctly with the new types.

### Implementation for User Story 3

- [x] T030 [US3] Verify CreateStationRequestDto stationType enum validation accepts all 7 new values and rejects old values in `src/app/api/dtos/station.dtos.ts`
- [x] T031 [US3] Update station commands to handle new stationType values in create/update flows in `src/app/application/commands/station.commands.ts`

**Checkpoint**: All 7 station types work for create, update, list, and filter operations

---

## Phase 6: User Story 4 - View Enriched Sub-Basin Data (Priority: P3)

**Goal**: Sub-basin API responses include area, perimetro, centroidX, centroidY after sync

**Independent Test**: After sync, GET /sub-basins returns items with area and centroid fields populated.

### Tests for User Story 4 ⚠️

- [x] T032 [US4] Add test cases to sync E2E test verifying GET /sub-basins returns enriched fields after sync in `test/modules/sync/sync-geoserver.e2e-spec.ts`

### Implementation for User Story 4

- [x] T033 [P] [US4] Add area, perimetro, centroidX, centroidY to all sub-basin result classes in `src/app/domain/results/sub-basin.results.ts`
- [x] T034 [P] [US4] Add area, perimetro, centroidX, centroidY @ApiProperty to sub-basin response DTOs in `src/app/api/dtos/sub-basin.dtos.ts`
- [x] T035 [US4] Update sub-basin mappers to pass through new fields in `src/app/application/mappers/sub-basin.mappers.ts`

**Checkpoint**: GET /sub-basins and GET /sub-basins/:id return enriched data with geographic metrics

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [x] T036 Run `npm run lint` and fix any linting errors across all new and modified files
- [x] T037 Run `npm run build` and fix any TypeScript compilation errors
- [ ] T038 Run full E2E test suite `npm run test:e2e` to verify no regressions
- [ ] T039 Run quickstart.md validation: start app with GeoServer env vars, call POST /sync/geoserver, verify GET endpoints

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Stories (Phase 3-6)**: All depend on Foundational phase completion
  - US1 (Phase 3) must complete before US2/US3/US4 (data needs to exist to verify enriched responses)
  - US2, US3, US4 can proceed in parallel after US1
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) — No dependencies on other stories
- **User Story 2 (P2)**: Depends on US1 being complete (needs synced data to verify enriched responses)
- **User Story 3 (P2)**: Can start after Foundational (Phase 2) — Independent of other stories
- **User Story 4 (P3)**: Depends on US1 being complete (needs synced data to verify enriched responses)

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Results before DTOs
- DTOs before mappers
- Commands/queries before controllers
- Core implementation before module registration

### Parallel Opportunities

- T001, T002, T003 can run in parallel (Phase 1: separate config files)
- T010, T011, T012, T013 can run in parallel (Phase 2: separate entity files)
- T020, T021, T022 can run in parallel (Phase 3: result, DTO, mapper — separate files)
- T027, T028 can run in parallel (Phase 4: results and DTOs — separate files)
- T033, T034 can run in parallel (Phase 6: results and DTOs — separate files)
- US2 and US4 can be worked on in parallel once US1 is complete

---

## Parallel Example: Phase 2 (Foundational)

```bash
# Launch entity updates in parallel (different files):
Task: "Add columns to Station entity in src/app/domain/entities/station.entity.ts"
Task: "Add columns to SubBasin entity in src/app/domain/entities/sub-basin.entity.ts"
Task: "Create GeoPuntoSaih entity in src/app/domain/entities/geo-punto-saih.entity.ts"
Task: "Create GeoSubcuenca entity in src/app/domain/entities/geo-subcuenca.entity.ts"
```

## Parallel Example: Phase 3 (User Story 1)

```bash
# Launch US1 domain artifacts in parallel (different files):
Task: "Create SyncGeoserverResult in src/app/domain/results/sync.results.ts"
Task: "Create SyncGeoserverResponseDto in src/app/api/dtos/sync.dtos.ts"
Task: "Create SyncMapper in src/app/application/mappers/sync.mappers.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (config files)
2. Complete Phase 2: Foundational (migration, entities, GeoServer connection)
3. Complete Phase 3: User Story 1 (sync endpoint)
4. **STOP and VALIDATE**: Call POST /sync/geoserver, verify GET endpoints show data
5. Deploy if ready — sync is functional

### Incremental Delivery

1. Setup + Foundational → GeoServer connection ready
2. Add User Story 1 → Sync works → Deploy (MVP!)
3. Add User Stories 2+3 → Enriched station responses + new types → Deploy
4. Add User Story 4 → Enriched sub-basin responses → Deploy
5. Polish → Lint, build, full test suite → Final deploy

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- The GeoServer repository uses raw SQL because TypeORM lacks PostGIS spatial join support
- Use ST_X(geom)/ST_Y(geom) to extract lon/lat — NOT xetrs89h30/yetrs89h30 (those are UTM meters)
- Sync preserves existing umbral values — check for non-null before overwriting
- The named TypeORM connection 'geoserver' must use synchronize: false (read-only)
