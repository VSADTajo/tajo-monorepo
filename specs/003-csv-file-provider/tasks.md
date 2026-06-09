# Tasks: CSV File Provider for FlowCast Historical Data Ingestion

**Input**: Design documents from `/specs/003-csv-file-provider/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: Included — project requires integration testing through endpoints (Constitution Principle V).

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Enum extension and type support for CSV_FILE provider

- [x] T001 Add `CSV_FILE = 'CSV_FILE'` to ProviderType enum in `src/app/domain/types/provider-type.enum.ts`
- [x] T002 Verify ProviderTypeValueObject validates CSV_FILE (no code change needed — uses `Object.values(ProviderType)` dynamically). Run existing tests to confirm.

**Checkpoint**: `CSV_FILE` is a valid provider type. Existing tests still pass.

---

## Phase 2: Foundational (Core Parser)

**Purpose**: The CSV multi-block parser — the core logic that all user stories depend on

**CRITICAL**: No user story is functional until this phase is complete

- [x] T003 Create `CsvFileProviderService` class skeleton implementing `IDataProvider` in `src/app/infrastructure/services/csv-file-provider.service.ts`. Inject Logger and SftpApiConfigService. Implement `fetch(config)` method signature returning `Promise<NormalizedTimeSeriesResult[]>`.
- [x] T004 Implement file listing logic in `CsvFileProviderService.fetch()`: call ms-sftp-api `GET /files` with directory from `config.settings.filePath`, filter results by `config.settings.filePrefix` (case-insensitive) and `.csv` extension. Follow same pattern as `SftpFileProviderService` lines 26-35.
- [x] T005 Implement file download logic in `CsvFileProviderService.fetch()`: for each matching file, call ms-sftp-api `GET /files/download` with `responseType: 'arraybuffer'`. Decode response using `new TextDecoder('iso-8859-1')`.
- [x] T006 Implement `parseCsvBlocks(content: string): CsvStationBlock[]` private method in `CsvFileProviderService`. Parse multi-block format: detect block start by `"Station Site:"` prefix, collect 15 tab-separated header lines, collect data lines until next block or EOF. Define `CsvStationBlock` and `CsvEvent` interfaces at top of file per data-model.md.
- [x] T007 Implement `parseDataLine(line: string): CsvEvent | null` private method in `CsvFileProviderService`. Parse `DD/MM/YYYY;HH:MM:SS;value` format: split by `;`, convert date from DD/MM/YYYY to YYYY-MM-DD, combine to ISO 8601 timestamp, handle `"---"` as missing (value=0, isMissing=true), handle non-numeric values as missing, return null for malformed lines.
- [x] T008 Implement `mapBlockToNormalized(block: CsvStationBlock): NormalizedTimeSeriesResult` private method in `CsvFileProviderService`. Map fields per data-model.md: stationNumber→locationId, parameterType+".historical"→parameterId, "FlowCast"→moduleInstanceId, timeStep from parameterType (Q→{MINUTE,15}, Precip→{MINUTE,60}), first/last event→forecastDate/startDate/endDate.
- [x] T009 Implement file move logic in `CsvFileProviderService.fetch()`: after successful processing, call ms-sftp-api `POST /files/move` to move file to `{directory}/historial/{filename}`. Follow same pattern as `SftpFileProviderService` lines 63-69.
- [x] T010 Add per-file and per-block error handling in `CsvFileProviderService`: wrap each file download/parse in try-catch (skip file on error, log warning, continue), wrap each block parse in try-catch (skip corrupted block, log warning, continue). Use `ProviderError` for global failures (e.g., list endpoint unreachable).
- [x] T011 Add structured logging to `CsvFileProviderService`: log file count found, blocks parsed per file, events processed per block, blocks skipped due to errors, total series returned.

**Checkpoint**: `CsvFileProviderService` can parse a Tagus_FlowCast.csv file and return `NormalizedTimeSeriesResult[]`.

---

## Phase 3: User Story 1+4 — Automated Ingestion & Downstream Availability (Priority: P1) MVP

**Goal**: CSV files are automatically ingested on schedule and historical data is queryable downstream.

**Independent Test**: Upload a sample CSV to SFTP, trigger ingestion, verify data appears in ms-predictions-api historical endpoint.

### Implementation for User Story 1+4

- [x] T012 [US1] Register `CsvFileProviderService` as provider in `src/app/infrastructure/infrastructure.module.ts` — add to `providers` array and `exports` array.
- [x] T013 [US1] Add `CsvFileProviderService` to `DataProviderFactoryService` constructor and add `case ProviderType.CSV_FILE` in switch statement in `src/app/infrastructure/services/data-provider-factory.service.ts`.
- [x] T014 [US1] Verify build compiles with `npm run build` — fix any TypeScript errors.
- [x] T015 [US1] Update test factory: add `buildCreateCsvProviderConfigDto()` helper in `test/factories/provider-config.factory.ts` with type `CSV_FILE`, settings `{ filePath: '/test/csv', filePrefix: 'Tagus_FlowCast' }`.
- [x] T016 [US1] Create E2E test `test/modules/provider-config/csv-ingestion.e2e-spec.ts`: mock `CsvFileProviderService.fetch()` to return sample NormalizedTimeSeriesResult with parameterId `Q.historical`, verify ingestion run completes with SUCCESS status, verify message broker `publishToTopic` called with correct payload.
- [x] T017 [US1] Run full test suite with `npm run test:e2e` — all existing and new tests must pass.

**Checkpoint**: CSV_FILE provider is fully wired, builds, and passes E2E tests. Ingested data publishes to RabbitMQ with `Q.historical` / `Precip.historical` parameter IDs.

---

## Phase 4: User Story 2+3 — Manual Trigger & Configuration (Priority: P2)

**Goal**: Operators can create CSV_FILE provider configs and manually trigger ingestion.

**Independent Test**: Create a CSV_FILE provider config via POST, trigger ingestion via POST, verify run tracked.

### Implementation for User Story 2+3

- [x] T018 [US2] Verify existing `POST /provider-configs` endpoint accepts `type: "CSV_FILE"` — this should work automatically since ProviderType enum was updated in T001. Run existing provider config creation test with CSV_FILE type override.
- [x] T019 [US2] Verify existing `POST /provider-configs/:id/trigger` endpoint triggers CSV ingestion — the ExecuteIngestionHandler uses DataProviderFactoryService which now resolves CSV_FILE. Add a test case to the E2E spec from T016.
- [x] T020 [US2] Verify scheduler registers polling job when CSV_FILE provider is activated — existing ProviderSchedulerService handles this generically. No code changes expected.

**Checkpoint**: Full provider lifecycle works: create config → activate → scheduled polling + manual trigger.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Final verification, cleanup, and build validation

- [x] T021 Run `npm run lint` and fix any linting issues in new/modified files
- [x] T022 Run `npm run build` — verify clean production build with zero errors
- [x] T023 Run `npm run test:e2e` — verify all tests pass (existing + new)
- [x] T024 Verify quickstart.md steps work against the built application
- [x] T025 Review CsvFileProviderService for any hardcoded values, missing error handling, or logging gaps

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (enum must exist before service references it)
- **User Story 1+4 (Phase 3)**: Depends on Phase 2 (parser must exist before wiring)
- **User Story 2+3 (Phase 4)**: Depends on Phase 3 (provider must be registered before config/trigger works)
- **Polish (Phase 5)**: Depends on all phases complete

### Within Phases

- Phase 2: T003→T004→T005→T006→T007→T008→T009→T010→T011 (sequential — all in same file)
- Phase 3: T012 and T013 are [P] (different files), T014 depends on both, T015-T017 sequential
- Phase 4: T018, T019, T020 are verification tasks — sequential

### Parallel Opportunities

- T012 + T013 can run in parallel (infrastructure.module.ts vs data-provider-factory.service.ts)
- T015 can run in parallel with T012+T013 (test factory is a different file)

---

## Parallel Example: Phase 3

```bash
# These can run in parallel (different files):
Task T012: "Register CsvFileProviderService in infrastructure.module.ts"
Task T013: "Add CSV_FILE case to DataProviderFactoryService"
Task T015: "Create CSV provider config test factory"
```

---

## Implementation Strategy

### MVP First (Phase 1 + 2 + 3)

1. Complete Phase 1: Add CSV_FILE to enum
2. Complete Phase 2: Build the parser (CsvFileProviderService)
3. Complete Phase 3: Wire up, build, test
4. **STOP and VALIDATE**: `npm run build && npm run test:e2e`
5. Push to main if green

### Incremental Delivery

1. Phase 1+2+3 → MVP: CSV files can be ingested and data flows to predictions
2. Phase 4 → Verification: Config and trigger lifecycle confirmed
3. Phase 5 → Polish: Clean build, all tests green, lint clean

---

## Notes

- No new database migrations needed — reuses existing ProviderConfig and IngestionRun tables
- No changes to ms-predictions-api — `Q.historical` matches `%historical%` filter
- The parser (Phase 2) is the bulk of new code (~200-300 lines in one file)
- All other changes are small wiring tasks (1-5 lines each)
- Push to main after build + test pass (per user requirement)
