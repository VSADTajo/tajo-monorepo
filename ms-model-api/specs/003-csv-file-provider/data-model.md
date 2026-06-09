# Data Model: CSV File Provider

## No New Entities or Migrations Required

This feature reuses existing entities and adds no new database tables.

## Existing Entities Used

### ProviderConfig (existing, no changes)

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | PK |
| name | VARCHAR(255) | e.g., "FlowCast Observados" |
| type | VARCHAR(20) | New value: `CSV_FILE` |
| baseUrl | VARCHAR(500) | ms-sftp-api URL |
| pollingIntervalMinutes | INTEGER | >= 5 |
| isActive | BOOLEAN | Enables scheduled polling |
| settings | JSONB | CSV-specific config (see below) |

**CSV_FILE settings structure**:
```json
{
    "filePath": "/path/to/csv/directory",
    "filePrefix": "Tagus_FlowCast"
}
```

### IngestionRun (existing, no changes)

Used as-is to track CSV ingestion runs (status, counts, timestamps).

## Enum Change

### ProviderType

| Value | Status |
|-------|--------|
| FEWS_API | Existing |
| SFTP_FILE | Existing |
| CSV_FILE | **New** |

## Internal Data Structures (not persisted)

### CsvStationBlock (new, in-memory only)

Intermediate representation of a parsed CSV block before normalization.

| Field | Type | Source |
|-------|------|--------|
| stationSite | string | "Station Site:" header line |
| stationName | string | "Station Name:" header line |
| stationNumber | string | "Station Number:" header line |
| localX | number | "LocalX:" header line |
| localY | number | "LocalY:" header line |
| parameterName | string | "Parameter Name:" header line |
| parameterType | string | "Parameter Type:" header line (Q or Precip) |
| parameterTypeName | string | "Parameter Type Name:" header line |
| timeSeriesName | string | "Time series Name:" header line |
| timeSeriesUnit | string | "Time series Unit:" header line |
| longitude | number | "Longitude:" header line |
| latitude | number | "Latitude:" header line |
| events | CsvEvent[] | Data lines after header |

### CsvEvent (new, in-memory only)

| Field | Type | Source |
|-------|------|--------|
| timestamp | string | ISO 8601 converted from DD/MM/YYYY;HH:MM:SS |
| value | number | Parsed numeric value (0 if missing) |
| isMissing | boolean | true if raw value was "---" |

## Mapping: CsvStationBlock → NormalizedTimeSeriesResult

| NormalizedTimeSeriesResult field | Source |
|----------------------------------|--------|
| locationId | stationNumber |
| parameterId | `${parameterType}.historical` |
| moduleInstanceId | `"FlowCast"` (fixed) |
| stationName | stationName |
| lat | latitude |
| lon | longitude |
| x | localX |
| y | localY |
| z | undefined |
| units | timeSeriesUnit |
| timeStep | Q → {MINUTE, 15}, Precip → {MINUTE, 60} |
| forecastDate | First event timestamp |
| startDate | First event timestamp |
| endDate | Last event timestamp |
| events | Mapped CsvEvents → TimeSeriesEventResult[] |

## Downstream Impact (ms-predictions-api)

No changes. The published `NormalizedTimeSeriesResult` with `parameterId: "Q.historical"` flows through:

1. RabbitMQ topic `timeseries.ingested`
2. `ProcessTimeSeriesHandler` creates PredictionType with name `Q.historical`
3. Historical endpoint filters `WHERE name LIKE '%historical%'` — matches
