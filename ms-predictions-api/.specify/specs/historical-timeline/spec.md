# Feature Specification: Historical Observed Timeline

**Feature Branch**: `historical-timeline`
**Created**: 2026-06-08
**Status**: Draft
**Input**: User description: Reemplazar GET /predictions/historical para que reconstruya la serie temporal observada de UNA estación, UN prediction_type, entre dos fechas, deduplicando por fecha con max(createdAt).

## User Scenarios & Testing

### User Story 1 - Reconstruct an observed series for a station and metric (Priority: P1)

A frontend consumer needs to render the observed time series of a single station for a single metric (e.g., observed discharge, observed precipitation, or a synthetic "WI__01.historical" series) over a bounded date window. The series may have been ingested in multiple passes — possibly across several simulations — and the consumer needs the **most recently ingested value per timestamp** so the rendered curve reflects the latest known truth.

**Why this priority**: This is the entire purpose of the feature. Without it the consumer either receives noisy duplicated points or has to deduplicate client-side using fields that are not currently exposed.

**Independent Test**: Given a station with one or more historical predictions whose results fall in the queried date range, the endpoint returns a deduplicated, date-ordered list of points. Each point in the response corresponds to the latest `createdAt` among all candidate result rows for that timestamp. Testable end-to-end through the HTTP endpoint.

**Acceptance Scenarios**:

1. **Given** one prediction for station `AR35` of type `Q.historical` with three non-duplicated results inside `[2026-03-01, 2026-03-31]`, **When** a consumer requests the timeline for that station, type, and range, **Then** the response contains those three points ordered ascending by `date` with their `value` and `flag` as ingested.

2. **Given** two predictions for station `AR35` of type `Q.historical` (one from simulation A created at `T1`, another from simulation B created at `T2 > T1`) that both contain a result for the same timestamp `2026-03-10T00:00:00Z` with different values, **When** the consumer requests the timeline, **Then** the response contains exactly one point for `2026-03-10T00:00:00Z` with the value from simulation B's result row (the one with the higher `createdAt`).

3. **Given** a single prediction whose results were re-ingested (two rows in the result store with the same timestamp but distinct `createdAt`), **When** the consumer requests the timeline, **Then** only the row with the higher `createdAt` appears in the response.

4. **Given** a station/type combination with no results in the requested range, **When** the consumer requests the timeline, **Then** the response is `200 OK` with an empty `results` array and the requested `stationId` / `predictionType` echoed back.

5. **Given** a request missing any of `stationId`, `predictionType`, `startDate`, `endDate`, or with a non-ISO-8601 date, **When** the consumer calls the endpoint, **Then** the response is `400 Bad Request` describing the offending field.

---

### User Story 2 - Frontend renders observed series for arbitrary prediction types (Priority: P1)

The Vue 3 frontend service that today retrieves observed data is restricted to two known type names (`Q.historical`, `Precip.historical`). The feature must let the consumer pass any valid prediction type name (including synthetic ones such as `WI__01.historical`, `FICT98.historical`) without code changes on the backend.

**Why this priority**: The example URL that motivated this feature (`predictionType=WI__01.historical`) already lives outside the previously hard-coded set. Without this, the new endpoint cannot replace the current one for all consumers.

**Independent Test**: Send a request with a less common but real type such as `WI__01.historical` and confirm the response is shaped identically and behaves the same as for `Q.historical`. Testable end-to-end through the HTTP endpoint plus a single frontend smoke test.

**Acceptance Scenarios**:

1. **Given** the database contains predictions of any type name ending in `.historical`, **When** the consumer requests the timeline for any such name, **Then** the response reconstructs the deduplicated series for that exact type with no special-casing.

2. **Given** the consumer requests a type that exists but has no results for the given station/range, **When** the timeline is requested, **Then** the response is `200 OK` with an empty `results` array.

---

### Edge Cases

- **Inclusive boundaries**: A result whose `date` exactly equals `startDate` or `endDate` is included in the response.
- **Inverted range** (`startDate > endDate`): The response is `200 OK` with an empty `results` array. No 400.
- **Same-timestamp tie on `createdAt`**: If two candidate rows for the same `date` share the exact same `createdAt`, the system MUST pick a deterministic winner; the chosen tie-breaker is the higher result row identifier (most recent insertion).
- **No matching station, type, or prediction**: `200 OK` with empty `results`. The endpoint does not distinguish "station does not exist" from "no data".
- **Result ordering**: Results are ordered strictly ascending by `date`.
- **Time zone**: Input dates are interpreted in UTC; output dates are emitted as ISO 8601 in UTC.
- **Very wide date ranges**: The endpoint does not impose a server-side maximum span. Callers requesting wide windows may receive large payloads; this is acceptable for the current consumer (typical request is one to three months).

## Requirements

### Functional Requirements

- **FR-001**: The system MUST expose a single read-only operation that returns the deduplicated observed timeline for a station, a prediction type, and a date window.
- **FR-002**: The system MUST require all four inputs (`stationId`, `predictionType`, `startDate`, `endDate`) and reject requests missing any of them with a validation error.
- **FR-003**: The system MUST validate that `startDate` and `endDate` are ISO 8601 timestamps and reject otherwise with a validation error.
- **FR-004**: The system MUST include in the response only result rows whose `date` falls within `[startDate, endDate]` (boundaries inclusive).
- **FR-005**: The system MUST consider every prediction whose `(stationId, predictionType.name)` matches the request, regardless of which simulation owns the prediction.
- **FR-006**: For each distinct timestamp present in the candidate result rows, the system MUST emit exactly one point in the response, selected as the row with the highest `createdAt`. If two rows share the same `createdAt`, the row with the higher identifier wins.
- **FR-007**: The system MUST order the returned points by `date` ascending.
- **FR-008**: Each emitted point MUST contain the timestamp (`date`), the numeric measurement (`value`), and the ingestion flag (`flag`). No other fields per point are required.
- **FR-009**: The system MUST echo back the requested `stationId` and `predictionType` at the top level of the response.
- **FR-010**: The system MUST return `200 OK` with an empty `results` array when no candidate rows exist (unknown station, unknown type, inverted range, or simply no data in the window).
- **FR-011**: The system MUST replace the previous behavior of the existing operation — there is no parallel legacy path. The previous shape (a list of predictions with nested results, filtered by name `LIKE '%historical%'`) MUST be removed from the surface area.
- **FR-012**: The frontend consumer that calls this operation MUST be migrated in the same release window so production callers see a coherent contract.

### Key Entities

- **Prediction**: Logical grouping of an observed series for a station and a prediction type within a simulation. Multiple predictions can target the same station and type if they belong to different simulations or were re-created.
- **Prediction Result**: A single measured point belonging to a prediction. Carries a timestamp, a numeric value, an ingestion flag, and an ingestion timestamp (`createdAt`). May have duplicates by timestamp within or across predictions.
- **Prediction Type**: The semantic label for a metric (e.g., observed discharge, observed precipitation). Identified by name.
- **Station**: The physical observation point identified by a short code. Stations are owned by an upstream service; this feature only references them by identifier.

## Success Criteria

### Measurable Outcomes

- **SC-001**: The endpoint returns the deduplicated timeline for a typical one-month range on a single station/type in under 2 seconds on the production hardware.
- **SC-002**: For any given timestamp the response contains at most one point — verified by an integration test that ingests duplicate result rows and asserts the response.
- **SC-003**: The frontend `getHistoricalPredictionService` consumes the new response shape without runtime errors after migration, and a smoke test of the observed-series chart renders correctly for at least one station of each currently-used prediction type.
- **SC-004**: A request missing any required parameter returns `400` and never reaches the database.
- **SC-005**: Removing the previous shape from the contract does not leave any caller in the monorepo broken — verified by repository-wide search for the old response fields (`predictions[].id`, `predictions[].predictedBy`, etc.) returning zero hits outside the migrated frontend code.

## Assumptions

- The `prediction_results.date` column already stores timestamps in a comparable form, and the index on `(date, createdAt)` is sufficient to support the deduplication query at the expected scale.
- All consumers of the current `/predictions/historical` endpoint live inside this monorepo and are reachable for coordinated migration. No external API clients depend on the previous shape.
- The dedup tie-breaker (`createdAt DESC, id DESC`) is acceptable for users — the assumption is that `createdAt` collisions are rare and any deterministic choice within that tie is good enough.

## Out of Scope

- Pagination of the result set — the typical window is bounded and the consumer fetches the whole series.
- Server-side aggregations (averages, maxima, downsampling).
- Authentication or authorization changes — the endpoint inherits the existing security posture of the read endpoints.
- Caching strategy changes — the existing query-level cache is retained with the new filter shape; no new keys, no new invalidation paths.
- Support for multiple stations or multiple prediction types in a single request.
- Backfill or repair of existing data — the dedup happens at read time.
