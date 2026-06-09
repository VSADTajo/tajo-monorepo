# Data Model: Generic Notification Service

**Branch**: `001-notifications-api` | **Date**: 2026-03-20

## Entities

### Notification

A generic, source-agnostic record of a noteworthy event in the platform.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK, auto-generated | Unique identifier |
| type | VARCHAR(100) | NOT NULL | Free-form category (e.g., "THRESHOLD_EXCEEDED", "SYSTEM_ALERT") |
| source | VARCHAR(100) | NOT NULL | Originating service (e.g., "ms-predictions-api") |
| title | VARCHAR(255) | NOT NULL | Human-readable notification title |
| message | TEXT | NOT NULL | Detailed notification message |
| metadata | JSONB | NULLABLE, DEFAULT '{}' | Flexible domain-specific payload (max 10KB) |
| severity | ENUM | NOT NULL, values: INFO, WARNING, CRITICAL | Notification severity level |
| status | ENUM | NOT NULL, DEFAULT 'UNREAD', values: UNREAD, READ, ARCHIVED | Lifecycle status |
| createdAt | TIMESTAMP | NOT NULL, auto-set | Record creation time |
| updatedAt | TIMESTAMP | NOT NULL, auto-set | Last modification time |

### State Transitions

```
                  mark as read          archive
    UNREAD ─────────────────► READ ──────────────► ARCHIVED
       │                                              ▲
       └──────────────────────────────────────────────┘
                        archive (direct)
```

- `UNREAD → READ`: Via mark-as-read endpoint (single or bulk)
- `READ → ARCHIVED`: Via archive endpoint (single or bulk)
- `UNREAD → ARCHIVED`: Via archive endpoint (skip READ state)
- No reverse transitions (no un-archive or un-read)

### Indexes

| Name | Columns | Type | Purpose |
|------|---------|------|---------|
| PK_notifications | id | PRIMARY | Primary key lookup |
| IDX_notifications_status_created | (status, createdAt DESC) | BTREE | Default list query (filter by status, order by date) |
| IDX_notifications_source_created | (source, createdAt DESC) | BTREE | Filter by source service |
| IDX_notifications_severity_created | (severity, createdAt DESC) | BTREE | Filter by severity level |
| IDX_notifications_type_created | (type, createdAt DESC) | BTREE | Filter by notification type |

### Enums

**notification_severity_enum**: `INFO`, `WARNING`, `CRITICAL`

**notification_status_enum**: `UNREAD`, `READ`, `ARCHIVED`

### Validation Rules

- `type`: 1-100 characters, trimmed, non-empty
- `source`: 1-100 characters, trimmed, non-empty
- `title`: 1-255 characters, trimmed, non-empty
- `message`: 1+ characters, non-empty
- `metadata`: Valid JSON, max 10KB when serialized (`JSON.stringify(metadata).length <= 10240`)
- `severity`: Must be one of INFO, WARNING, CRITICAL
- `status`: Must be one of UNREAD, READ, ARCHIVED

### Migration

Single migration: `{timestamp}-create-notifications-table.ts`

```sql
CREATE TYPE notification_severity_enum AS ENUM ('INFO', 'WARNING', 'CRITICAL');
CREATE TYPE notification_status_enum AS ENUM ('UNREAD', 'READ', 'ARCHIVED');

CREATE TABLE notifications (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    type VARCHAR(100) NOT NULL,
    source VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    severity notification_severity_enum NOT NULL,
    status notification_status_enum NOT NULL DEFAULT 'UNREAD',
    "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IDX_notifications_status_created ON notifications (status, "createdAt" DESC);
CREATE INDEX IDX_notifications_source_created ON notifications (source, "createdAt" DESC);
CREATE INDEX IDX_notifications_severity_created ON notifications (severity, "createdAt" DESC);
CREATE INDEX IDX_notifications_type_created ON notifications (type, "createdAt" DESC);
```
