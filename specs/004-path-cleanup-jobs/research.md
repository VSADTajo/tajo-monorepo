# Research: Scheduled Path Cleanup Jobs

**Feature**: 004-path-cleanup-jobs
**Date**: 2026-03-09

---

## Decision 1: Dynamic Cron Scheduling Library

**Decision**: Use `@nestjs/schedule` (wraps `node-cron`) with `SchedulerRegistry` for runtime job management.

**Rationale**:
- `@nestjs/schedule` is the official NestJS scheduling module, well maintained and v11-compatible.
- `SchedulerRegistry` provides a runtime map of named `CronJob` instances with `addCronJob(name, job)`, `deleteCronJob(name)`, `getCronJob(name)` — exactly what's needed for dynamic registration.
- `CronJob.nextDate()` from the `cron` package returns a Luxon `DateTime` which converts to JS `Date` via `.toJSDate()`, enabling next-execution time display.
- No alternative (e.g. Bull/BullMQ) was considered since we don't need job queuing, retries with backoff, or distributed workers — simple in-process cron is sufficient.

**Alternatives considered**:
- **BullMQ**: Overkill — adds Redis queue layer, better suited for distributed job queues with worker pools. Feature only needs single-process file cleanup.
- **node-cron directly**: Would bypass NestJS lifecycle and DI, making testing and module teardown harder.

**Installation required**: `npm install @nestjs/schedule`  — `@nestjs/schedule` transitively brings `cron` and `luxon`.

---

## Decision 2: Job Persistence

**Decision**: Store `CleanupJob` entities in PostgreSQL (existing TypeORM setup).

**Rationale**:
- Jobs must survive application restarts (FR-003 requirement: 100% of active jobs execute on schedule).
- PostgreSQL is already the project database; no new storage tech needed.
- On `OnModuleInit`, the `CleanupSchedulerService` loads all active jobs from the repository and registers them with `SchedulerRegistry`.

**Alternatives considered**:
- **In-memory only**: Jobs lost on restart — violates FR-003.
- **Separate config file**: Not manageable through the API; no UI updates.

---

## Decision 3: Frequency Representation

**Decision**: Store frequency as a named enum (e.g. `EVERY_HOUR`) in the DB, map to cron expression at the service layer.

**Rationale**:
- Enum values are safe, validated, and human-readable in the DB.
- Cron expressions are derived deterministically from the enum — no need to store raw cron strings in the DB.
- If frequencies are expanded in future, the mapping is in one place.

**Frequency → Cron mapping**:

| Enum Value     | Cron Expression | Description  |
|----------------|-----------------|--------------|
| EVERY_5_MIN    | `*/5 * * * *`   | Every 5 min  |
| EVERY_15_MIN   | `*/15 * * * *`  | Every 15 min |
| EVERY_30_MIN   | `*/30 * * * *`  | Every 30 min |
| EVERY_HOUR     | `0 * * * *`     | Every hour   |
| EVERY_6_HOURS  | `0 */6 * * *`   | Every 6 h    |
| EVERY_12_HOURS | `0 */12 * * *`  | Every 12 h   |
| EVERY_DAY      | `0 0 * * *`     | Daily midnight |
| EVERY_WEEK     | `0 0 * * 0`     | Sunday midnight |

---

## Decision 4: File Extension Storage

**Decision**: Store extensions as a PostgreSQL `text[]` array column; normalize to lowercase with leading dot on save.

**Rationale**:
- `text[]` is native PostgreSQL and maps cleanly to `string[]` in TypeORM with `@Column('text', { array: true })`.
- Normalization (lowercase + leading dot) happens in the `FileExtensionsValueObject`, keeping the domain clean.

---

## Decision 5: Cleanup Execution Strategy

**Decision**: The `CleanupSchedulerService` (infrastructure) handles execution: reads directory via `IFileStorageService`, filters by extensions, deletes files one by one, records results.

**Rationale**:
- Reuses the existing `IFileStorageService` port and `DeleteFileCommand` pattern rather than directly calling `fs`.
- Uses `DeleteFileCommand` through `CommandBus` so that file deletion is auditable and cache-invalidated consistently.
- Execution result (filesDeleted count, any errors) is stored in `lastExecutionResult` JSONB column.

---

## Decision 6: Paths Overview Integration

**Decision**: Extend `GET /api/files/paths-overview` to include `cleanupJob: CleanupJobInfo | null` per path entry, rather than a separate N+1 endpoint per path.

**Rationale**:
- Frontend needs job status for every path row at page load — one request is better than N.
- `ListPathsOverviewHandler` gets a new dependency: `ICleanupJobRepository`. Acceptable since it already aggregates from multiple sources.

---

## Decision 7: ScheduleModule Registration

**Decision**: Register `ScheduleModule.forRoot()` in `app.module.ts` (root level), not in `InfrastructureModule`.

**Rationale**:
- `ScheduleModule.forRoot()` starts the scheduler process and must be registered once at the app level.
- `SchedulerRegistry` is provided globally by `ScheduleModule` and can be injected anywhere.
