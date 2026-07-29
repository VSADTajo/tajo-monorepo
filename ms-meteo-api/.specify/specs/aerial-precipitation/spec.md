# Feature: Aerial Precipitation Ingestion & Query

**Status**: Draft (clarified)
**Created**: 2026-07-19
**Last Updated**: 2026-07-20

---

## Overview

The meteo service must ingest, persist and expose **areal (polygon-averaged) precipitation time series** delivered by the customer's FEWS pipeline as JSON files dropped in SFTP. Data covers three geographic layers (Sistemas de Explotación, AEMET MeteoAlerta zones, Subcuencas NAM), three data sources (EPS ensemble, Harmonie deterministic, SAIH observed) and three accumulation windows (1h, 12h, 24h). The frontend later queries these series to render precipitation over the map polygons and time-series charts.

The feature is a fully server-side aggregate; it does not touch existing simulation or prediction flows. It follows the same operational pattern as the current FEWS ingestion (SFTP polling via the sftp service, file-move-to-history on success, idempotent re-processing).

---

## User Scenarios

### US1: Continuously ingest new precipitation JSONs from SFTP [P1]

**As a** platform operator
**I want** the system to detect new FEWS precipitation JSON files landed on SFTP and persist them
**So that** downstream consumers (frontend, analysts) always have up-to-date areal precipitation for every polygon of the Tajo basin

**Acceptance Criteria:**
- Given a new file matching the naming convention `tagus_{eps|harmonie|saih}_Pareal_YYYYMMDDHHMMSS.json` exists in the configured SFTP directory
- When the ingest cycle runs (periodically, on a configurable interval)
- Then the file's series are parsed, persisted with derived provider/layer/stat/accumulation fields, and the source file is moved to the `historial/` subfolder

**Edge Cases:**
- File is malformed / not valid JSON → the file is archived into `corrupted/` with a `.<epochMs>` suffix (mirroring the existing `ms-model-api` ingest convention) so that (a) it is not re-attempted, (b) the failure is auditable, and (c) it does not pollute the active directory. The run continues with the remaining files.
- File contains a series with `parameterId` that does not match the known pattern (`P.areal.{provider}.{layer}[.{stat}][.{accum}]`) → the series is skipped and a warning is logged; other series in the same file are processed normally.
- Event value equals `missVal` (`-999.0`) or has a non-approved flag → the event is filtered out (not persisted).
- Ingest runs concurrently on the same file (e.g., a slow previous run) → only one instance ever persists (idempotent by natural key + advisory lock or equivalent).

---

### US2: Re-run the same file without producing duplicates [P1]

**As a** platform operator
**I want** reprocessing a JSON that was already ingested to leave the system in the exact same state
**So that** replays for troubleshooting or after a hotfix are safe

**Acceptance Criteria:**
- Given a JSON file has already been fully processed
- When the same file (or an identical copy) is reprocessed
- Then no duplicate series or events are created; the existing series and its events remain, with the same total counts and values

**Edge Cases:**
- A new file for the SAME `(locationId, parameterId, forecastDate)` arrives with UPDATED event values (e.g., a corrected forecast) → the existing series' events are REPLACED with the new set atomically.
- A new file for a SAME `(locationId, parameterId)` but DIFFERENT `forecastDate` arrives → both series coexist (see US3).

---

### US3: Query the latest forecast per polygon [P1]

**As a** frontend consuming the map view
**I want** to fetch, for a chosen layer + provider + accumulation, the LATEST forecast series available for every polygon
**So that** the map can be colored by "current best" precipitation without the client having to sift through historical forecasts

**Acceptance Criteria:**
- Given multiple forecast series exist for the same `(locationId, parameterId)` at different `forecastDate` values
- When the client requests `/aerial-precipitation/latest` with a `layer`, `provider` and `accumulation` filter
- Then the response contains exactly one series per polygon (the one with the maximum `forecastDate`), including its summary metrics (max, last)

**Edge Cases:**
- Filter matches no series → returns an empty list with 200 (never 404).
- Layer has 137 polygons but only 100 have data yet → returns 100 entries.
- Multiple providers requested at once → single provider per call (client makes one request per provider).

---

### US4: Query a specific polygon's series (all providers) [P1]

**As a** frontend consuming a "polygon detail" panel
**I want** to fetch every active series for a given `locationId`, grouped by provider and accumulation
**So that** the panel can render observed + all forecasts (Harmonie, EPS Med, EPS Max) side by side

**Acceptance Criteria:**
- Given a `locationId` like `Cuenca.NAM.E_08` has series from multiple providers and accumulations
- When the client requests `/aerial-precipitation/by-location/:locationId`
- Then the response contains all active series (default: only the latest `forecastDate` per `(provider, accumulation, stat)`) with their headers and summary metrics

**Edge Cases:**
- `locationId` is unknown or has zero series ingested → 200 with an empty list (`groups: []`), never 404. The service cannot distinguish "unknown polygon" from "no data yet", and clients treat both the same.
- Client wants the full historical forecast fan → passes `?fromForecastDate=X` and/or `?toForecastDate=Y`; the endpoint then returns every matching snapshot (not only the latest per group).

---

### US5: Fetch header-only vs. header + events [P1]

**As a** frontend
**I want** to control whether the response includes the full `events[]` array or only the header + summary (`max`, `last`)
**So that** list/map views stay cheap while detail views can request the full time series

**Acceptance Criteria:**
- Given a client requests any list endpoint WITHOUT `includeEvents=true`
- Then each series returned includes header fields + a computed summary (`max`, `last`), but no `events[]` array
- Given the client requests the same endpoint WITH `includeEvents=true`
- Then each series includes the ordered `events[]` (event-date ASC)

**Edge Cases:**
- Series has zero valid events (all filtered as `missVal` or non-approved) → `max` and `last` are `null`, `events[]` is `[]` when requested.

---

### US6: Parameter ID parsing tolerant to case inconsistencies [P2]

**As a** platform maintainer
**I want** the parameter-ID parser to handle case inconsistencies in the accumulation suffix (`.12H` vs `.12h`)
**So that** files from different upstream providers (Harmonie vs. SAIH) do not create parallel "duplicate" categories that fragment the data

**Acceptance Criteria:**
- Given a series has `parameterId=P.areal.harmonie.subcNAM.12H`
- When it is persisted
- Then its derived `accumulation` field equals `12h` (normalized to lowercase)

**Edge Cases:**
- Suffix is missing (`P.areal.harmonie.subcNAM`) → `accumulation` is treated as `1h` (default per FEWS convention: base timestep).

---

### US7: Serve queries from cache when hot [P2]

**As a** platform user
**I want** repeated queries within a short window to be served from cache
**So that** map panning + slider interactions feel instant

**Acceptance Criteria:**
- Given the same filter combination is requested twice within the cache TTL
- Then the second request is served without hitting the persistence layer
- Given an ingest run persists new series
- When it completes
- Then all cached entries for the aerial-precipitation namespace are invalidated (pattern-based delete) so the next request re-fetches fresh data

**Edge Cases:**
- Cache miss (first request) still completes in acceptable time (see success criteria).
- Ingest run partially fails (some files OK, others archived as `.failed`) → cache is still invalidated at the end of the run because at least some new data was persisted.

---

## Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-001 | The system MUST poll the configured SFTP directory on a configurable interval and detect new files matching the three naming prefixes. | P1 |
| FR-002 | For each detected file, the system MUST download it, validate it is JSON conforming to the expected FEWS shape (`{version, timeZone, timeSeries[]}`) and persist every series with events. | P1 |
| FR-003 | The system MUST derive `provider`, `layer`, `stat`, `accumulation` from `parameterId` at persist-time (parsing is case-insensitive on the accumulation suffix). | P1 |
| FR-004 | The system MUST filter out events whose value equals `missVal` and MUST filter out events whose `flag` indicates non-approved data. | P1 |
| FR-005 | Persistence MUST be idempotent by the natural key `(locationId, parameterId, forecastDate)`: re-processing the same file leaves the same rows unchanged; a new file with same natural key REPLACES the events atomically. | P1 |
| FR-006 | On successful processing the source file MUST be moved to a `historial/` subfolder under the configured SFTP directory. | P1 |
| FR-007 | A file that fails to parse or fails to persist MUST NOT block the rest of the run. The failure MUST be logged with the file path and error. The failed file MUST be archived into `corrupted/` with a `.<epochMs>` suffix (mirroring the existing model-api convention) so it is never re-attempted automatically and remains available for post-mortem. | P1 |
| FR-008 | Forecast snapshots MUST be retained for a configurable window (env-driven, default 30 days). A scheduled cleanup MUST run daily and MUST delete every series whose `forecastDate` is older than `NOW - retentionDays` together with its events, in one transactional unit per series. | P1 |
| FR-009 | The system MUST expose a paginated list query filterable by `layer`, `provider`, `locationId` (single or list), `accumulation`, `stat`, `fromForecastDate`, `toForecastDate`, and `includeEvents` (bool). | P1 |
| FR-010 | The system MUST expose a "latest per polygon" query filterable by `layer`, `provider`, `accumulation` (and optionally `stat`), returning one series per polygon with the highest `forecastDate` available. | P1 |
| FR-011 | The system MUST expose a "by location" query returning all series for a specific `locationId`, grouped by `(provider, accumulation, stat)` and defaulting to the latest `forecastDate` per group. | P1 |
| FR-012 | Every list response MUST include, per series, the header fields (location, provider, layer, stat, accumulation, forecastDate, startDate, endDate, units, lat, lon, stationName), computed `max` and `last` summary events, and — only when explicitly requested — the full ordered `events[]` array. | P1 |
| FR-013 | List queries MUST support pagination and MUST reject unknown query parameters with a 400 response. | P1 |
| FR-014 | Read queries MUST be cached with a configurable TTL (default 60 seconds for filtered lists, 300 seconds for the "latest per polygon" query). Cache keys MUST include every filter that alters the response shape. At the end of every ingest run that persisted at least one series, the entire `aerial-precipitation:*` cache namespace MUST be invalidated via a pattern-based delete so subsequent reads reflect the freshly ingested data. | P2 |
| FR-015 | The public gateway MUST expose the same three read endpoints as a passthrough with equivalent request/response documentation. | P1 |
| FR-016 | The parser and the persistence layer MUST NOT accept series whose `parameterId` does not match the expected pattern; such series are skipped with a warning and do not fail the file. | P1 |
| FR-017 | The system MUST persist enough of the FEWS header to allow round-trip reconstruction of the ingested series for audit purposes (all header fields except `x`, `y`, `z` when redundant with `lat`, `lon`). | P2 |

---

## Success Criteria

> Technology-agnostic, measurable outcomes

- [ ] After a JSON file lands in the SFTP directory, the data is queryable through the read endpoints within one poll interval (default: five minutes).
- [ ] Re-processing a JSON file already in `historial/` (manually copied back) produces zero new rows and does not change existing data.
- [ ] For the three shipped sample files (eps, harmonie, saih), the system persists exactly 3132 series (174 polygons × 18 params) with a combined ~29k valid events (after filtering `missVal`) with no manual intervention.
- [ ] `/aerial-precipitation/latest?layer=subcNAM&provider=harmonie&accumulation=24h` returns exactly one series per NAM polygon and each series has a valid `last` event.
- [ ] `/aerial-precipitation/by-location/Cuenca.NAM.E_08` returns at least one series per available provider (`obs`, `harmonie`, `ens`) whenever those providers have ingested data.
- [ ] A list request with `includeEvents=false` (default) returns a payload at least 5x smaller than the same request with `includeEvents=true`.
- [ ] Under repeated identical queries within the cache TTL, the median response time is under 50ms (cache hit).
- [ ] Any unknown query parameter returns 400 with a machine-readable error code.
- [ ] The API documentation exposed by the gateway lists every query parameter with example values and shows a full example response including a real threshold snapshot when applicable.
- [ ] Running the retention cleanup on a database seeded with forecasts older than the retention window removes exactly those series (and their events) and leaves everything within the window untouched.
- [ ] After an ingest run persists at least one series, an immediate re-query returns the freshly ingested data — no stale cache hit is served.
- [ ] A JSON file that cannot be parsed appears in `corrupted/` with a `.<epochMs>` suffix and does not re-appear in subsequent poll cycles.

---

## Assumptions

- The FEWS-standard JSON shape does not change during the life of this feature (schema-versioned via `version` field; the code targets `1.34`).
- The SFTP directory + credentials are already provisioned and accessible from the meteo service via the existing sftp service (same integration point used by other ingest jobs).
- The polygon geometries and the `FEWS` linkage column are maintained in the GeoServer PostGIS database outside the scope of this feature. The meteo service only stores the `locationId` string; joining to geometry happens in the frontend / hydro service.
- The three sample files provided by the customer are representative of production payload sizes (~2–5 MB, 500–1000 series, 24–72 hourly events per series).
- The current model-api → predictions pipeline is not touched. Aerial precipitation lives in a separate service and set of tables.
- Structured logging follows the same JSON logger + trace ID conventions used by the other backend services.
- Every locationId observed in production matches a polygon whose `FEWS` column is populated in PostGIS; unknown location IDs are tolerated (series is still persisted) so upstream can catch up.

---

## Out of Scope

- Any frontend map/chart/table visualization work.
- Bootstrapping or updating the shapefiles / polygon geometries in the GeoServer PostGIS database.
- Changes to the existing FEWS pipeline that ingests station-level predictions (`ms-model-api` → `ms-predictions-api`).
- Alerting or notification when a file fails or when a polygon exceeds a precipitation threshold.
- Historical bulk backfill from files older than the retention window.
- Emission of RabbitMQ events on ingest completion (may be added later if a downstream service needs them).
- Multi-tenant isolation; the feature assumes a single Tajo tenant.
