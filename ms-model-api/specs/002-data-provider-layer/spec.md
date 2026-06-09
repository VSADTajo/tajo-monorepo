# Feature Specification: Data Provider Layer

**Feature Branch**: `002-data-provider-layer`
**Created**: 2026-03-11
**Status**: Draft
**Input**: User description: "Data Provider Layer - External data ingestion adapter for the Hydro Platform. Connects to external hydrological data sources (FEWS REST API, SFTP files via ms-sftp-api), fetches time series forecast data, normalizes it to a common format, and publishes it to a message broker for downstream consumption by predictions-api."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Configure a Data Provider (Priority: P1)

An operator registers a new external data source in the system by specifying its type (FEWS REST API or SFTP file source), connection details (base URL, credentials), polling schedule, and which data filters to apply (location IDs, parameter IDs, date ranges). The configuration is persisted and can be activated or deactivated at any time.

**Why this priority**: Without provider configurations, no data can be fetched. This is the foundational capability that all other stories depend on.

**Independent Test**: Can be fully tested by creating, reading, updating, and deleting provider configurations via the REST API. Delivers value by allowing operators to manage data sources without redeploying.

**Acceptance Scenarios**:

1. **Given** no provider configurations exist, **When** an operator creates a new provider with type "FEWS_API", base URL, and polling interval, **Then** the provider configuration is persisted and returned with a unique identifier and "inactive" status.
2. **Given** a provider configuration exists, **When** an operator updates the polling interval, **Then** the change is persisted and the scheduler picks up the new interval on the next cycle.
3. **Given** a provider configuration exists, **When** an operator activates it, **Then** the provider becomes eligible for scheduled polling.
4. **Given** a provider configuration exists, **When** an operator deactivates it, **Then** scheduled polling stops for that provider.
5. **Given** a provider configuration exists, **When** an operator deletes it, **Then** the configuration is removed and polling ceases.

---

### User Story 2 - Automatic Scheduled Data Ingestion (Priority: P1)

The system automatically polls active data providers on their configured schedule (e.g., every 6 hours). For each active provider, it connects to the external source, fetches new time series data, normalizes it to the platform's common format, and publishes it to the message broker. Each ingestion attempt is logged with status, timing, and record counts.

**Why this priority**: This is the core value proposition — automated, hands-off data collection from external sources. Without this, the platform has no data to serve predictions.

**Independent Test**: Can be tested by configuring a provider pointing to a real or mock external source, waiting for the scheduled interval, and verifying that an ingestion run is logged and messages are published.

**Acceptance Scenarios**:

1. **Given** an active FEWS API provider is configured, **When** the polling interval elapses, **Then** the system fetches time series data from the FEWS endpoint, normalizes it, publishes it to the message broker, and logs a successful ingestion run with the number of series processed.
2. **Given** an active SFTP file provider is configured, **When** the polling interval elapses, **Then** the system requests file listings from ms-sftp-api, downloads new files, parses them (PI-XML or CSV), normalizes the data, publishes it, and logs the ingestion run.
3. **Given** an active provider is configured but the external source is unreachable, **When** the polling interval elapses, **Then** the system logs a failed ingestion run with the error details and does not publish partial data.
4. **Given** multiple active providers exist, **When** their polling intervals elapse, **Then** each provider is polled independently without blocking the others.

---

### User Story 3 - Manual Ingestion Trigger (Priority: P2)

An operator can manually trigger an immediate data fetch for any configured provider, bypassing the scheduled polling interval. This is useful for testing new configurations, recovering from failures, or importing data on demand.

**Why this priority**: Operators need a way to test configurations and recover from failures without waiting for the next polling cycle. Important but not blocking for MVP.

**Independent Test**: Can be tested by triggering a manual fetch via the REST API and verifying the ingestion run is logged.

**Acceptance Scenarios**:

1. **Given** an active provider configuration exists, **When** an operator triggers a manual fetch, **Then** the system immediately executes the data ingestion pipeline and returns the ingestion run result.
2. **Given** an inactive provider configuration exists, **When** an operator triggers a manual fetch, **Then** the system still executes the fetch (manual overrides active/inactive for one-time runs) and returns the result.
3. **Given** a manual fetch is already in progress for a provider, **When** another manual fetch is triggered for the same provider, **Then** the system rejects the request to prevent duplicate fetches.

---

### User Story 4 - View Ingestion History (Priority: P2)

An operator can view the history of ingestion runs for any provider, including status (success, failed, partial), start and end times, number of records processed, and error messages. This provides visibility into the health and performance of data ingestion.

**Why this priority**: Monitoring and troubleshooting are essential for operations but don't block the core data flow.

**Independent Test**: Can be tested by listing ingestion runs via the REST API after some ingestion cycles have executed.

**Acceptance Scenarios**:

1. **Given** several ingestion runs have been recorded for a provider, **When** an operator lists the ingestion history, **Then** the system returns the runs in reverse chronological order with status, timing, and record counts.
2. **Given** a failed ingestion run exists, **When** an operator views its details, **Then** the error message and provider details are visible.
3. **Given** ingestion runs exist for multiple providers, **When** an operator filters by provider, **Then** only that provider's runs are returned.

---

### User Story 5 - Normalized Data Published to Message Broker (Priority: P1)

Regardless of the data source (FEWS API or SFTP files), all ingested time series data is normalized to a common format before being published. The common format preserves the key identifiers (location, parameter, forecast date), metadata (station name, coordinates, units), and time series events (timestamp, value, quality flag). Downstream consumers (predictions-api) receive a consistent message structure.

**Why this priority**: The normalization and publishing is the output contract that predictions-api depends on. Without a stable, source-agnostic format, the entire downstream pipeline breaks.

**Independent Test**: Can be tested by ingesting data from both source types and verifying the published messages have identical structure.

**Acceptance Scenarios**:

1. **Given** a FEWS API provider fetches PI-JSON data, **When** the data is normalized, **Then** each time series contains: locationId, parameterId, moduleInstanceId, forecastDate, stationName, coordinates (lat/lon), units, timeStep, and an array of events with timestamp, value, and quality flag.
2. **Given** an SFTP file provider fetches a PI-XML file, **When** the data is parsed and normalized, **Then** the resulting structure is identical to what FEWS API produces for the same data.
3. **Given** an SFTP file provider fetches a CSV file, **When** the data is parsed and normalized, **Then** the resulting structure matches the common format (with available fields — CSV may have fewer metadata fields than PI-XML).
4. **Given** the data contains missing values (sentinel value -999.0 or flag=8), **When** normalized, **Then** missing values are excluded or clearly marked so downstream consumers can handle them appropriately.

---

### Edge Cases

- What happens when a PI-XML file contains zero series (empty `<TimeSeries>` root)? System logs a successful run with 0 records and publishes nothing.
- How does the system handle a provider whose external source returns a partial response (e.g., timeout mid-download)? Marks run as FAILED, discards partial data, logs the error.
- What happens when a CSV file has malformed rows (missing columns, non-numeric values)? Skips invalid rows, logs warnings, marks run as PARTIAL if some rows succeeded.
- How does the system handle extremely large files (e.g., 50MB+ PI-XML with thousands of series)? Processes data in streaming/chunked fashion to avoid memory exhaustion.
- What happens when the message broker is unavailable at publish time? Marks run as FAILED with broker connectivity error, retries on next cycle.
- How does the system handle duplicate data across ingestion runs (same forecastDate + locationId + parameterId already published)? Publishes anyway — deduplication is the responsibility of the downstream consumer (predictions-api).
- What happens when a FEWS API returns an authentication error or rate limit? Logs the specific HTTP status, marks run as FAILED, does not retry until next cycle.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow operators to create, read, update, and delete data provider configurations.
- **FR-002**: Each provider configuration MUST specify: type (FEWS_API or SFTP_FILE), name, connection details (base URL), polling interval (in minutes), and active/inactive status.
- **FR-003**: FEWS API provider configurations MUST additionally support: filter ID, location IDs, parameter IDs, and response format preference.
- **FR-004**: SFTP file provider configurations MUST additionally support: file path pattern, file format (PI-XML or CSV), and a reference to the SFTP connection managed by ms-sftp-api.
- **FR-005**: System MUST automatically poll each active provider on its configured interval using a scheduled job.
- **FR-006**: System MUST support a manual trigger endpoint that initiates an immediate ingestion for a specified provider.
- **FR-007**: System MUST parse PI-XML format (Deltares Published Interface XML) extracting all series headers and time series events.
- **FR-008**: System MUST parse CSV format with columns: locationId, parameterId, stationName, date, value.
- **FR-009**: System MUST normalize data from all sources to a common internal time series format before publishing.
- **FR-010**: System MUST publish normalized time series data to a message broker topic after each successful ingestion.
- **FR-011**: System MUST log each ingestion attempt as an ingestion run with: provider reference, status (SUCCESS, FAILED, PARTIAL), start time, end time, number of records processed, and error message (if applicable).
- **FR-012**: System MUST provide a read endpoint for listing ingestion runs, filterable by provider.
- **FR-013**: System MUST handle external source failures gracefully — log the error, mark the run as failed, and continue normal operation for the next scheduled cycle.
- **FR-014**: System MUST exclude or mark missing/invalid values (sentinel values like -999.0, quality flag indicating missing) during normalization.
- **FR-015**: System MUST prevent concurrent ingestion runs for the same provider (deduplication guard).
- **FR-016**: System MUST validate provider configurations on creation/update (required fields, valid URL format, positive polling interval).

### Key Entities

- **ProviderConfig**: Represents an external data source configuration. Key attributes: type (FEWS_API | SFTP_FILE), name, base URL, polling interval (in minutes), active flag, source-specific settings (filter ID, location IDs, parameter IDs for FEWS; file path pattern, file format for SFTP). Has a one-to-many relationship with IngestionRun.
- **IngestionRun**: Represents a single execution of the data ingestion pipeline for a provider. Key attributes: status (SUCCESS | FAILED | PARTIAL), started at, completed at, records processed count, error message. Belongs to one ProviderConfig.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Operators can configure a new data provider and see data flowing to the message broker within one polling cycle (configurable, default 360 minutes).
- **SC-002**: Data from both FEWS API and SFTP file sources is normalized to an identical common format — downstream consumers cannot distinguish the origin.
- **SC-003**: Ingestion of a standard forecast file (~275 series, ~576 events each) completes within 60 seconds including parse, normalize, and publish.
- **SC-004**: Failed ingestion runs are logged with actionable error messages, enabling operators to diagnose and resolve issues without developer intervention.
- **SC-005**: Adding a new data source type (beyond FEWS API and SFTP) requires implementing only the provider adapter — no changes to the normalization, publishing, or scheduling layers.
- **SC-006**: The system maintains a complete audit trail of all ingestion activity, queryable by provider and time range.

## Assumptions

- ms-sftp-api is already deployed and accessible via its REST API for file listing and download operations.
- The FEWS REST API supports PI-JSON response format (`documentFormat=PI_JSON`) in addition to PI-XML.
- Provider credentials (API tokens, SFTP connection references) are stored as configuration values — a dedicated secrets management system is not required for MVP.
- The message broker (RabbitMQ) is shared infrastructure already available to both ms-model-api and predictions-api.
- Polling intervals are defined per provider in minutes, with a practical minimum of 5 minutes.
- The system does not need to deduplicate data across ingestion runs at the model-api level — downstream consumers (predictions-api) are responsible for idempotent processing.
- PI-XML files follow the Deltares PI TimeSeries schema version 1.34 as observed in the sample data.
- CSV files always have the header row: `locationId,parameterId,stationName,date,value`.
