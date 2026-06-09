# Feature Specification: Meteo Data Ingestion to GeoServer

**Feature Branch**: `001-meteo-ingest`
**Created**: 2026-04-06
**Status**: Draft
**Input**: Build a new microservice (`ms-meteo-api`) that ingests meteorological raster data deposited by external providers (RADAR, HARMONIE, EPS, SAIH) into the SFTP storage and publishes it as time-aware layers in GeoServer so that the platform's frontend and downstream services can consume forecasts and observations through standard OGC services.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Visualize Latest Meteo Forecast on the Map (Priority: P1)

A water-resources analyst opens the Tajo basin web frontend and selects a meteorological variable (e.g. precipitation forecast from HARMONIE). The map displays a colored raster overlay covering the basin with a time slider that lets the analyst step hour-by-hour through the next ~48 hours. The data shown corresponds to the most recent forecast that the providers have delivered to the SFTP, without any manual intervention from operations.

**Why this priority**: This is the core business value. Without it, all the operational machinery is invisible to users. It directly enables decision-making about flood risk, reservoir operations and alerts.

**Independent Test**: After at least one ingest cycle has completed, request the variable's layer through a standard OGC WMS client (any GIS tool) using a TIME parameter and confirm a raster image is returned for each timestamp covered by the latest provider delivery.

**Acceptance Scenarios**:

1. **Given** providers have delivered a complete set of files for a variable to the SFTP, **When** an ingest cycle runs, **Then** that variable is available as a single time-aware layer in GeoServer with one entry per provider time step.
2. **Given** a layer has been published with N time steps, **When** a client requests the layer with a specific TIME value, **Then** the system returns the raster corresponding to that timestamp.
3. **Given** a new forecast set arrives later with a different start date, **When** the next ingest cycle runs, **Then** the new time steps are added to the existing layer alongside the previous ones.

---

### User Story 2 — Discover Available Meteo Datasets (Priority: P1)

A developer integrating a downstream service (e.g. an alerting or modelling component) needs to know, programmatically, which meteorological providers and variables are currently available, what each one represents, what units it uses, what spatial extent it covers and which time range it spans. They call a single HTTP endpoint and receive a structured listing covering every provider and variable currently present in the SFTP.

**Why this priority**: Other services cannot consume meteo data safely without metadata (units, time range, spatial extent). This endpoint is a small, highly-leveraged contract that unlocks many integrations.

**Independent Test**: Call the metadata endpoint and verify the response includes every provider/variable folder currently present in the SFTP, each with its current `info.json` content, the corresponding GeoServer layer name, and the status of its latest ingest run.

**Acceptance Scenarios**:

1. **Given** the SFTP contains providers RADAR, HARMONIE, EPS and SAIH with their respective variables, **When** the consumer requests the global metadata endpoint, **Then** the response includes one entry per (provider, variable) combination with metadata, layer name and last ingest status.
2. **Given** a consumer is interested only in a single provider, **When** they request that provider's metadata, **Then** the response includes only that provider's variables.
3. **Given** a consumer is interested in a single variable, **When** they request the metadata for one specific variable, **Then** the response includes only that variable.

---

### User Story 3 — Automatic Continuous Ingestion (Priority: P1)

The platform operator does not need to do anything for new provider deliveries to become available. As providers periodically refresh files in the SFTP, the system detects the new content on its own schedule and publishes it without manual intervention. If a partial failure happens (e.g. one file in a set could not be processed), the next scheduled run automatically retries the missing items.

**Why this priority**: Operations cannot scale if every refresh requires manual action. Reliability of automatic recovery is what makes the service trustworthy.

**Independent Test**: Drop a previously-unseen file into one of the variable folders in the SFTP, wait for one ingest cycle, and verify the file is reflected in the layer's available time steps without any operator action. Then simulate a failure on one file, wait for the next cycle, and verify the system reprocesses only the failed item.

**Acceptance Scenarios**:

1. **Given** the scheduled ingest interval has elapsed, **When** the worker runs, **Then** every (provider, variable) currently in the SFTP is checked and any missing time steps are processed.
2. **Given** a previous run left some files unprocessed due to a transient error, **When** the next scheduled run executes, **Then** only the missing files are reprocessed (no duplicate work).
3. **Given** an operator wants to force an immediate run for a specific variable, **When** they invoke the manual sync endpoint for that variable, **Then** the system runs the ingest pipeline for that variable on demand and reports the result.

---

### User Story 4 — New Provider Variable Auto-Discovered (Priority: P2)

A meteorological provider starts publishing a new variable (e.g. a new ensemble percentile) by creating a new subfolder with its own metadata file in the SFTP. Without any code change or deployment, the platform picks up the new variable on the next ingest cycle and starts publishing it.

**Why this priority**: Adding variables is expected to be frequent. Hard-coding provider/variable lists would create constant friction. This story validates the dynamic-discovery design.

**Independent Test**: Create a new variable folder under any provider with a valid metadata file and at least one raster, wait one cycle, and verify a new layer appears in GeoServer and the metadata endpoint includes the new entry.

**Acceptance Scenarios**:

1. **Given** a brand-new variable folder appears in the SFTP with a valid metadata file, **When** the next ingest cycle runs, **Then** the system creates a new layer for it and processes its files.
2. **Given** a folder exists but its metadata file is missing or malformed, **When** the cycle runs, **Then** the folder is skipped, the issue is logged, and other variables continue to be processed.

---

### User Story 5 — Auditability of Ingest Operations (Priority: P2)

A platform operator investigating a user complaint ("yesterday afternoon the precipitation map was empty") needs to know what the system attempted to do and what happened. They consult a record of past ingest runs that shows, per provider and variable, when the ingest ran, how many files it processed, how many succeeded, how many failed, and what triggered the run (schedule or manual). This record is queryable and ready to feed a future audit UI.

**Why this priority**: Operational trust depends on observability. Without it, every incident becomes guesswork.

**Independent Test**: After several ingest cycles (some successful, some with simulated failures), query the audit records and verify that each cycle is represented with accurate counts, status and timing.

**Acceptance Scenarios**:

1. **Given** an ingest cycle has finished, **When** the operator queries the audit records, **Then** they find one record per (provider, variable) processed in that cycle with file counts, status, start and end times, and trigger source.
2. **Given** a cycle ran but found nothing new to process, **When** the operator queries, **Then** the cycle is recorded with a "no-op" status (no false negatives).

---

### User Story 6 — Bounded Storage Footprint (Priority: P3)

The platform owner does not want raster storage to grow unbounded. The system retains historical forecasts long enough to compare past predictions with newer ones (for model validation and incident review), but automatically removes anything older than the configured retention window.

**Why this priority**: Retention is important but not blocking the initial value: storage will not become a problem in the first weeks. It can be implemented after the core ingestion works.

**Independent Test**: Configure a short retention window for a test environment, ingest several days of data, advance the clock, and verify entries older than the window are removed from layers without affecting newer ones.

**Acceptance Scenarios**:

1. **Given** the retention period is N days, **When** the daily retention task runs, **Then** all time steps older than N days are removed from every layer.
2. **Given** retention removes time steps, **When** clients request the layer, **Then** only steps within the retention window are returned.

---

### Edge Cases

- A provider only publishes part of a forecast set when the ingest cycle runs. The system processes whatever files are present and picks up the rest in subsequent cycles, without leaving the layer in an inconsistent state.
- A provider re-publishes a file with the same logical timestamp but different content. The system updates the corresponding time step rather than creating a duplicate.
- A provider's metadata file changes between cycles (new forecast start date). The new time steps are added without disrupting time steps from the previous forecast that fall inside the retention window.
- A variable folder exists with files but no metadata file. The variable is skipped and the issue is logged; other variables are unaffected.
- The metadata file declares a different grid than the raster headers carry. The system trusts the raster headers and logs the discrepancy.
- The SFTP service is temporarily unreachable. The cycle is recorded as failed and the next cycle retries automatically without operator action.
- GeoServer is temporarily unreachable. The ingest worker records the failure for the affected variables and the next cycle retries.
- A provider deletes a variable folder that previously had data. The corresponding layer is preserved (with its remaining time steps) until retention removes them; no automatic layer deletion is performed.
- Two ingest triggers (scheduled + manual) overlap for the same variable. The system serializes them so only one runs at a time per (provider, variable).
- A consumer requests metadata while an ingest cycle is running. The response reflects the most recent committed state, not partial in-flight progress.

## Requirements *(mandatory)*

### Functional Requirements

**Discovery & Metadata**

- **FR-001**: The system MUST dynamically discover the set of (provider, variable) datasets from the meteorological storage on every ingest cycle, without relying on a hard-coded list.
- **FR-002**: The system MUST recognize providers that have a single dataset at the provider level (no variable folder) and providers that group multiple variables under sub-folders, treating both consistently.
- **FR-003**: The system MUST read each dataset's metadata description (start date, end date, time step, units, spatial extent, no-data value) and expose it through public endpoints.
- **FR-004**: The system MUST expose a single metadata endpoint that returns datasets in three modes selectable via optional filters: all datasets (no filter), every variable of a given provider (provider filter), or a single dataset (provider + variable filter). The response MUST always be a list, even when filtered to a single entry, so consumers can use one parser for all modes.
- **FR-005**: The metadata endpoint MUST reject a request that supplies a variable filter without a provider filter.
- **FR-006**: The metadata endpoint MUST return a not-found error when the requested provider (or provider + variable combination) does not exist in the meteorological storage.
- **FR-007**: Each metadata response entry MUST include the provider, the variable (or null when not applicable), the dataset metadata, the published layer name, and a summary of the most recent ingest run for that dataset.

**Ingestion Pipeline**

- **FR-008**: The system MUST run an ingest cycle automatically on a configurable schedule (default: every 3 hours).
- **FR-009**: The system MUST expose a single manual sync endpoint accepting the same optional provider/variable filters as the metadata endpoint, supporting on-demand sync of all datasets, every dataset of a provider, or a single dataset.
- **FR-010**: The manual sync endpoint MUST follow the same filter validation rules as the metadata endpoint (variable requires provider; unknown provider/variable returns not-found).
- **FR-011**: For each dataset, the system MUST determine the set of time steps that should exist (derived from the dataset's metadata and available files) and the set already published, and process only the difference.
- **FR-012**: The system MUST publish each processed file as one time step of a single time-aware layer corresponding to its (provider, variable).
- **FR-013**: The first time a dataset is encountered, the system MUST create the corresponding layer in the geospatial publishing system automatically, including the spatial extent and time dimension declared by the dataset.
- **FR-014**: Layer naming MUST follow a deterministic, lowercase, snake-case convention derived from `(provider, variable)` so that consumers can predict layer names without consulting an API.
- **FR-015**: The system MUST treat the geospatial publishing system as the source of truth for "what is currently published" and reconcile against it on each cycle (no internal duplicate of that state).
- **FR-016**: The system MUST be safe to run concurrently per dataset (a second cycle for the same dataset MUST NOT cause duplicate work or corrupt state).
- **FR-017**: The system MUST continue processing remaining datasets when one dataset fails, and record the failure without aborting the full cycle.

**Auditability**

- **FR-018**: For every ingest run on a dataset, the system MUST persist an audit record including: provider, variable, forecast start date, files attempted, files succeeded, files failed, status, trigger source (schedule or manual), start time, end time, and an error summary when applicable.
- **FR-019**: A cycle that finds nothing to do MUST be represented with an explicit "no-op" status (cycles must not be silently dropped).
- **FR-020**: Audit records MUST be queryable by provider, variable and time range to support an operations UI built on top of them later.

**Retention**

- **FR-021**: The system MUST run a daily retention task that removes published time steps older than a configurable retention window (default: 7 days).
- **FR-022**: Retention MUST NOT remove the layer itself even when all its time steps fall outside the window; the layer remains as an empty time-aware container ready to receive new data.

**Boundaries with Other Services**

- **FR-023**: The system MUST consume meteorological files exclusively through the existing file-storage service's HTTP interface; it MUST NOT mount the storage volume directly.
- **FR-024**: The system MUST NOT delete files from the SFTP after processing them; storage cleanup is the responsibility of the file-storage service.
- **FR-025**: The system MUST NOT serve raster content directly to end users; all raster delivery happens through the geospatial publishing system's standard interfaces.
- **FR-026**: The system MUST NOT perform hydrological analysis or transform meteo data into derived products; its scope is limited to ingestion and publishing.

### Key Entities *(include if feature involves data)*

- **Provider**: A meteorological data source (e.g. RADAR, HARMONIE, EPS, SAIH). Has a name and a set of variables. May have a single implicit variable (RADAR case) or many.
- **Variable**: A specific meteorological field exposed by a provider (e.g. Precipitacion, Temperatura, Viento, Precipitacion_25). Has a metadata description, a set of timestamped raster files and a published layer name.
- **Dataset Metadata**: The descriptive document for a (provider, variable). Carries: human-readable name, start date, end date, time step, unit of measurement, spatial extent, grid dimensions, no-data value.
- **Time Step**: A single timestamped raster file belonging to a variable. Its timestamp is derived from the dataset start date plus its sequential index times the dataset time step.
- **Published Layer**: The time-aware geospatial layer that represents a (provider, variable) and is consumed by external clients. Identified by a deterministic name and contains all currently-retained time steps.
- **Ingest Run**: A record of a single attempt to synchronize one dataset, capturing what was attempted and what happened. Used both for idempotent retries and for operational auditability.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After a provider delivers a new forecast set, that data is visible to end-user clients within one ingest cycle (default: 3 hours) without any manual intervention.
- **SC-002**: An operator can list every available meteorological dataset (provider + variable + metadata + last ingest status) in a single request that responds in under 1 second.
- **SC-003**: An end-user client can retrieve any single time step of any published variable through a standard request and receive a valid raster.
- **SC-004**: When a transient failure causes part of a forecast set to be missed, the system reprocesses only the missing files in the next cycle, with no duplicate work and no operator action.
- **SC-005**: A new variable folder added to the storage by an external provider is automatically published as a new layer without any code change or deployment.
- **SC-006**: Storage growth stays bounded: at any time, no published time step is older than the configured retention window.
- **SC-007**: For every ingest cycle (including no-op cycles) there is an auditable record reachable via a query interface.
- **SC-008**: A failure isolated to one dataset never prevents other datasets from being processed in the same cycle.

## Assumptions

- The file-storage service already exposes (or will expose, as a pre-requisite of this feature) HTTP capabilities to list a directory, read a text file's contents and download a binary file, with an internal-caller authentication scheme that this service can use.
- All providers continue to use the current dataset-metadata format (same set of fields). Variations within that format (different grids, units, time ranges) are supported; structural changes would be a separate feature.
- All raster files are spatially referenced in `EPSG:4326` (geographic lat/lon). Files that turn out to be in another reference system would require a separate handling story.
- The `-999` no-data convention used in the current files is the only no-data value in use; other conventions would be added as a separate concern.
- Forecast sets are typically 48 hourly steps but the system does not assume a fixed length; it uses whatever the dataset metadata declares.
- The default ingest interval (3 hours) and retention window (7 days) are configurable and can be tuned per environment without code changes.
- No real-time push from providers is expected; pull-on-schedule is acceptable latency for the use case.
- Notifying other internal services (via message bus) when new data is published is not required in this iteration but should not be architecturally precluded.
- The volume of audit records is small (single-digit cycles per day across single-digit datasets) so a relational store with simple indexes is sufficient.

## Out of Scope

- Deleting or archiving files from the file-storage service after ingest.
- Serving raster pixels or any rendered map tiles directly from this service.
- Hydrological transformations, statistical post-processing, or generation of derived meteo products.
- Building the operations UI on top of the audit records (only the data substrate is in scope).
- Providing historical backfill from external archives; only what is currently in the file-storage is processed.
- Any modification to existing services beyond the minimum HTTP additions needed to read meteo files from the file-storage service.
