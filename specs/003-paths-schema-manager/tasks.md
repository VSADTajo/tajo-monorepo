# Tasks: Paths & Files Manager

**Input**: Design documents from `/specs/003-paths-schema-manager/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**Organization**: Tasks grouped by user story for independent delivery.
**Tests**: Included in Polish phase (not TDD — spec does not require it).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: User story the task belongs to
- No [P] = must run after the previous task in the same file

---

## Phase 1: Setup

**Purpose**: No new project setup needed — this modifies an existing project.

- [X] T001 Verify current branch is `003-paths-schema-manager` and all existing tests pass

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Backend endpoint + frontend types and API client — required before any user story frontend work can begin.

**⚠️ CRITICAL**: All user story tasks depend on this phase completing first.

- [X] T002 Add `PathSchemaInfoDto`, `PathOverviewDto`, `ListPathsOverviewResponseDto` to `src/app/api/dtos/file.dtos.ts`
- [X] T003 Add `ListPathsOverviewQuery` class and `ListPathsOverviewHandler` (injecting `ISftpUserRepository`, `IMappingSchemaRepository`, `StorageConfigService`) to `src/app/application/queries/file.queries.ts`
- [X] T004 Add `PathsCacheKeys` constants and `ListPathsOverviewQuery` entry (ttl: 30, key: `() => 'paths:overview'`) to `src/app/infrastructure/cache/cache-config.registry.ts`
- [X] T005 Add `ListPathsOverviewMapper.toResponseDto()` to `src/app/application/mappers/file.mappers.ts`
- [X] T006 Register `ListPathsOverviewHandler` in providers array of `src/app/application/application.module.ts`
- [X] T007 [P] Create `frontend/src/types/file.types.ts` with `FileInfo`, `ListFilesResponse`, `PathSchemaInfo`, `PathOverview`, `ListPathsOverviewResponse` interfaces
- [X] T008 [P] Create `frontend/src/api/files.api.ts` with `fetchPathsOverview()`, `fetchFiles(directory)`, and `getDownloadUrl(filePath)` functions

**Checkpoint**: `GET /api/files/paths-overview` returns data; frontend has types and API client.

---

## Phase 3: User Story 1 — Browse Paths and Files (Priority: P1) 🎯 MVP

**Goal**: Administrator can open "Paths & Files" section, see all paths, and expand any path to view its files (name, size, date).

**Independent Test**: Open `/paths` in the browser → all configured paths appear → click any path → files table is shown with name, size, and modified date columns. An empty path shows "No files".

### Implementation

- [X] T009 Add `GET /files/paths-overview` endpoint using `@ApiEndpoint` decorator and `CachingQueryBus` to `src/app/api/controllers/file.controller.ts`
- [X] T010 [P] Create `frontend/src/hooks/usePathsOverview.ts` with `usePathsOverview()` React Query hook (queryKey: `['paths-overview']`)
- [X] T011 [P] Create `frontend/src/hooks/useFiles.ts` with `useFilesList(directory, enabled)` hook (lazy — only fetches when `enabled=true`, queryKey: `['files', directory]`, filters out directories)
- [X] T012 [US1] Create `frontend/src/pages/PathsManagerPage.tsx` with `PathCard` component (expand/collapse toggle, file table with name/size/date columns, loading and error states) and `PathsManagerPage` (fetches overview, renders list of `PathCard`)
- [X] T013 [US1] Add `/paths` route pointing to `PathsManagerPage` in `frontend/src/App.tsx`
- [X] T014 [US1] Add "Paths & Files" nav section with link to `/paths` in `frontend/src/components/Layout.tsx`

**Checkpoint**: Full P1 story is functional — all paths visible, files load on expand.

---

## Phase 4: User Story 2 — Download Files (Priority: P2)

**Goal**: Administrator can click "Download" on any file and the browser starts the download immediately.

**Independent Test**: Expand a path with files → click "Download" on any file → browser downloads the file. If the path has an active schema, the downloaded file should be in the transformed format (e.g., JSON instead of XML).

### Implementation

- [X] T015 [US2] Add "Download" anchor link (`<a href={getDownloadUrl(file.path)} download>`) to each file row in the file table inside `PathCard` in `frontend/src/pages/PathsManagerPage.tsx`

**Checkpoint**: Every file row has a working download link.

---

## Phase 5: User Story 3 — View Schema Assignment per Path (Priority: P3)

**Goal**: Each path row shows whether a parsing schema is assigned, including its name and active/inactive status.

**Independent Test**: A path with an assigned schema shows the schema name and a colored "Active"/"Inactive" badge on its row. A path without a schema shows a "No schema" indicator.

### Implementation

- [X] T016 [US3] Add schema info display (schema name, Active/Inactive badge, "No schema" indicator) to the `PathCard` header row in `frontend/src/pages/PathsManagerPage.tsx`

**Checkpoint**: Schema assignment visible at a glance for all paths.

---

## Phase 6: User Story 4 — Toggle Schema Activation (Priority: P4)

**Goal**: Administrator can toggle schema active/inactive directly from the path row without leaving the section.

**Independent Test**: Click the toggle on a path with an active schema → badge changes to "Inactive" → toggle is disabled during the request → subsequent file download uses the original file (not transformed).

### Implementation

- [X] T017 [US4] Add toggle switch button to `PathCard` header for paths with a schema (reuse `useToggleSchema` from `useSchemaMutations.ts`); button disabled while `isPending` in `frontend/src/pages/PathsManagerPage.tsx`
- [X] T018 [US4] Update `useToggleSchema` in `frontend/src/hooks/useSchemaMutations.ts` to also invalidate `['paths-overview']` query on success so the schema badge updates immediately

**Checkpoint**: Full feature functional — all 4 user stories work end-to-end.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: E2E test, cache invalidation wiring, and final validation.

- [X] T019 [P] Create e2e test `test/modules/files/list-paths-overview.e2e-spec.ts` — tests: (a) returns empty when no users/schemas, (b) returns path from SFTP user's rootDirectory, (c) returns path from schema's directoryPath with schema info attached, (d) deduplicates when both sources share same path
- [X] T020 [P] Create test factory `test/factories/paths-overview.factory.ts` with `buildSftpUserWithPath()` and `buildSchemaForPath()` helpers for the e2e test
- [ ] T021 Validate quickstart.md integration scenarios manually against running system (docker compose up → open /paths → verify all 3 quickstart flows work)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — **BLOCKS all user stories**
- **Phase 3 (US1)**: Depends on Phase 2 — backend endpoint + frontend types must exist
- **Phase 4 (US2)**: Depends on Phase 3 — file table must exist before adding download link
- **Phase 5 (US3)**: Depends on Phase 2 — schema data comes from paths-overview; can start in parallel with US1 if `PathCard` skeleton exists
- **Phase 6 (US4)**: Depends on Phase 5 — toggle button is added alongside schema badge
- **Phase 7 (Polish)**: Depends on Phase 6 — all stories complete

### User Story Dependencies

- **US1 (P1)**: After Phase 2 — no other story dependencies
- **US2 (P2)**: After US1 — adds to existing file table in PathCard
- **US3 (P3)**: After Phase 2 — schema data is in paths-overview payload; UI additions independent of US1/US2
- **US4 (P4)**: After US3 — toggle button belongs next to the schema badge

### Parallel Opportunities (within Phase 2)

- T007 and T008 can run in parallel (different files)
- T010 and T011 can run in parallel (different files)

### Same-file sequencing

Tasks modifying `PathsManagerPage.tsx` (T012 → T015 → T016 → T017) must run sequentially in order.

---

## Implementation Strategy

### MVP (User Story 1 only)

1. Phase 1 → Phase 2 → Phase 3
2. **STOP**: Open `/paths`, verify paths appear and files load on expand
3. Deploy/demo if ready

### Incremental Delivery

1. Phase 2 complete → backend endpoint live
2. Phase 3 → browsing works → demo
3. Phase 4 → downloads work → demo
4. Phase 5 → schema visible → demo
5. Phase 6 → toggle works → full feature ready
6. Phase 7 → polished and tested

---

## Notes

- `PathsManagerPage.tsx` accumulates changes across US1–US4 — build it incrementally per story
- `getDownloadUrl()` is already in `files.api.ts` (Phase 2, T008) — just use it in Phase 4
- The toggle reuses `useToggleSchema` — only T018 extends its invalidation logic
- No database migrations required — zero schema changes
- `canListFiles: false` paths (outside basePath) should display with a warning icon but no expand action
