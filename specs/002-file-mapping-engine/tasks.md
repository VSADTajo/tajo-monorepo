# Tasks: File Mapping Engine

**Input**: Design documents from `/specs/002-file-mapping-engine/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Not explicitly requested in spec. Test tasks omitted.

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install dependencies and initialize frontend project

- [x] T001 Install backend dependencies: `npm install fast-xml-parser csv-parse @dsnp/parquetjs`
- [x] T002 Initialize frontend Vite + React + TypeScript project in `frontend/` with `npm create vite@latest frontend -- --template react-ts`
- [x] T003 Install frontend dependencies in `frontend/`: `npm install @tanstack/react-query react-router-dom react-hook-form` and `npm install -D tailwindcss @tailwindcss/vite`
- [x] T004 Configure Tailwind CSS in `frontend/vite.config.ts` and `frontend/src/index.css`
- [x] T005 Enable CORS for frontend dev server (localhost:5173) in `src/main.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Domain layer entities, ports, value objects, and migration that ALL user stories depend on

**CRITICAL**: No user story work can begin until this phase is complete

- [x] T006 [P] Create MappingSchema entity in `src/app/domain/entities/mapping-schema.entity.ts` — TypeORM entity with JSONB fieldMappings and csvOptions columns, implements IValidable, extends BaseAuditEntity
- [x] T007 [P] Create DirectoryPathValueObject in `src/app/domain/value-objects/directory-path.value-object.ts` — validates path starts with `/`, is not empty, trims trailing slashes
- [x] T008 [P] Create FieldMappingValueObject in `src/app/domain/value-objects/field-mapping.value-object.ts` — validates sourceField and targetField are non-empty, dataType is valid enum, validates array has at least one mapping
- [x] T009 [P] Create IMappingSchemaRepository port in `src/app/domain/ports/mapping-schema-repository.port.ts` — abstract class with create, findById, findByDirectoryPath, findAll, update, delete methods
- [x] T010 [P] Create IFileTransformer port in `src/app/domain/ports/file-transformer.port.ts` — abstract class with transform(stream, schema) method returning Buffer
- [x] T011 [P] Create MappingSchemaResult in `src/app/domain/results/mapping-schema.result.ts` — result DTOs: MappingSchemaResult, ListMappingSchemasResult, DeleteMappingSchemaResult
- [x] T012 Create MappingSchema TypeORM repository in `src/app/infrastructure/persistence/mapping-schema.repository.ts` — implements IMappingSchemaRepository using @InjectRepository, wraps errors in RepositoryError
- [x] T013 Create database migration in `src/migrations/XXXXXXXXX-add-mapping-schemas-table.ts` — raw SQL: CREATE TABLE mapping_schemas with JSONB columns, UNIQUE constraint on directoryPath
- [x] T014 Register MappingSchema entity in TypeOrmModule.forFeature and bind IMappingSchemaRepository port in `src/app/infrastructure/infrastructure.module.ts`
- [x] T015 [P] Create shared TypeScript types for frontend in `frontend/src/types/mapping-schema.types.ts` — interfaces: MappingSchema, FieldMapping, CsvOptions, CreateMappingSchemaRequest, UpdateMappingSchemaRequest
- [x] T016 [P] Create API client in `frontend/src/api/mapping-schemas.api.ts` — fetch functions: fetchSchemas, fetchSchemaById, createSchema, updateSchema, deleteSchema, toggleSchema
- [x] T017 [P] Create Layout component in `frontend/src/components/Layout.tsx` — shared layout with header and navigation
- [x] T018 Configure React Router and TanStack QueryClient in `frontend/src/App.tsx` — routes for /, /schemas/create, /schemas/:id/edit

**Checkpoint**: Foundation ready — entity persists, migration runs, frontend scaffolded. User story implementation can begin.

---

## Phase 3: User Story 1 — Configure a Mapping Schema for a Path (Priority: P1) MVP

**Goal**: Administrators can create, edit, and save mapping schemas for SFTP directory paths through the UI.

**Independent Test**: Create a mapping schema via the UI, verify it persists and is retrievable via GET endpoint.

### Implementation for User Story 1

- [x] T019 [P] [US1] Create mapping-schema DTOs in `src/app/api/dtos/mapping-schema.dtos.ts` — CreateMappingSchemaRequestDto, UpdateMappingSchemaRequestDto, MappingSchemaResponseDto, ListMappingSchemasResponseDto, DeleteMappingSchemaResponseDto (with class-validator decorators and @ApiProperty)
- [x] T020 [P] [US1] Create mapping-schema mappers in `src/app/application/mappers/mapping-schema.mappers.ts` — CreateMappingSchemaMapper, UpdateMappingSchemaMapper, ListMappingSchemasMapper, GetMappingSchemaByIdMapper, DeleteMappingSchemaMapper (toCommand/toQuery + toResponseDto)
- [x] T021 [US1] Create CreateMappingSchema command + handler in `src/app/application/commands/mapping-schema.commands.ts` — validates entity with validate(), checks uniqueness of directoryPath via repository, persists, returns result
- [x] T022 [US1] Add UpdateMappingSchema command + handler to `src/app/application/commands/mapping-schema.commands.ts` — finds by ID (404 if not found), validates updated entity, checks directoryPath uniqueness (excluding self), persists
- [x] T023 [US1] Add DeleteMappingSchema command + handler to `src/app/application/commands/mapping-schema.commands.ts` — finds by ID (404 if not found), deletes, returns deleted ID and path
- [x] T024 [US1] Create ListMappingSchemas and GetMappingSchemaById queries + handlers in `src/app/application/queries/mapping-schema.queries.ts`
- [x] T025 [US1] Create MappingSchemaController in `src/app/api/controllers/mapping-schema.controller.ts` — POST /, GET /, GET /:id, PUT /:id, DELETE /:id endpoints with @ApiEndpoint decorators and standard error handling pattern
- [x] T026 [US1] Register all handlers and controller in `src/app/application/application.module.ts` — add CreateMappingSchemaHandler, UpdateMappingSchemaHandler, DeleteMappingSchemaHandler, ListMappingSchemasHandler, GetMappingSchemaByIdHandler to providers, MappingSchemaController to controllers
- [x] T027 [P] [US1] Create SchemaForm component in `frontend/src/components/SchemaForm.tsx` — React Hook Form with fields: directoryPath, name, inputFormat (select: xml/csv), outputFormat (select: json/csv/dat/parquet)
- [x] T028 [P] [US1] Create FieldMappingEditor component in `frontend/src/components/FieldMappingEditor.tsx` — dynamic table with add/remove/reorder rows, columns: sourceField (text input), targetField (text input), dataType (select), defaultValue (text input), transform (text input)
- [x] T029 [P] [US1] Create CsvOptionsPanel component in `frontend/src/components/CsvOptionsPanel.tsx` — conditionally rendered when inputFormat=csv, fields: delimiter, encoding, metadataRows, outputDelimiter, includeHeader
- [x] T030 [US1] Create useSchemas hook in `frontend/src/hooks/useSchemas.ts` — TanStack Query hooks: useSchemasList (GET /), useSchemaById (GET /:id)
- [x] T031 [US1] Create useSchemaMutations hook in `frontend/src/hooks/useSchemaMutations.ts` — TanStack Query mutations: useCreateSchema, useUpdateSchema, useDeleteSchema, useToggleSchema with cache invalidation
- [x] T032 [US1] Create SchemaCreatePage in `frontend/src/pages/SchemaCreatePage.tsx` — renders SchemaForm + FieldMappingEditor + CsvOptionsPanel, calls useCreateSchema on submit, navigates to list on success
- [x] T033 [US1] Create SchemaEditPage in `frontend/src/pages/SchemaEditPage.tsx` — loads schema by ID via useSchemaById, renders SchemaForm + FieldMappingEditor + CsvOptionsPanel pre-filled, calls useUpdateSchema on submit

**Checkpoint**: Schemas can be created, edited, and deleted via UI and API. Core CRUD is fully functional.

---

## Phase 4: User Story 2 — Download Files with Automatic Transformation (Priority: P1)

**Goal**: Files downloaded from a mapped path are automatically transformed according to the schema in real-time.

**Independent Test**: Configure a schema for a path, download an XML/CSV file from that path via `POST /sftp/download`, verify output matches expected format.

### Implementation for User Story 2

- [x] T034 [P] [US2] Create XML parser service in `src/app/infrastructure/services/parsers/xml-parser.service.ts` — uses fast-xml-parser, handles FEWS PI TimeSeries format, flattens multi-series into rows (header metadata + event data per row)
- [x] T035 [P] [US2] Create CSV parser service in `src/app/infrastructure/services/parsers/csv-parser.service.ts` — uses csv-parse, handles configurable delimiter/encoding, skips metadataRows header lines
- [x] T036 [P] [US2] Create JSON formatter service in `src/app/infrastructure/services/formatters/json-formatter.service.ts` — takes parsed rows + field mappings, outputs JSON array buffer
- [x] T037 [P] [US2] Create CSV formatter service in `src/app/infrastructure/services/formatters/csv-formatter.service.ts` — takes parsed rows + field mappings, outputs CSV with configurable delimiter and optional header
- [x] T038 [P] [US2] Create DAT formatter service in `src/app/infrastructure/services/formatters/dat-formatter.service.ts` — takes parsed rows + field mappings, outputs delimited text without header row
- [x] T039 [P] [US2] Create Parquet formatter service in `src/app/infrastructure/services/formatters/parquet-formatter.service.ts` — uses @dsnp/parquetjs, takes parsed rows + field mappings + data types, outputs Parquet buffer
- [x] T040 [US2] Create FileTransformerService in `src/app/infrastructure/services/file-transformer.service.ts` — orchestrator: selects parser by inputFormat, selects formatter by outputFormat, applies field mappings with type casting and transforms, returns transformed buffer
- [x] T041 [US2] Bind IFileTransformer port to FileTransformerService in `src/app/infrastructure/infrastructure.module.ts`
- [x] T042 [US2] Add GetMappingSchemaByPath query + handler to `src/app/application/queries/mapping-schema.queries.ts` — finds active schema by directory path (extracts directory from full file path)
- [x] T043 [US2] Modify SftpDownloadFileHandler in `src/app/application/queries/sftp.queries.ts` — after downloading raw stream, check for active schema via GetMappingSchemaByPath; if found, pipe stream through IFileTransformer and return transformed buffer with appropriate Content-Type; if not found, return raw stream as-is
- [x] T044 [US2] Update download response headers in `src/app/api/controllers/sftp.controller.ts` — when transformation is applied, set Content-Type based on output format (application/json, text/csv, application/octet-stream, application/vnd.apache.parquet) and update filename extension

**Checkpoint**: Downloading files from paths with active schemas returns transformed output. Paths without schemas still return raw files.

---

## Phase 5: User Story 3 — Toggle Mapping On/Off per Path (Priority: P2)

**Goal**: Administrators can enable/disable mapping per path without deleting the schema configuration.

**Independent Test**: Toggle a schema off via UI, download file — get raw. Toggle back on — get transformed.

### Implementation for User Story 3

- [x] T045 [US3] Create ToggleMappingSchemaRequestDto in `src/app/api/dtos/mapping-schema.dtos.ts` — with isActive boolean field
- [x] T046 [US3] Add ToggleMappingSchema command + handler to `src/app/application/commands/mapping-schema.commands.ts` — finds by ID (404 if not found), updates isActive field, returns updated result
- [x] T047 [US3] Add ToggleMappingSchemaMapper to `src/app/application/mappers/mapping-schema.mappers.ts`
- [x] T048 [US3] Add PATCH /:id/toggle endpoint to MappingSchemaController in `src/app/api/controllers/mapping-schema.controller.ts`
- [x] T049 [US3] Register ToggleMappingSchemaHandler in `src/app/application/application.module.ts` providers
- [x] T050 [US3] Create StatusToggle component in `frontend/src/components/StatusToggle.tsx` — toggle switch that calls useToggleSchema mutation, shows active/inactive state with color indicator

**Checkpoint**: Toggling works via UI and API. Download behavior changes immediately based on isActive status.

---

## Phase 6: User Story 4 — View All Paths and Their Mapping Status (Priority: P2)

**Goal**: Dashboard showing all schemas with their status (Active, Inactive) at a glance.

**Independent Test**: Navigate to dashboard, verify all schemas shown with correct status badges and clickable navigation to edit.

### Implementation for User Story 4

- [x] T051 [US4] Create SchemaTable component in `frontend/src/components/SchemaTable.tsx` — table with columns: directoryPath, name, inputFormat, outputFormat, status (badge Active/Inactive), actions (edit, delete). Includes StatusToggle per row.
- [x] T052 [US4] Create SchemasListPage in `frontend/src/pages/SchemasListPage.tsx` — renders SchemaTable with data from useSchemasList hook, "Create New Schema" button linking to /schemas/create, loading/error states, delete confirmation modal

**Checkpoint**: Full dashboard view with status management. All CRUD operations accessible from one screen.

---

## Phase 7: User Story 5 — Support Multiple Output Formats (Priority: P2)

**Goal**: All 4 output formats (JSON, CSV, DAT, Parquet) work correctly for both XML and CSV inputs.

**Independent Test**: Configure same source path with each output format, download and verify each produces valid output.

### Implementation for User Story 5

- [x] T053 [US5] Add data type casting logic in `src/app/infrastructure/services/file-transformer.service.ts` — handle string, number, date, boolean conversions per field mapping dataType, apply transform rules (lowercase, uppercase, trim, dateFormat)
- [x] T054 [US5] Add CSV input + all output format combinations — verify CSV parser output feeds correctly into JSON, CSV, DAT, and Parquet formatters in `src/app/infrastructure/services/file-transformer.service.ts`
- [x] T055 [US5] Add XML input + all output format combinations — verify XML parser output feeds correctly into JSON, CSV, DAT, and Parquet formatters, especially multi-series flattening in `src/app/infrastructure/services/file-transformer.service.ts`
- [x] T056 [US5] Handle edge cases in `src/app/infrastructure/services/file-transformer.service.ts` — empty files (return empty output with appropriate format), missing fields (use defaultValue or omit), encoding issues (detect and convert), oversize files (>500MB warning log)

**Checkpoint**: All 8 input/output combinations work (2 inputs x 4 outputs). Edge cases handled gracefully.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [x] T057 [P] Add Swagger documentation for all mapping-schema endpoints using @ApiEndpoint in `src/app/api/controllers/mapping-schema.controller.ts`
- [x] T058 [P] Add structured logging with injected Logger for all new command/query handlers
- [x] T059 [P] Add frontend error handling — toast notifications for API errors, form validation messages in `frontend/src/components/SchemaForm.tsx`
- [x] T060 Run `npm run lint` and `npm run format` to ensure code style compliance
- [x] T061 Run quickstart.md verification — test all curl commands from quickstart.md against running app

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - US1 + US2 are both P1 but US2 depends on US1 (needs schemas to exist before transforming)
  - US3, US4, US5 can proceed in parallel after US1
- **Polish (Phase 8)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 (P1)**: Can start after Foundational (Phase 2). No dependencies on other stories.
- **US2 (P1)**: Depends on US1 (needs MappingSchema CRUD + GetByPath query). Core transformation engine.
- **US3 (P2)**: Can start after US1 (Phase 2). Toggle is independent of transformation.
- **US4 (P2)**: Can start after US1 (Phase 2). Dashboard only needs list endpoint.
- **US5 (P2)**: Depends on US2 (needs transformation engine to test all format combinations).

### Within Each User Story

- DTOs and mappers before commands/queries
- Commands/queries before controller endpoints
- Backend endpoints before frontend pages
- Core implementation before edge cases

### Parallel Opportunities

- T006-T011: All foundational domain files can be created in parallel
- T015-T018: All frontend scaffolding can be created in parallel
- T019-T020: DTOs and mappers in parallel
- T027-T029: All frontend components in parallel
- T034-T039: All parsers and formatters in parallel (different files, no dependencies)
- US3 + US4: Can run in parallel after US1 completes

---

## Parallel Example: User Story 2

```text
# Launch all parsers and formatters in parallel:
T034: "Create XML parser service in src/app/infrastructure/services/parsers/xml-parser.service.ts"
T035: "Create CSV parser service in src/app/infrastructure/services/parsers/csv-parser.service.ts"
T036: "Create JSON formatter service in src/app/infrastructure/services/formatters/json-formatter.service.ts"
T037: "Create CSV formatter service in src/app/infrastructure/services/formatters/csv-formatter.service.ts"
T038: "Create DAT formatter service in src/app/infrastructure/services/formatters/dat-formatter.service.ts"
T039: "Create Parquet formatter service in src/app/infrastructure/services/formatters/parquet-formatter.service.ts"

# Then sequentially:
T040: "Create FileTransformerService orchestrator"
T041: "Bind IFileTransformer port"
T042-T044: "Integrate with download endpoint"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1 (CRUD schemas via UI)
4. **STOP and VALIDATE**: Create/edit/delete schemas via React UI
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add US1 → Schema CRUD works → Deploy (MVP!)
3. Add US2 → Files transform on download → Deploy
4. Add US3 + US4 in parallel → Toggle + Dashboard → Deploy
5. Add US5 → All format combinations validated → Deploy
6. Polish → Logging, Swagger, cleanup → Final Deploy

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Backend uses path aliases (@domain/*, @api/*, etc.) — NOT relative imports
- Frontend uses relative imports within frontend/src/
