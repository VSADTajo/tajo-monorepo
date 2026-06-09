# Tasks: Scheduled Path Cleanup Jobs

**Input**: Design documents from `/specs/004-path-cleanup-jobs/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**Organization**: Tasks grouped by user story for independent delivery.
**Tests**: Included in Polish phase only (spec does not request TDD).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: User story the task belongs to
- No [P] = must run after the previous task in the same file

---

## Phase 1: Setup

**Purpose**: Install new dependency and bootstrap the scheduler.

- [ ] T001 Run `npm install @nestjs/schedule` in repo root to add the dynamic cron scheduling package
- [ ] T002 Add `ScheduleModule.forRoot()` to the imports array in `src/app.module.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Domain model, ports, infrastructure, migration, and paths-overview extension — all user stories depend on this phase.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T003 Create `src/app/domain/types/cleanup-frequency.enum.ts` with `CleanupFrequency` enum (EVERY_5_MIN … EVERY_WEEK), `FREQUENCY_CRON_MAP` (enum → cron string), and `FREQUENCY_LABEL_MAP` (enum → human label) as per data-model.md
- [ ] T004 Create `src/app/domain/value-objects/file-extensions.value-object.ts` — validates array has ≥1 item, normalizes each to lowercase with leading dot, deduplicates; throws `EntityError` if empty after normalization
- [ ] T005 Create `src/app/domain/entities/cleanup-job.entity.ts` — extends `BaseAuditEntity`, implements `IValidable`; columns: `directoryPath` (varchar, unique), `extensions` (text[]), `frequency` (varchar), `isActive` (boolean default true), `lastExecutedAt` (timestamptz nullable), `lastExecutionResult` (jsonb nullable), `nextExecutionAt` (timestamptz nullable); `validate()` calls `FileExtensionsValueObject` and checks `frequency` is a valid `CleanupFrequency` enum value
- [ ] T006 Create `src/app/domain/results/cleanup-job.result.ts` with `CleanupJobResult` class holding all entity fields as readonly properties plus `frequencyLabel: string`
- [ ] T007 [P] Create `src/app/domain/ports/cleanup-job-repository.port.ts` — abstract class `ICleanupJobRepository` with methods: `findAll()`, `findAllActive()`, `findById(id)`, `findByDirectoryPath(path)`, `findByDirectoryPaths(paths)`, `create(job)`, `update(job)`, `delete(id)`
- [ ] T008 [P] Create `src/app/domain/ports/cleanup-scheduler.port.ts` — abstract class `ICleanupScheduler` with methods: `scheduleJob(job: CleanupJob): void`, `unscheduleJob(jobId: string): void`, `rescheduleJob(job: CleanupJob): void`, `getNextExecution(frequency: CleanupFrequency): Date`, `isScheduled(jobId: string): boolean`
- [ ] T009 Create `src/app/infrastructure/persistence/cleanup-job.repository.ts` — TypeORM implementation of `ICleanupJobRepository`; `@InjectRepository(CleanupJob)`; all methods wrapped in try/catch throwing `RepositoryError`
- [ ] T010 Create `src/app/infrastructure/services/cleanup-scheduler.service.ts` — implements `ICleanupScheduler` and `OnModuleInit`; constructor injects `SchedulerRegistry`, `ICleanupJobRepository`, and `IFileStorageService`; `onModuleInit()` calls `findAllActive()` and schedules each; `scheduleJob()` creates `new CronJob(FREQUENCY_CRON_MAP[job.frequency], callback)` and calls `schedulerRegistry.addCronJob(job.id, cronJob); cronJob.start()`; execution callback lists directory via `IFileStorageService`, filters by extensions, deletes each file, updates `lastExecutedAt` + `lastExecutionResult` + `nextExecutionAt` via `ICleanupJobRepository.update()`; `getNextExecution()` creates a temporary `CronJob`, calls `nextDate().toJSDate()`, returns result
- [ ] T011 Create migration `src/migrations/XXXXXXXXXXXXXX-CreateCleanupJobTable.ts` with `up()` creating `cleanup_jobs` table (all columns per data-model.md, uuid PK, unique constraint on `directoryPath`) and `down()` dropping it; run `npm run migration:run` to apply
- [ ] T012 Update `src/app/infrastructure/infrastructure.module.ts` — add `CleanupJob` to `TypeOrmModule.forFeature([...])`, bind `{ provide: ICleanupJobRepository, useClass: CleanupJobRepository }` and `{ provide: ICleanupScheduler, useClass: CleanupSchedulerService }` in providers
- [ ] T013 Add `CleanupJobCacheKeys` to `src/app/infrastructure/cache/cache-config.registry.ts`: `byId: (id) => cleanup-job:${id}`, `byPath: (path) => cleanup-job:path:${path}`, `list: () => 'cleanup-job:list'`, `pattern: () => 'cleanup-job:*'`
- [ ] T014 [P] Create `frontend/src/types/cleanup-job.types.ts` with `CleanupFrequency` union type, `CleanupJob` interface, and `CleanupJobInfo` interface (subset shown in paths-overview: id, extensions, frequency, frequencyLabel, isActive, nextExecutionAt)
- [ ] T015 [P] Extend `PathOverview` interface in `frontend/src/types/file.types.ts` to add `cleanupJob: CleanupJobInfo | null`
- [ ] T016 [P] Create `frontend/src/api/cleanup-jobs.api.ts` with `createCleanupJob(dto)`, `updateCleanupJob(id, dto)`, `toggleCleanupJob(id, isActive)`, `deleteCleanupJob(id)`, `getCleanupJobByPath(directoryPath)` functions using `fetch` against `/api/cleanup-jobs`
- [ ] T017 Modify `ListPathsOverviewHandler` in `src/app/application/queries/file.queries.ts` — inject `ICleanupJobRepository`; after building `pathMap`, call `findByDirectoryPaths(absolutePaths)` and attach cleanup job info (`id`, `extensions`, `frequency`, `frequencyLabel`, `isActive`, `nextExecutionAt`) to each matching path entry
- [ ] T018 [P] Add `CleanupJobInfoDto` and `PathCleanupJobInfoDto` to `src/app/api/dtos/file.dtos.ts`; extend `PathOverviewDto` to include `cleanupJob: PathCleanupJobInfoDto | null`
- [ ] T019 Update `ListPathsOverviewMapper.toResponseDto()` in `src/app/application/mappers/file.mappers.ts` to map the new `cleanupJob` field from `IPathOverviewResult` to `PathCleanupJobInfoDto`

**Checkpoint**: Domain model complete, scheduler loads from DB on startup, paths-overview returns `cleanupJob: null` for all paths, migration applied.

---

## Phase 3: User Story 1 — Create a Cleanup Job for a Path (Priority: P1) 🎯 MVP

**Goal**: Administrator clicks the clock icon on a path row, fills in extensions and frequency, saves → job is persisted, scheduled, and visible as Active with next execution time.

**Independent Test**: `POST /api/cleanup-jobs` with valid body → 201 + `isActive: true` + `nextExecutionAt` populated. `GET /api/files/paths-overview` → target path has `cleanupJob` with correct data. Second POST for same path → 409.

- [ ] T020 Add `CreateCleanupJobCommand` + `CreateCleanupJobHandler` to `src/app/application/commands/cleanup-job.commands.ts` — handler validates entity, checks `findByDirectoryPath` returns null (ApiError 409 if exists), saves via repo, calls `ICleanupScheduler.scheduleJob()`, sets `nextExecutionAt = ICleanupScheduler.getNextExecution(job.frequency)`, saves updated entity, returns `CleanupJobResult`
- [ ] T021 [P] Add `CreateCleanupJobRequestDto` (directoryPath, extensions[], frequency) and `CleanupJobResponseDto` to `src/app/api/dtos/cleanup-job.dtos.ts` with `class-validator` decorators and `@ApiProperty`
- [ ] T022 [P] Create `src/app/application/mappers/cleanup-job.mappers.ts` with `CreateCleanupJobMapper.toCommand(dto)` and `toResponseDto(result)`
- [ ] T023 Create `src/app/api/controllers/cleanup-job.controller.ts` with `@Controller('cleanup-jobs')`, `@ApiTags('CleanupJobs')`; add `POST /` endpoint using `@ApiEndpoint`, `CreateCleanupJobMapper`, `CommandBus`
- [ ] T024 Register `CreateCleanupJobHandler` in providers and `CleanupJobController` in controllers of `src/app/application/application.module.ts`
- [ ] T025 Create `frontend/src/hooks/useCleanupJobs.ts` with `useCreateCleanupJob()` mutation (invalidates `['paths-overview']` on success)
- [ ] T026 [US1] Modify `PathCard` in `frontend/src/pages/PathsManagerPage.tsx` — add clock icon button to header row; clicking toggles an inline config panel; panel shows create form (multi-value extensions input + frequency `<select>` + Save/Cancel buttons) when `entry.cleanupJob` is null; on save calls `useCreateCleanupJob`

**Checkpoint**: Create flow fully functional — clock icon → form → POST → job appears Active with next run.

---

## Phase 4: User Story 2 — View Cleanup Job Status per Path (Priority: P2)

**Goal**: Each path row in the panel shows Active/Inactive badge and next execution time for any configured cleanup job, without additional clicks.

**Independent Test**: With an active cleanup job on a path, load `/paths` — the row shows a highlighted clock icon, "Active" badge, and next execution time. A path without a job shows a neutral clock icon.

- [ ] T027 Add `GetCleanupJobByIdQuery` + `GetCleanupJobByIdHandler` and `GetCleanupJobByPathQuery` + `GetCleanupJobByPathHandler` to `src/app/application/queries/cleanup-job.queries.ts` — `byPath` returns `CleanupJobResult | null`
- [ ] T028 [P] Add `GetCleanupJobByPathResponseDto` (nullable wrapper) and `GetCleanupJobByIdResponseDto` to `src/app/api/dtos/cleanup-job.dtos.ts`; add `GetCleanupJobMapper` to `src/app/application/mappers/cleanup-job.mappers.ts`
- [ ] T029 Add `GET /cleanup-jobs/:id` and `GET /cleanup-jobs/by-path?directoryPath=` endpoints to `CleanupJobController` in `src/app/api/controllers/cleanup-job.controller.ts` using `CachingQueryBus`
- [ ] T030 Add cache registry entries in `src/app/infrastructure/cache/cache-config.registry.ts`: `GetCleanupJobByIdQuery` (ttl 60, key: `CleanupJobCacheKeys.byId(q.id)`), `GetCleanupJobByPathQuery` (ttl 60, key: `CleanupJobCacheKeys.byPath(q.path)`)
- [ ] T031 Register `GetCleanupJobByIdHandler` and `GetCleanupJobByPathHandler` in providers of `src/app/application/application.module.ts`
- [ ] T032 [US2] Modify `PathCard` header in `frontend/src/pages/PathsManagerPage.tsx` — when `entry.cleanupJob` is not null, display: highlighted (colored) clock icon, Active/Inactive badge, and next execution time string; when null, display neutral (gray) clock icon

**Checkpoint**: Panel shows cleanup job status at a glance without any additional clicks.

---

## Phase 5: User Story 3 — Toggle Cleanup Job On/Off (Priority: P3)

**Goal**: Administrator can activate/deactivate a cleanup job from the inline panel without deleting it. Toggle is disabled while request is pending.

**Independent Test**: Panel shows toggle switch for configured job → click deactivate → status changes to Inactive, `nextExecutionAt` disappears → click activate → Active + recalculated next run.

- [ ] T033 Add `ToggleCleanupJobCommand` + `ToggleCleanupJobHandler` to `src/app/application/commands/cleanup-job.commands.ts` — finds by id (ApiError 404), sets `isActive`; if activating: `scheduleJob()` + `nextExecutionAt = getNextExecution()`; if deactivating: `unscheduleJob()` + `nextExecutionAt = null`; updates via repo; invalidates cache (`CleanupJobCacheKeys.pattern()` + `FileCacheKeys.pathsOverview()`)
- [ ] T034 [P] Add `ToggleCleanupJobRequestDto` and `ToggleCleanupJobMapper` to `src/app/api/dtos/cleanup-job.dtos.ts` and `src/app/application/mappers/cleanup-job.mappers.ts`
- [ ] T035 Add `PATCH /cleanup-jobs/:id/toggle` endpoint to `CleanupJobController` in `src/app/api/controllers/cleanup-job.controller.ts`
- [ ] T036 Register `ToggleCleanupJobHandler` in providers of `src/app/application/application.module.ts`
- [ ] T037 [US3] Add `useToggleCleanupJob()` mutation to `frontend/src/hooks/useCleanupJobs.ts` (invalidates `['paths-overview']` on success); add toggle switch button inside the inline config panel in `PathCard` in `frontend/src/pages/PathsManagerPage.tsx` — disabled while `isPending`

**Checkpoint**: Toggle preserves config; activation recalculates next execution; deactivation clears it.

---

## Phase 6: User Story 4 — Edit Cleanup Job Configuration (Priority: P4)

**Goal**: Administrator can change extensions and/or frequency of an existing job. Updated schedule takes effect immediately.

**Independent Test**: Panel shows Edit button on existing job → change frequency → save → `nextExecutionAt` updates to reflect new schedule.

- [ ] T038 Add `UpdateCleanupJobCommand` + `UpdateCleanupJobHandler` to `src/app/application/commands/cleanup-job.commands.ts` — finds by id (ApiError 404), updates extensions and/or frequency, validates entity, calls `rescheduleJob()`, updates `nextExecutionAt`, saves; invalidates `CleanupJobCacheKeys.pattern()` + `FileCacheKeys.pathsOverview()`
- [ ] T039 [P] Add `UpdateCleanupJobRequestDto` and `UpdateCleanupJobMapper` to `src/app/api/dtos/cleanup-job.dtos.ts` and `src/app/application/mappers/cleanup-job.mappers.ts`
- [ ] T040 Add `PATCH /cleanup-jobs/:id` endpoint to `CleanupJobController` in `src/app/api/controllers/cleanup-job.controller.ts`
- [ ] T041 Register `UpdateCleanupJobHandler` in providers of `src/app/application/application.module.ts`
- [ ] T042 [US4] Add `useUpdateCleanupJob()` mutation to `frontend/src/hooks/useCleanupJobs.ts` (invalidates `['paths-overview']`); add Edit mode to the inline config panel in `PathCard` (`frontend/src/pages/PathsManagerPage.tsx`) — clicking Edit switches panel to the same form as create, pre-filled with current extensions and frequency; Save calls `useUpdateCleanupJob`; Cancel returns to view mode

**Checkpoint**: Edit flow functional — open panel → edit → save → next run time reflects new schedule.

---

## Phase 7: User Story 5 — Delete Cleanup Job (Priority: P5)

**Goal**: Administrator can permanently delete a cleanup job. Path row returns to neutral clock icon state.

**Independent Test**: Panel shows Delete button → confirm → job deleted → path row returns to neutral clock, GET /:id returns 404.

- [ ] T043 Add `DeleteCleanupJobCommand` + `DeleteCleanupJobHandler` to `src/app/application/commands/cleanup-job.commands.ts` — finds by id (ApiError 404), calls `isScheduled(id)` and `unscheduleJob(id)` if needed, deletes via repo; invalidates `CleanupJobCacheKeys.pattern()` + `FileCacheKeys.pathsOverview()`
- [ ] T044 [P] Add `DeleteCleanupJobResponseDto` (`{ deletedId: string }`) and `DeleteCleanupJobMapper` to `src/app/api/dtos/cleanup-job.dtos.ts` and `src/app/application/mappers/cleanup-job.mappers.ts`
- [ ] T045 Add `DELETE /cleanup-jobs/:id` endpoint to `CleanupJobController` in `src/app/api/controllers/cleanup-job.controller.ts`
- [ ] T046 Register `DeleteCleanupJobHandler` in providers of `src/app/application/application.module.ts`
- [ ] T047 [US5] Add `useDeleteCleanupJob()` mutation to `frontend/src/hooks/useCleanupJobs.ts` (invalidates `['paths-overview']`); add Delete button with inline confirmation (`"Delete job?"` + Confirm/Cancel) to the inline config panel in `PathCard` (`frontend/src/pages/PathsManagerPage.tsx`)

**Checkpoint**: Full CRUD cycle complete — all 5 user stories functional end-to-end.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: E2E test, cache invalidation completeness, manual validation.

- [ ] T048 [P] Create test factory `test/factories/cleanup-job.factory.ts` with `buildCreateCleanupJobDto(directoryPath, overrides?)` helper
- [ ] T049 [P] Create e2e test `test/modules/cleanup-jobs/cleanup-jobs-crud.e2e-spec.ts` — test cases: (a) create job → 201 + isActive + nextExecutionAt, (b) duplicate path → 409, (c) get by id → 200, (d) toggle off → isActive false + nextExecutionAt null, (e) toggle on → isActive true + nextExecutionAt set, (f) update frequency → nextExecutionAt updated, (g) delete → 200 + subsequent GET 404, (h) paths-overview includes cleanupJob data
- [ ] T050 Add `ListCleanupJobsQuery` + `ListCleanupJobsHandler` to `src/app/application/queries/cleanup-job.queries.ts`, add `GET /cleanup-jobs` list endpoint to `CleanupJobController`, add cache entry `ListCleanupJobsQuery` (ttl 30, key: `CleanupJobCacheKeys.list()`), register handler in `application.module.ts`
- [ ] T051 Validate quickstart.md integration scenarios manually against running system (docker compose up → test all 6 quickstart flows)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — **BLOCKS all user stories**
- **Phase 3 (US1)**: Depends on Phase 2
- **Phase 4 (US2)**: Depends on Phase 2 — status display uses paths-overview data from foundational; can start parallel with US1
- **Phase 5 (US3)**: Depends on Phase 3 (needs existing job to toggle) + Phase 4 (toggle UI is inside the panel)
- **Phase 6 (US4)**: Depends on Phase 3 (needs job to edit) + Phase 5 (edit mode in same panel)
- **Phase 7 (US5)**: Depends on Phase 3 (needs job to delete)
- **Phase 8 (Polish)**: Depends on Phase 7

### User Story Dependencies

- **US1 (P1)**: After Phase 2 — no story dependencies
- **US2 (P2)**: After Phase 2 — independent of US1 (data already in paths-overview)
- **US3 (P3)**: After US1 (needs a job to toggle) and US2 (toggle UI is in the view panel)
- **US4 (P4)**: After US1 (needs a job to edit) and US3 (edit mode shares panel with toggle)
- **US5 (P5)**: After US1 (needs a job to delete); can be developed parallel to US3/US4

### Parallel Opportunities

- T007 + T008 can run in parallel (different files)
- T014 + T015 + T016 can run in parallel (different files)
- T021 + T022 can run in parallel (different files)
- T028 can run in parallel with T027
- T034 can run in parallel with T033
- T039 can run in parallel with T038
- T044 can run in parallel with T043
- T048 + T049 can run in parallel

### Same-file Sequencing

- `cleanup-job.commands.ts` (T020 → T033 → T038 → T043) must be sequential
- `cleanup-job.queries.ts` (T027 → T050) must be sequential
- `CleanupJobController` (T023 → T029 → T035 → T040 → T045 → T050) must be sequential
- `application.module.ts` (T024 → T031 → T036 → T041 → T046 → T050) must be sequential
- `PathsManagerPage.tsx` (T026 → T032 → T037 → T042 → T047) must be sequential

---

## Implementation Strategy

### MVP (User Story 1 + minimal US2 display)

1. Phase 1 → Phase 2 → Phase 3 → Phase 4 (US2 display only)
2. **STOP**: Clock icon → create form → save → Active badge + next run time visible
3. Deploy/demo if ready

### Incremental Delivery

1. Phase 1 + 2 → foundation ready (scheduler loads from DB)
2. Phase 3 → create works → demo (MVP!)
3. Phase 4 → view status on panel
4. Phase 5 → toggle on/off
5. Phase 6 → edit configuration
6. Phase 7 → delete job
7. Phase 8 → polished and tested

---

## Notes

- `PathsManagerPage.tsx` accumulates changes across US1–US5 — build incrementally per story (T026 → T032 → T037 → T042 → T047)
- `CleanupSchedulerService.onModuleInit()` is critical — without it, active jobs don't survive restarts
- `ICleanupScheduler.getNextExecution()` creates a temporary `CronJob`, calls `nextDate().toJSDate()`, then discards the job — do not start it
- `unscheduleJob()` must check `isScheduled()` first — `schedulerRegistry.deleteCronJob()` throws if job name not found
- All command handlers that mutate a job must invalidate both `CleanupJobCacheKeys.pattern()` and `FileCacheKeys.pathsOverview()`
- Migration timestamp: generate with `Date.now()` or use `npm run migration:create --name=CreateCleanupJobTable`
- No database migrations required for Feature 003 files — only `cleanup_jobs` table is new
