# Data Model: Data Provider Layer

**Feature**: 002-data-provider-layer
**Date**: 2026-03-11

## Entities

### ProviderConfig

Represents an external data source configuration. Determines how and when the system connects to fetch hydrological time series data.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK, auto-generated | Unique identifier |
| name | VARCHAR(255) | NOT NULL, UNIQUE | Human-readable provider name (e.g., "FEWS Tajo Production") |
| type | VARCHAR(20) | NOT NULL, CHECK(FEWS_API, SFTP_FILE) | Provider implementation type |
| baseUrl | VARCHAR(500) | NOT NULL | Base URL for the external service |
| pollingIntervalMinutes | INTEGER | NOT NULL, CHECK(>= 5) | How often to poll (in minutes) |
| isActive | BOOLEAN | NOT NULL, DEFAULT false | Whether scheduled polling is enabled |
| settings | JSONB | NOT NULL, DEFAULT '{}' | Type-specific configuration (see below) |
| createdAt | TIMESTAMP | NOT NULL, DEFAULT now() | Creation timestamp |
| updatedAt | TIMESTAMP | NOT NULL, DEFAULT now() | Last update timestamp |

**Settings JSONB structure by type**:

For `FEWS_API`:
```json
{
    "filterId": "NAM_EPS",
    "locationIds": ["AR01", "AR02"],
    "parameterIds": ["Q.NAM.ens.Med", "Q.NAM.ens.10"],
    "documentFormat": "PI_JSON"
}
```

For `SFTP_FILE`:
```json
{
    "filePathPattern": "/forecast/ForecastNAM_EPSstat_*.xml",
    "fileFormat": "PI_XML",
    "sftpUserId": "uuid-of-sftp-user"
}
```

**Validation rules**:
- `name` must be non-empty, max 255 chars (NameValueObject or similar)
- `type` must be a valid ProviderType enum value
- `baseUrl` must be a valid URL format (BaseUrlValueObject)
- `pollingIntervalMinutes` must be >= 5 (PollingIntervalValueObject)
- `settings` validated at application level based on `type`

**Relationships**:
- Has many IngestionRun (one-to-many)

---

### IngestionRun

Represents a single execution of the data ingestion pipeline for a specific provider. Provides audit trail and monitoring data.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK, auto-generated | Unique identifier |
| providerConfigId | UUID | NOT NULL, FK → provider_configs.id | Reference to the provider |
| status | VARCHAR(20) | NOT NULL, CHECK(SUCCESS, FAILED, PARTIAL) | Outcome of the ingestion |
| startedAt | TIMESTAMP | NOT NULL | When the ingestion started |
| completedAt | TIMESTAMP | NULL | When the ingestion completed (null if still running) |
| seriesCount | INTEGER | NOT NULL, DEFAULT 0 | Number of time series processed |
| eventsCount | INTEGER | NOT NULL, DEFAULT 0 | Total number of events across all series |
| errorMessage | TEXT | NULL | Error details if status is FAILED or PARTIAL |
| createdAt | TIMESTAMP | NOT NULL, DEFAULT now() | Creation timestamp |
| updatedAt | TIMESTAMP | NOT NULL, DEFAULT now() | Last update timestamp |

**Validation rules**:
- `providerConfigId` must be a valid UUID reference
- `status` must be a valid IngestionStatus enum value
- `startedAt` must be present
- `completedAt` must be after `startedAt` (if present)

**Relationships**:
- Belongs to one ProviderConfig (many-to-one)

---

## Domain Types (non-persisted)

### NormalizedTimeSeries

The common internal format that all providers normalize data into. Not persisted — published to RabbitMQ.

| Field | Type | Description |
|-------|------|-------------|
| locationId | string | Station identifier (e.g., "AR01") |
| parameterId | string | Measurement type (e.g., "Q.NAM.ens.Med") |
| moduleInstanceId | string | Model run identifier (e.g., "EnsembleStat_EPS_NAM_Alt") |
| stationName | string | Human-readable station name |
| lat | number | Latitude |
| lon | number | Longitude |
| x | number (optional) | X coordinate (projected) |
| y | number (optional) | Y coordinate (projected) |
| z | number (optional) | Elevation |
| units | string | Measurement units (e.g., "m3/s") |
| timeStep | { unit: string, multiplier: number } | Time step definition |
| forecastDate | string | ISO date of the model run |
| startDate | string | ISO date of the first event |
| endDate | string | ISO date of the last event |
| events | TimeSeriesEvent[] | Time series data points |

### TimeSeriesEvent

| Field | Type | Description |
|-------|------|-------------|
| timestamp | string | ISO datetime (combined date + time) |
| value | number | Measured/forecasted value |
| flag | number | Quality flag (0 = ok, 8 = missing, etc.) |
| isMissing | boolean | True if value equals missVal or flag indicates missing |

---

## Enums

### ProviderType
```
FEWS_API   — Deltares FEWS REST API
SFTP_FILE  — SFTP files via ms-sftp-api
```

### IngestionStatus
```
SUCCESS  — All data fetched, parsed, and published successfully
FAILED   — Ingestion failed (source unreachable, parse error, publish error)
PARTIAL  — Some data processed successfully, some rows/series failed
RUNNING  — Ingestion currently in progress
```

---

## State Transitions

### IngestionRun Lifecycle

```
[Created] → RUNNING → SUCCESS
                    → FAILED
                    → PARTIAL
```

- Created with status=RUNNING when ingestion starts
- Transitions to SUCCESS, FAILED, or PARTIAL on completion
- `completedAt` is set on any terminal transition
- No re-transitions from terminal states

### ProviderConfig Active/Inactive

```
[Created (inactive)] → Active ↔ Inactive → [Deleted]
```

- Created as inactive by default
- Toggle between active/inactive at any time
- Activation registers the CRON job; deactivation removes it
- Deletion removes the CRON job and soft-deletes (or hard-deletes) the config

---

## Database Migration

```sql
-- provider_configs table
CREATE TABLE "provider_configs" (
    "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "name" character varying(255) NOT NULL,
    "type" character varying(20) NOT NULL,
    "baseUrl" character varying(500) NOT NULL,
    "pollingIntervalMinutes" integer NOT NULL DEFAULT 360,
    "isActive" boolean NOT NULL DEFAULT false,
    "settings" jsonb NOT NULL DEFAULT '{}',
    CONSTRAINT "PK_provider_configs_id" PRIMARY KEY ("id"),
    CONSTRAINT "UQ_provider_configs_name" UNIQUE ("name"),
    CONSTRAINT "CHK_provider_configs_type" CHECK ("type" IN ('FEWS_API', 'SFTP_FILE')),
    CONSTRAINT "CHK_provider_configs_interval" CHECK ("pollingIntervalMinutes" >= 5)
);

-- ingestion_runs table
CREATE TABLE "ingestion_runs" (
    "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "providerConfigId" uuid NOT NULL,
    "status" character varying(20) NOT NULL,
    "startedAt" TIMESTAMP NOT NULL,
    "completedAt" TIMESTAMP,
    "seriesCount" integer NOT NULL DEFAULT 0,
    "eventsCount" integer NOT NULL DEFAULT 0,
    "errorMessage" text,
    CONSTRAINT "PK_ingestion_runs_id" PRIMARY KEY ("id"),
    CONSTRAINT "FK_ingestion_runs_provider" FOREIGN KEY ("providerConfigId") REFERENCES "provider_configs"("id") ON DELETE CASCADE,
    CONSTRAINT "CHK_ingestion_runs_status" CHECK ("status" IN ('RUNNING', 'SUCCESS', 'FAILED', 'PARTIAL'))
);

-- Index for querying runs by provider
CREATE INDEX "IDX_ingestion_runs_provider" ON "ingestion_runs" ("providerConfigId");
CREATE INDEX "IDX_ingestion_runs_started" ON "ingestion_runs" ("startedAt" DESC);
```
