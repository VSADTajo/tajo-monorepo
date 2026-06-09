# Feature Specification: CSV File Provider for FlowCast Historical Data Ingestion

**Feature Branch**: `003-csv-file-provider`  
**Created**: 2026-04-21  
**Status**: Draft  
**Input**: User description: "Add a new CSV_FILE provider type to ms-model-api that parses Tagus_FlowCast.csv multi-block files containing historical observed hydrological data (caudal and precipitation) from ~220 stations, normalizes them to the existing time series format, and publishes to RabbitMQ for downstream consumption by ms-predictions-api as historical data."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Automated Ingestion of FlowCast CSV Files (Priority: P1)

An operator uploads a Tagus_FlowCast.csv file to the SFTP server. The system automatically detects the new file, downloads it, parses all station blocks (header metadata + time series events), normalizes the data, and publishes it to the message queue. The downstream predictions service stores it as historical observed data, accessible via the existing historical predictions endpoint.

**Why this priority**: This is the core value of the feature. Without automated ingestion, there is no way to get FlowCast observed data into the platform.

**Independent Test**: Can be fully tested by uploading a sample CSV file to the configured SFTP directory, triggering ingestion, and verifying the parsed data appears in the downstream historical predictions endpoint for the expected stations.

**Acceptance Scenarios**:

1. **Given** a Tagus_FlowCast.csv file is placed in the configured SFTP directory, **When** the ingestion runs (scheduled or manual trigger), **Then** all station blocks are parsed and published as normalized time series to the message queue.
2. **Given** a CSV file with both Q (caudal) and Precip (precipitation) parameter types, **When** ingestion completes, **Then** each block is published with the correct parameter identifier ("Q.historical" or "Precip.historical"), units, and station metadata.
3. **Given** a CSV file with missing values marked as "---", **When** events are parsed, **Then** those entries are marked as missing (flag=8, isMissing=true) and not treated as zero-value measurements.
4. **Given** ingestion completes successfully, **When** the file is fully processed, **Then** it is moved to a historial/ subdirectory to prevent reprocessing.

---

### User Story 2 - Manual Trigger of CSV Ingestion (Priority: P2)

An operator wants to manually trigger the ingestion of a FlowCast CSV file without waiting for the next scheduled polling cycle. They use the existing trigger ingestion endpoint with the CSV provider configuration ID.

**Why this priority**: Manual triggers are essential for initial setup, debugging, and on-demand data loads outside the regular schedule.

**Independent Test**: Can be tested by calling the existing trigger ingestion endpoint with the CSV_FILE provider config ID and verifying the file is processed.

**Acceptance Scenarios**:

1. **Given** a CSV_FILE provider configuration exists and a CSV file is available on SFTP, **When** the operator triggers ingestion via the API, **Then** the file is downloaded, parsed, and published successfully.
2. **Given** no CSV files matching the configured prefix exist on SFTP, **When** ingestion is triggered, **Then** the system completes gracefully with zero series processed and logs an informational message.

---

### User Story 3 - Provider Configuration for CSV Files (Priority: P2)

An administrator creates a new provider configuration of type CSV_FILE, specifying the SFTP path where FlowCast CSV files are uploaded, the file prefix to match, and the polling interval.

**Why this priority**: Configuration is required before any ingestion can happen and enables operators to adjust file paths and scheduling without code changes.

**Independent Test**: Can be tested by creating a provider config via the API with type CSV_FILE and verifying it is persisted and appears in the provider list.

**Acceptance Scenarios**:

1. **Given** the administrator submits a provider configuration with type "CSV_FILE", **When** the configuration is saved, **Then** the system accepts it and registers a polling job at the specified interval.
2. **Given** an invalid provider type is submitted, **When** the system validates, **Then** it rejects the request with a clear validation error.

---

### User Story 4 - Historical Data Available Downstream (Priority: P1)

After ingestion, the historical observed data for a given station is queryable through the downstream predictions service's existing historical endpoint. The data is correctly categorized as historical (not forecast) and includes proper station identification, measurement values, timestamps, and units.

**Why this priority**: The end goal is making historical observed data accessible for comparison against predictions. If data is ingested but not queryable, the feature has no value.

**Independent Test**: Can be tested end-to-end by ingesting a sample CSV, then querying the downstream historical endpoint for a known station ID and verifying the returned time series matches the CSV source data.

**Acceptance Scenarios**:

1. **Given** a FlowCast CSV has been ingested with station AR35 (Q type), **When** the historical endpoint is queried for station AR35, **Then** the response includes the time series with correct timestamps, values, and units (m3/s).
2. **Given** the same CSV is ingested twice, **When** the downstream service processes it, **Then** duplicate records are prevented by the existing idempotency mechanism.

---

### Edge Cases

- What happens when a CSV file has a corrupted block (missing header lines or truncated data)? The system should skip the corrupted block, log a warning, and continue processing remaining blocks.
- What happens when the CSV file uses unexpected character encoding? The system should handle ISO-8859-1/Windows-1252 encoded files (common for Spanish/Portuguese text like ALAGON, m3/s, Pluviometria).
- What happens when a station block has zero data lines (header only, no events)? The block should be skipped with a warning log.
- What happens when a data line has a non-numeric, non-missing value (e.g., "N/A", "err")? The event should be treated as missing (flag=8, isMissing=true).
- What happens when multiple CSV files match the prefix in the same polling cycle? All matching files should be processed sequentially, each moved to historial/ after successful processing.
- What happens when the file is very large (>200MB)? The system should process it in a streaming fashion or with bounded memory, not loading the entire file into memory at once.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST support a new provider type "CSV_FILE" that can be configured via the existing provider configuration API.
- **FR-002**: System MUST list files from the SFTP service, filtering by the configured file prefix and `.csv` extension.
- **FR-003**: System MUST parse the multi-block CSV format where each block consists of 15 metadata header lines (Station Site, Station Name, Station Number, LocalX, LocalY, Datum, Parameter Name, Parameter Type, Parameter Type Name, Time series Name, Time series Unit, GlobalX, GlobalY, Longitude, Latitude) followed by N data lines.
- **FR-004**: System MUST parse data lines in `DD/MM/YYYY;HH:MM:SS;value` format, converting timestamps to ISO 8601 and values to numeric.
- **FR-005**: System MUST handle missing values represented as "---" by marking them as missing (value=0, flag=8, isMissing=true).
- **FR-006**: System MUST map each parsed block to the existing normalized time series format with: Station Number as location ID, Parameter Type + ".historical" as parameter identifier, "FlowCast" as module instance, and appropriate coordinate/unit mapping.
- **FR-007**: System MUST handle file encoding for non-ASCII characters (Spanish/Portuguese station names and unit symbols).
- **FR-008**: System MUST publish all parsed time series to the existing message queue topic for downstream consumption.
- **FR-009**: System MUST move successfully processed files to a historial/ subdirectory via the SFTP service.
- **FR-010**: System MUST log the number of blocks parsed, events processed, and any blocks skipped due to errors.
- **FR-011**: System MUST skip corrupted or malformed blocks and continue processing the rest of the file, logging warnings for each skipped block.
- **FR-012**: System MUST integrate with the existing ingestion run tracking (status, counts, timestamps) and concurrency guard mechanisms.

### Key Entities

- **ProviderConfig (CSV_FILE type)**: Configuration for the CSV file provider, including SFTP path, file prefix filter, and polling interval. Uses the same entity as existing providers with type-specific settings in the JSONB field.
- **NormalizedTimeSeriesResult**: The standard output format for all providers. Each CSV station block maps to one instance containing location ID, parameter ID, station metadata, coordinates, units, and time series events.
- **TimeSeriesEventResult**: Individual measurement within a time series. Each CSV data line maps to one event with timestamp, value, quality flag, and missing indicator.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A Tagus_FlowCast.csv file with ~230 station blocks is fully ingested within 60 seconds of triggering, with all valid blocks parsed and published.
- **SC-002**: 100% of valid station blocks in a well-formed CSV are parsed and published (zero data loss for valid data).
- **SC-003**: Historical observed data for any ingested station is queryable via the existing downstream historical endpoint within 2 minutes of ingestion completion.
- **SC-004**: Missing values ("---") are correctly excluded from numeric aggregations and clearly distinguishable from zero-value measurements in query results.
- **SC-005**: Corrupted or malformed blocks do not prevent the processing of remaining valid blocks in the same file.

## Assumptions

- The Tagus_FlowCast.csv format is stable: 15 header lines per block with tab-separated key-value pairs, followed by semicolon-separated data lines. Format changes would require parser updates.
- Files are uploaded to the SFTP server by an external system (FlowCast) and the upload is complete before the polling cycle picks them up. Partial uploads are not expected.
- The module instance identifier "FlowCast" is fixed for all data from this source. If multiple CSV sources with different formats emerge, separate provider types or configurable module instance names may be needed.
- The downstream predictions service does not require any changes. The parameter identifier pattern "*.historical" matches the existing historical data filter.
- The file encoding is ISO-8859-1 or Windows-1252. If files arrive in a different encoding, the parser may need adjustment.
