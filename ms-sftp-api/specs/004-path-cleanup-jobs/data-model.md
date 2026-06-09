# Data Model: Scheduled Path Cleanup Jobs

**Feature**: 004-path-cleanup-jobs
**Date**: 2026-03-09

---

## New Entity: CleanupJob

Single new database table. No changes to existing entities.

### Table: `cleanup_jobs`

| Column              | Type           | Nullable | Notes                                         |
|---------------------|----------------|----------|-----------------------------------------------|
| `id`                | uuid           | NO       | PK, `uuid_generate_v4()`                      |
| `directoryPath`     | varchar        | NO       | Absolute path, unique constraint              |
| `extensions`        | text[]         | NO       | e.g. `['.xml', '.csv']` — normalized, lowercase |
| `frequency`         | varchar        | NO       | Enum value: `EVERY_HOUR`, `EVERY_DAY`, etc.  |
| `isActive`          | boolean        | NO       | Default `true`                                |
| `lastExecutedAt`    | timestamptz    | YES      | Set after each execution                      |
| `lastExecutionResult` | jsonb        | YES      | `{ filesDeleted: number, error?: string }`    |
| `nextExecutionAt`   | timestamptz    | YES      | Computed on create/activate/update            |
| `createdAt`         | timestamptz    | NO       | From `BaseAuditEntity`                        |
| `updatedAt`         | timestamptz    | NO       | From `BaseAuditEntity`                        |

**Unique constraint**: `directoryPath` — one job per path.

---

## Domain Entity

```
CleanupJob (extends BaseAuditEntity, implements IValidable)
├── id                   : string (UUID)
├── directoryPath        : string   — absolute path, validated by DirectoryPathValueObject
├── extensions           : string[] — e.g. ['.xml', '.csv'], validated by FileExtensionsValueObject
├── frequency            : CleanupFrequency (enum)
├── isActive             : boolean  — default true
├── lastExecutedAt       : Date | null
├── lastExecutionResult  : CleanupExecutionResult | null
│      ├── filesDeleted  : number
│      └── error         : string | undefined
└── nextExecutionAt      : Date | null — computed on save
```

---

## Value Objects

### CleanupFrequency (enum)

```
EVERY_5_MIN    → cron: */5 * * * *    → label: "Every 5 minutes"
EVERY_15_MIN   → cron: */15 * * * *   → label: "Every 15 minutes"
EVERY_30_MIN   → cron: */30 * * * *   → label: "Every 30 minutes"
EVERY_HOUR     → cron: 0 * * * *      → label: "Every hour"
EVERY_6_HOURS  → cron: 0 */6 * * *    → label: "Every 6 hours"
EVERY_12_HOURS → cron: 0 */12 * * *   → label: "Every 12 hours"
EVERY_DAY      → cron: 0 0 * * *      → label: "Every day"
EVERY_WEEK     → cron: 0 0 * * 0      → label: "Every week"
```

### FileExtensionsValueObject

- Input: `string[]` (e.g. `['xml', '.CSV', '.xml']`)
- Validation: at least 1 extension required; each normalized to lowercase with leading dot
- Output: `string[]` deduplicated (e.g. `['.xml', '.csv']`)

---

## Ports (Interfaces)

### ICleanupJobRepository

```
findAll(): Promise<CleanupJob[]>
findAllActive(): Promise<CleanupJob[]>
findById(id: string): Promise<CleanupJob | null>
findByDirectoryPath(path: string): Promise<CleanupJob | null>
findByDirectoryPaths(paths: string[]): Promise<CleanupJob[]>
create(job: CleanupJob): Promise<CleanupJob>
update(job: CleanupJob): Promise<CleanupJob>
delete(id: string): Promise<void>
```

### ICleanupScheduler

```
scheduleJob(job: CleanupJob): void           — register in SchedulerRegistry
unscheduleJob(jobId: string): void           — remove from SchedulerRegistry
rescheduleJob(job: CleanupJob): void         — unschedule + schedule
getNextExecution(frequency: CleanupFrequency): Date
isScheduled(jobId: string): boolean
```

---

## State Transitions

```
[No Job]
    │ POST /cleanup-jobs (create)
    ▼
[Active] ◄─────────────────────────── PATCH /:id/toggle { isActive: true }
    │
    │ PATCH /:id/toggle { isActive: false }
    ▼
[Inactive]
    │
    │ DELETE /:id
    ▼
[Deleted / No Job]
```

---

## Paths Overview Extension

The `PathOverview` read model is extended with:

```
PathOverview
├── path          : string
├── displayPath   : string
├── canListFiles  : boolean
├── schema        : PathSchemaInfo | null
└── cleanupJob    : CleanupJobInfo | null    ← NEW
       ├── id            : string
       ├── extensions    : string[]
       ├── frequency     : string (enum label)
       ├── isActive      : boolean
       └── nextExecutionAt : string (ISO) | null
```

---

## Migration

New migration: `CreateCleanupJobTable` — creates `cleanup_jobs` table with all columns, unique constraint on `directoryPath`, `uuid_generate_v4()` default.
