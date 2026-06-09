# Tasks: Generic Notification Service

**Input**: Design documents from `/specs/001-notifications-api/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/rest-api.md

**Tests**: E2E tests included — following boilerplate pattern: `createTestApp()` + Testcontainers PostgreSQL + supertest + `cleanDatabase()`. Real DB, mocked cache. No RabbitMQ consumer tests (consumer logic tested indirectly via HTTP by creating notifications through CommandBus in tests).

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Clean boilerplate, rename project, configure for notifications domain

- [ ] T001 Remove all SFTP-domain code: delete `src/app/domain/entities/sftp-user.entity.ts`, `src/app/domain/entities/mapping-schema.entity.ts`, `src/app/domain/entities/cleanup-job.entity.ts`, all related ports, results, value-objects, repositories, services, commands, queries, mappers, controllers, DTOs, consumers, and the `frontend/` directory
- [ ] T002 Update `package.json`: rename to `ms-notifications-api`, update description, reset version to `1.0.0`
- [ ] T003 [P] Update `.env.example` with notification-specific values: `APP_PORT=3009`, `DB_PORT=5438`, `DB_DATABASE=ms_notifications`
- [ ] T004 [P] Update `docker-compose.yml` at repo root to use `db-notifications` on port 5438 and database `ms_notifications`
- [ ] T005 [P] Update `Jenkinsfile` to reference `ms-notifications-api` container name and port 3009
- [ ] T006 [P] Update `Dockerfile` if any SFTP-specific build steps exist (remove sftp/frontend stages)
- [ ] T007 Clean test directory: remove all SFTP-related test files from `test/modules/`, remove SFTP factories from `test/factories/`, remove `test/helpers/file-test-app.helper.ts`. Keep `test/helpers/test-app.helper.ts`, `test/helpers/db.helper.ts`, and `test/setup/jest-setup.ts`

**Checkpoint**: Clean project skeleton — compiles with no domain code, ready for notification domain.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Notification entity, repository port, migration, RabbitMQ topic registration, and test factory — shared by all stories

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T008 Create `notification_severity` enum in `src/app/domain/types/notification-severity.enum.ts` with values: `INFO`, `WARNING`, `CRITICAL`
- [ ] T009 [P] Create `notification_status` enum in `src/app/domain/types/notification-status.enum.ts` with values: `UNREAD`, `READ`, `ARCHIVED`
- [ ] T010 Create Notification entity in `src/app/domain/entities/notification.entity.ts` with TypeORM decorators: id (UUID PK), type (varchar 100), source (varchar 100), title (varchar 255), message (text), metadata (jsonb default `{}`), severity (enum), status (enum default UNREAD), createdAt, updatedAt. Implement `IValidable` with `validate()` that enforces field presence, length limits, and metadata size max 10KB
- [ ] T011 Create `INotificationRepository` abstract port in `src/app/domain/ports/notification-repository.port.ts` with methods: `create()`, `findById()`, `findAll(filters, pagination)`, `update()`, `updateMany(ids, partial)`, `countByIds(ids)`
- [ ] T012 Create `NotificationResult`, `ListNotificationsResult`, and `BulkUpdateResult` in `src/app/domain/results/notification.result.ts`
- [ ] T013 Create `NotificationRepository` implementation in `src/app/infrastructure/persistence/notification.repository.ts` using TypeORM Repository pattern with try/catch and RepositoryError. Implement `findAll` with dynamic where clauses for status, severity, source, type, fromDate, toDate, plus skip/take pagination
- [ ] T014 Update `src/app/infrastructure/messaging/messaging.registry.ts`: replace SFTP topics with `Topics.NOTIFICATIONS = { exchange: 'notifications', routingKeys: { CREATED: 'notification.created' } }`
- [ ] T015 Update `src/app/infrastructure/infrastructure.module.ts`: register Notification entity in TypeOrmModule.forFeature, bind `INotificationRepository` to `NotificationRepository`, remove all old SFTP bindings
- [ ] T016 Create migration `src/migrations/{timestamp}-create-notifications-table.ts` with raw SQL: create enums `notification_severity_enum` and `notification_status_enum`, create `notifications` table, add composite indexes on (status, createdAt), (source, createdAt), (severity, createdAt), (type, createdAt)
- [ ] T017 Update `src/main.ts`: change queue name to `ms-notifications-api.notification.created`, update log messages to reference notifications service
- [ ] T018 Create notification test factory in `test/factories/notification.factory.ts` with `buildCreateNotificationPayload(overrides?: Partial)` returning `{ type: 'TEST_EVENT', source: 'ms-test', title: 'Test notification ${counter++}', message: 'Test message', severity: 'INFO', metadata: {} }`. Accept partial overrides for all fields. Use counter for uniqueness like existing factories

**Checkpoint**: Foundation ready — entity, repository, migration, RabbitMQ config, and test factory in place. User story implementation can begin.

---

## Phase 3: User Story 1 — Receive and Store Notifications from Any Source (Priority: P1) 🎯 MVP

**Goal**: Any microservice publishes a notification event to RabbitMQ → ms-notifications-api consumes it and persists it as a Notification record with status UNREAD.

**Independent Test**: Create notification via POST endpoint (test shortcut) or CommandBus → verify it persists with correct fields.

### Implementation for User Story 1

- [ ] T019 [US1] Create `CreateNotificationCommand` class and `CreateNotificationHandler` in `src/app/application/commands/notification.commands.ts`. Handler: build Notification entity from command, call `validate()`, persist via `INotificationRepository.create()`, return `NotificationResult`
- [ ] T020 [US1] Create `CreateNotificationMapper` in `src/app/application/mappers/notification.mappers.ts` with `toCommand(payload)` to map RabbitMQ payload to `CreateNotificationCommand`
- [ ] T021 [US1] Create `NotificationConsumer` in `src/app/application/consumers/notification.consumer.ts` with `@EventPattern('notification.created')`. On valid message: map payload → command → execute via CommandBus → ack. On validation error: nack without requeue + log. On processing error: nack with requeue + log
- [ ] T022 [US1] Add `POST /notifications` endpoint to `NotificationController` in `src/app/api/controllers/notification.controller.ts` for direct HTTP creation (used by tests and as an alternative to RabbitMQ). Create `CreateNotificationRequestDto` in `src/app/api/dtos/notification.dtos.ts` with class-validator decorators
- [ ] T023 [US1] Update `src/app/application/application.module.ts`: register `NotificationConsumer` in controllers array, register `CreateNotificationHandler` in providers, remove all old SFTP handlers/controllers/consumers

### E2E Tests for User Story 1

- [ ] T024 [US1] Create E2E test `test/modules/notifications-create.e2e-spec.ts`. Use `createTestApp()` with entities: [Notification], controllers: [NotificationController], providers: [CreateNotificationHandler, {provide: INotificationRepository, useClass: NotificationRepository}, {provide: ICacheService, useValue: mockCacheService}, CachingQueryBus]. Tests: (1) POST valid notification → 201, verify all fields in response, status=UNREAD. (2) POST with missing required fields → 400. (3) POST with unknown type/source → 201 (agnostic). (4) POST with metadata exceeding 10KB → 400. (5) POST with each severity level (INFO, WARNING, CRITICAL) → 201. Use `buildCreateNotificationPayload()` factory, `cleanDatabase()` in afterEach, `pgContainer.stop()` in afterAll

**Checkpoint**: User Story 1 complete — notifications can be created and persisted.

---

## Phase 4: User Story 2 — List and Filter Notifications (Priority: P1)

**Goal**: REST endpoint to list notifications with pagination and filters (status, severity, source, type, date range). ARCHIVED excluded by default.

**Independent Test**: Seed notifications via POST → call GET /notifications with various filter combinations → verify correct pagination and filtering.

### Implementation for User Story 2

- [ ] T025 [P] [US2] Create request/response DTOs in `src/app/api/dtos/notification.dtos.ts`: `ListNotificationsQueryDto` (page, pageSize, status, severity, source, type, fromDate, toDate with class-validator decorators), `NotificationResponseDto`, `ListNotificationsResponseDto` (data array + total, page, pageSize, totalPages)
- [ ] T026 [US2] Create `ListNotificationsQuery` and `ListNotificationsHandler` in `src/app/application/queries/notification.queries.ts`. Handler: call `INotificationRepository.findAll()` with filters and pagination, default status filter excludes ARCHIVED, return `ListNotificationsResult`
- [ ] T027 [US2] Add `ListNotificationsMapper` in `src/app/application/mappers/notification.mappers.ts` with `toQuery(dto)` and `toResponseDto(result)`
- [ ] T028 [US2] Add `GET /notifications` endpoint to `NotificationController` in `src/app/api/controllers/notification.controller.ts`. Inject CommandBus and CachingQueryBus. Use `@ApiEndpoint` decorator for Swagger. Standard `handleError` pattern
- [ ] T029 [US2] Register `NotificationController` in `src/app/application/application.module.ts` controllers array, register `ListNotificationsHandler` in providers

### E2E Tests for User Story 2

- [ ] T030 [US2] Create E2E test `test/modules/notifications-list.e2e-spec.ts`. Use `createTestApp()` with all US1+US2 handlers and real repository. Tests: (1) GET with no notifications → 200, empty data, total=0. (2) Create 3 notifications via POST, GET all → returns 3 ordered by createdAt DESC. (3) Filter by severity=CRITICAL → only critical returned. (4) Filter by source='ms-predictions-api' → only from that source. (5) Filter by status=UNREAD → only unread. (6) Pagination: create 25 notifications, GET page=2&pageSize=10 → 10 items, total=25, totalPages=3. (7) ARCHIVED excluded by default: create notification, archive it, GET without filter → not in results. (8) Filter by status=ARCHIVED → only archived returned. (9) Date range filter: fromDate/toDate → correct slice. Use `buildCreateNotificationPayload()` with overrides per test

**Checkpoint**: User Stories 1+2 complete — full MVP. Can create notifications and list/filter them via REST API.

---

## Phase 5: User Story 3 — Mark Notification as Read (Priority: P2)

**Goal**: PATCH endpoint to mark a single notification as READ. Idempotent — marking an already-read notification is a no-op.

**Independent Test**: Create notification → PATCH /notifications/:id/read → verify status is READ. Call again → no error. Call with bad ID → 404.

### Implementation for User Story 3

- [ ] T031 [US3] Create `MarkAsReadCommand` and `MarkAsReadHandler` in `src/app/application/commands/notification.commands.ts`. Handler: find by ID, throw ApiError 404 if not found, update status to READ if not already, persist, invalidate cache, return result
- [ ] T032 [US3] Add `MarkAsReadMapper` in `src/app/application/mappers/notification.mappers.ts` with `toCommand(id)` and `toResponseDto(result)`
- [ ] T033 [US3] Add request/response DTOs: `NotificationIdParamDto` (UUID validation), `UpdateNotificationResponseDto` (id, status, updatedAt) in `src/app/api/dtos/notification.dtos.ts`
- [ ] T034 [US3] Add `PATCH /notifications/:id/read` endpoint to `NotificationController` in `src/app/api/controllers/notification.controller.ts`
- [ ] T035 [US3] Register `MarkAsReadHandler` in `src/app/application/application.module.ts` providers

### E2E Tests for User Story 3

- [ ] T036 [US3] Create E2E test `test/modules/notifications-read.e2e-spec.ts`. Use `createTestApp()` with US1+US2+US3 handlers. Tests: (1) Create UNREAD notification, PATCH /:id/read → 200, status=READ, updatedAt refreshed. (2) PATCH same ID again → 200 (idempotent), status still READ. (3) PATCH with non-existent UUID → 404. (4) PATCH with invalid UUID format → 400. (5) Verify via GET /notifications?status=READ that the notification appears in READ filter

**Checkpoint**: User Story 3 complete — notifications can be marked as read.

---

## Phase 6: User Story 4 — Archive Notifications (Priority: P2)

**Goal**: PATCH endpoint to archive a single notification. UNREAD or READ → ARCHIVED. No reverse transition.

**Independent Test**: Create notification → PATCH /notifications/:id/archive → verify status is ARCHIVED and excluded from default list.

### Implementation for User Story 4

- [ ] T037 [US4] Create `ArchiveNotificationCommand` and `ArchiveNotificationHandler` in `src/app/application/commands/notification.commands.ts`. Handler: find by ID, throw 404 if not found, throw 400 if already ARCHIVED, update status to ARCHIVED, persist, invalidate cache, return result
- [ ] T038 [US4] Add `ArchiveNotificationMapper` in `src/app/application/mappers/notification.mappers.ts`
- [ ] T039 [US4] Add `PATCH /notifications/:id/archive` endpoint to `NotificationController` in `src/app/api/controllers/notification.controller.ts`
- [ ] T040 [US4] Register `ArchiveNotificationHandler` in `src/app/application/application.module.ts` providers

### E2E Tests for User Story 4

- [ ] T041 [US4] Create E2E test `test/modules/notifications-archive.e2e-spec.ts`. Use `createTestApp()` with all handlers up to US4. Tests: (1) Create UNREAD notification, PATCH /:id/archive → 200, status=ARCHIVED. (2) Create READ notification, PATCH /:id/archive → 200, status=ARCHIVED (UNREAD→ARCHIVED and READ→ARCHIVED both work). (3) PATCH already-ARCHIVED notification → 400. (4) PATCH non-existent UUID → 404. (5) Archived notification excluded from GET /notifications default list. (6) Archived notification appears with GET /notifications?status=ARCHIVED

**Checkpoint**: User Story 4 complete — full notification lifecycle (create → read → archive) works.

---

## Phase 7: User Story 5 — Bulk Operations (Priority: P3)

**Goal**: Bulk mark-as-read and bulk archive endpoints accepting arrays of UUIDs. Partial success response (updated IDs + not-found IDs).

**Independent Test**: Create 5 notifications → bulk mark-as-read with 3 valid IDs + 1 fake → verify 3 updated, 1 in notFound.

### Implementation for User Story 5

- [ ] T042 [P] [US5] Create `BulkIdsRequestDto` in `src/app/api/dtos/notification.dtos.ts` with `ids: string[]` (array of UUIDs, max 100, class-validator `@IsArray`, `@ArrayMaxSize(100)`, `@IsUUID('4', { each: true })`). Create `BulkUpdateResponseDto` with `updated: string[]` and `notFound: string[]`
- [ ] T043 [US5] Create `BulkMarkAsReadCommand` and `BulkMarkAsReadHandler` in `src/app/application/commands/notification.commands.ts`. Handler: count existing by IDs, update status to READ via `updateMany()`, compute notFound IDs by diff, invalidate cache, return `BulkUpdateResult`
- [ ] T044 [US5] Create `BulkArchiveCommand` and `BulkArchiveHandler` in `src/app/application/commands/notification.commands.ts`. Same pattern as T043 but sets status to ARCHIVED
- [ ] T045 [US5] Add `BulkOperationsMapper` in `src/app/application/mappers/notification.mappers.ts`
- [ ] T046 [US5] Add `PATCH /notifications/bulk/read` and `PATCH /notifications/bulk/archive` endpoints to `NotificationController` in `src/app/api/controllers/notification.controller.ts`
- [ ] T047 [US5] Register `BulkMarkAsReadHandler` and `BulkArchiveHandler` in `src/app/application/application.module.ts` providers

### E2E Tests for User Story 5

- [ ] T048 [US5] Create E2E test `test/modules/notifications-bulk.e2e-spec.ts`. Use `createTestApp()` with all handlers. Tests: (1) Create 5 UNREAD notifications, PATCH /bulk/read with all 5 IDs → 200, all in updated[], notFound=[]. (2) PATCH /bulk/read with 3 valid + 1 fake UUID → 200, 3 in updated[], 1 in notFound[]. (3) PATCH /bulk/read with empty array → 400. (4) PATCH /bulk/read with >100 IDs → 400. (5) Create 3 notifications, PATCH /bulk/archive with all 3 → 200, all archived. (6) PATCH /bulk/archive with mix of valid + fake → partial success. (7) Verify via GET that bulk-read notifications have status=READ. (8) Verify bulk-archived notifications excluded from default list

**Checkpoint**: All 5 user stories complete — full notification API functional with tests.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Infra integration, Swagger, logging, and deployment config

- [ ] T049 [P] Add Swagger decorators to all endpoints in `NotificationController` using `@ApiEndpoint`, `@ApiProperty` on all DTOs
- [ ] T050 [P] Update `CLAUDE.md` at repo root: replace SFTP boilerplate documentation with ms-notifications-api domain, endpoints, entity, and architecture documentation
- [ ] T051 [P] Update `README.md`: project name, description, endpoints, quickstart instructions
- [ ] T052 Add `db-notifications` PostgreSQL service (port 5438) to `infra/docker-compose.yml` and `ms-notifications-api` service (port 3009) to `infra/docker-compose.apps.yml` in the infra repo
- [ ] T053 Add `ms-notifications-api` multibranch pipeline to `infra/jenkins/casc.yaml` in the infra repo
- [ ] T054 Run quickstart.md validation: start services, run migration, publish test message, verify list endpoint returns it
- [ ] T055 Run full E2E test suite: `npm run test:e2e` — all tests must pass green

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 completion — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Phase 2
- **User Story 2 (Phase 4)**: Depends on Phase 2 (independent of US1 but logically follows)
- **User Story 3 (Phase 5)**: Depends on Phase 2 (reuses controller from US2)
- **User Story 4 (Phase 6)**: Depends on Phase 2 (reuses controller from US2)
- **User Story 5 (Phase 7)**: Depends on Phase 2 (uses repository methods from T013)
- **Polish (Phase 8)**: Depends on all user stories

### User Story Dependencies

- **US1 (P1)**: Independent — entity + repository + consumer + POST endpoint
- **US2 (P1)**: Independent — entity + repository + GET endpoint
- **US3 (P2)**: Adds to controller from US2 — run after US2 or serialize controller changes
- **US4 (P2)**: Adds to controller from US2 — run after US2 or serialize controller changes
- **US5 (P3)**: Adds bulk endpoints to controller — run after US3/US4

### Within Each User Story

- Command/Query before Mapper
- Mapper before Controller endpoint
- Handler registration after handler creation
- Implementation tasks complete before E2E test task
- All story tasks complete before marking checkpoint

### Parallel Opportunities

**Phase 1**: T003, T004, T005, T006 can all run in parallel
**Phase 2**: T008 + T009 in parallel, then T010 depends on both
**Phase 3-4**: US1 and US2 can run in parallel after Phase 2 (consumer vs controller, different files — serialize mappers file)
**Phase 5-6**: US3 and US4 can run in parallel (different command handlers, same controller file — serialize controller additions)
**Phase 7**: T042 in parallel with other file changes

---

## Parallel Example: US1 + US2 Simultaneously

```bash
# After Phase 2 checkpoint, launch both stories:

# US1 (RabbitMQ consumer + POST path):
Task T019: CreateNotificationCommand + Handler in commands/notification.commands.ts
Task T020: CreateNotificationMapper in mappers/notification.mappers.ts
Task T021: NotificationConsumer in consumers/notification.consumer.ts
Task T022: POST endpoint + CreateNotificationRequestDto
Task T024: E2E test for create operations

# US2 (REST API list path) — different files, no conflicts:
Task T025: ListNotificationsQueryDto in dtos/notification.dtos.ts
Task T026: ListNotificationsQuery + Handler in queries/notification.queries.ts
Task T027: ListNotificationsMapper in mappers/notification.mappers.ts  # ⚠️ same file as T020
Task T028: GET endpoint in controllers/notification.controller.ts
Task T030: E2E test for list/filter operations

# Note: T020 and T027 touch the same mappers file — serialize these two
```

---

## Implementation Strategy

### MVP First (US1 + US2)

1. Complete Phase 1: Setup (clean boilerplate)
2. Complete Phase 2: Foundational (entity, repo, migration, registry, factory)
3. Complete Phase 3: US1 — Create notifications + E2E tests pass
4. Complete Phase 4: US2 — List/filter endpoint + E2E tests pass
5. **STOP and VALIDATE**: `npm run test:e2e` green, POST + GET /notifications work
6. Deploy MVP

### Incremental Delivery

1. Setup + Foundational → skeleton ready
2. US1 + US2 → MVP (create + list) + tests green → Deploy
3. US3 + US4 → Full lifecycle (read + archive) + tests green → Deploy
4. US5 → Bulk operations + tests green → Deploy
5. Polish → Docs, infra integration, full test suite → Final deploy
