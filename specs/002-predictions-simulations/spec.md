# Feature Specification: Predictions & Simulations Layer

**Feature Branch**: `002-predictions-simulations`
**Created**: 2026-03-11
**Status**: Draft
**Input**: Migration/rewrite of the predictions layer from the existing Python predictions-api (things-board-backend) to the NestJS microservice architecture for the Hydro Platform (VSAD Tajo).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ingest Prediction Data from Message Queue (Priority: P1)

The system receives normalized hydrological time series data published by ms-model-api via a RabbitMQ topic. For each incoming message, the system resolves the station reference (by external ID from hydro-api), resolves or creates the prediction type, associates the data with a simulation run, and persists all time-stamped prediction values. This is the core data pipeline that feeds all downstream queries and alerts.

**Why this priority**: Without data ingestion, the entire service has no data to serve. This is the foundational capability that all other stories depend on.

**Independent Test**: Can be fully tested by publishing a message to the queue and verifying that prediction type, simulation, prediction, and prediction result records are correctly persisted in the database with the correct station ID reference.

**Acceptance Scenarios**:

1. **Given** a valid time series message arrives on the topic, **When** the system processes it, **Then** a prediction type record exists (created if new), a simulation record exists (created or matched by date + environment + meteorological model), a prediction record is created linking station ID + type + simulation, and all time-stamped values are persisted as prediction results.
2. **Given** a message references an existing simulation (same date + environment + meteorological model), **When** the system processes it, **Then** the existing simulation is reused and its status is updated according to the lifecycle.
3. **Given** a message with 1,000 time-stamped events, **When** the system processes it, **Then** all 1,000 prediction results are persisted efficiently in bulk.
4. **Given** a malformed or incomplete message arrives, **When** the system attempts processing, **Then** the message is rejected with an error log and does not corrupt existing data.
5. **Given** the same message is delivered twice (duplicate), **When** the system processes it, **Then** duplicate prediction results are not created (idempotent processing).
6. **Given** the message queue connection drops mid-processing, **When** the connection recovers, **Then** unacknowledged messages are redelivered and processed without data loss.

---

### User Story 2 - Query Simulations (Priority: P2)

Data analysts, the frontend dashboard, and other services need to browse and inspect simulation runs. A simulation represents a single execution of a hydrological model and contains many predictions across multiple stations. Users need to find the latest finalized simulation, browse historical simulations with filtering, and view simulation details with their associated predictions.

**Why this priority**: Simulations organize predictions chronologically. Querying simulations is essential for the dashboard to display current and historical model runs.

**Independent Test**: Can be fully tested by creating simulations (via the ingestion pipeline or batch endpoint), then querying them via list, get-by-date, latest, and historical endpoints, verifying correct filtering and pagination.

**Acceptance Scenarios**:

1. **Given** multiple simulations exist with different statuses, **When** a user lists simulations filtered by status "FINALIZED", **Then** only finalized simulations are returned.
2. **Given** simulations exist across different dates, **When** a user queries simulations within a date range, **Then** only simulations within that range are returned, sorted by date descending.
3. **Given** at least one finalized simulation exists, **When** a user requests the latest simulation, **Then** the most recently finalized simulation is returned with its prediction summary.
4. **Given** a simulation exists with a specific date, **When** a user queries by that simulation date, **Then** the simulation is returned along with its associated predictions.
5. **Given** a simulation is in "IN_PROGRESS" status, **When** an operator manually finalizes it, **Then** the simulation status changes to "FINALIZED".
6. **Given** many simulations exist, **When** a user requests the historical list, **Then** results are paginated and grouped by simulation date.

---

### User Story 3 - Query Predictions and Time Series (Priority: P3)

Data analysts and the frontend dashboard need to access prediction time series data. The primary use case is viewing historical predictions for a specific station (by station ID, referencing hydro-api), filtered by date range and prediction type. Additional views include raw predictions by data provider, latest values per ensemble for a given simulation, available simulation dates, and aggregated max/latest values across all stations.

**Why this priority**: This is the primary read path for the frontend dashboard — displaying charts and tables of prediction data.

**Independent Test**: Can be fully tested by ingesting sample prediction data, then querying the various prediction endpoints and verifying correct data retrieval, filtering, and aggregation.

**Acceptance Scenarios**:

1. **Given** predictions exist for a station, **When** a user queries historical predictions for that station ID with a date range and prediction type "Discharge_forecast", **Then** the time series values within that range are returned.
2. **Given** predictions from multiple providers exist for a simulation date, **When** a user queries raw predictions by provider "WRF" for that date, **Then** only predictions from the WRF provider are returned.
3. **Given** ensemble predictions exist for a simulation, **When** a user queries latest values by ensemble for that simulation date, **Then** the most recent value for each ensemble number is returned.
4. **Given** simulations exist across various dates, **When** a user queries available dates, **Then** a distinct list of simulation dates is returned.
5. **Given** predictions exist for multiple stations, **When** a user queries max-and-latest-values filtered by prediction type and percentile, **Then** the maximum and most recent prediction values are returned for each station.
6. **Given** no predictions exist for the requested station or date range, **When** a user queries historical predictions, **Then** an empty result set is returned (not an error).

---

### User Story 4 - Threshold Alerts and Notifications (Priority: P4)

When prediction values exceed a station's configured alert threshold (umbral), the system automatically generates a notification. The threshold value comes from hydro-api (via the station reference), or may be cached/replicated locally. Operations staff review these notifications to assess flood risk. They can verify notifications (confirming the alert was reviewed), mark them as read, and filter by status and station.

**Why this priority**: Notifications are the alert system that makes predictions actionable. Without them, operators must manually check prediction values against thresholds.

**Independent Test**: Can be fully tested by configuring a threshold for a station, ingesting prediction data that exceeds the threshold, and verifying a notification is automatically created. Then listing, verifying, and marking notifications as read via the API.

**Acceptance Scenarios**:

1. **Given** a station has a threshold of 100 m3/s for discharge, **When** a prediction result with value 150 m3/s is ingested, **Then** a notification is automatically created linking the station ID and the triggering prediction result, with status "PENDING".
2. **Given** a prediction result value is below the station threshold, **When** the prediction is ingested, **Then** no notification is created.
3. **Given** pending notifications exist, **When** an operator lists notifications filtered by status "PENDING", **Then** only unverified notifications are returned with station ID, prediction value, and threshold.
4. **Given** a pending notification exists, **When** an operator verifies it, **Then** the notification status changes to "VERIFIED".
5. **Given** a notification exists, **When** an operator marks it as read, **Then** the notification is flagged as read and excluded from unread counts.
6. **Given** a station has no threshold configured (null/zero), **When** prediction results are ingested, **Then** no notifications are generated for that station.

---

### User Story 5 - Batch Ingestion via REST Endpoint (Priority: P5)

For manual testing, data correction, and scenarios where the message queue is unavailable, operators need an alternative REST endpoint to submit simulation data with predictions in a single batch request. This endpoint accepts simulation metadata plus an array of prediction data (each with its time series events), validates synchronously, and processes predictions.

**Why this priority**: This is a secondary ingestion path for operational flexibility. The primary path (message queue) handles production workload; this endpoint supports manual operations and testing.

**Independent Test**: Can be fully tested by posting a batch request with simulation metadata and prediction data, then verifying simulation, predictions, and prediction results are correctly persisted via the query endpoints.

**Acceptance Scenarios**:

1. **Given** valid simulation metadata and an array of predictions with events, **When** an operator submits the batch request, **Then** the simulation is created (or matched), all predictions and their results are persisted, and a success response is returned.
2. **Given** invalid simulation metadata (missing required fields), **When** an operator submits the batch request, **Then** the request is rejected with a validation error before any data is persisted.
3. **Given** a batch with 50 predictions each having 200 events, **When** an operator submits the request, **Then** all 10,000 prediction results are persisted correctly.
4. **Given** a prediction result in the batch exceeds a station threshold, **When** processing completes, **Then** a notification is generated just as it would be through the message queue path.

---

### Edge Cases

- What happens when the message queue connection is lost mid-processing? The message is not acknowledged and will be redelivered when the connection recovers.
- What happens when a simulation receives predictions after being marked as FINALIZED? The system rejects the new predictions with an appropriate error.
- What happens when prediction result values are null or non-numeric? The system rejects the individual event and logs a warning but continues processing remaining events.
- What happens when two messages for the same simulation arrive concurrently? The system uses database-level constraints to prevent duplicate records and handles conflicts gracefully.
- What happens when the prediction results table grows very large (millions of rows)? Composite indexes on (prediction_id, date) ensure query performance remains acceptable.
- What happens when a referenced station ID does not exist in hydro-api? The system stores the station ID as-is (eventual consistency); queries that need station metadata resolve it from hydro-api at read time or via a local cache.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST consume normalized time series messages from the RabbitMQ topic ("model.timeseries.ingested") and persist them as structured prediction data (prediction type, simulation, prediction, prediction results).
- **FR-002**: System MUST automatically create prediction type records when they don't exist during ingestion (auto-registration).
- **FR-003**: System MUST manage simulation lifecycle with defined status transitions: CREATED → MODEL_PROCESSING → IN_PROGRESS → FINALIZED (or MODEL_FAILED).
- **FR-004**: System MUST bulk-insert prediction results (time-stamped values) efficiently for each prediction.
- **FR-005**: System MUST store station ID as a foreign reference to hydro-api (NOT manage station CRUD — that belongs to hydro-api).
- **FR-006**: System MUST provide paginated and filterable query endpoints for simulations (by status, date range, meteorological model, environment).
- **FR-007**: System MUST return the latest finalized simulation with prediction summaries.
- **FR-008**: System MUST provide historical prediction time series queries by station ID, filterable by date range, prediction type, and prediction model.
- **FR-009**: System MUST provide aggregated queries for max/latest prediction values across stations with filtering by type, percentile, simulation date, and meteorological model.
- **FR-010**: System MUST automatically generate notifications when prediction result values exceed a station's alert threshold.
- **FR-011**: System MUST provide query, verify, and read-status-update endpoints for notifications.
- **FR-012**: System MUST provide a batch REST endpoint for submitting simulation data with predictions as an alternative to the message queue.
- **FR-013**: System MUST handle duplicate message delivery idempotently without creating duplicate records.
- **FR-014**: System MUST reject predictions for finalized simulations.
- **FR-015**: System MUST support prediction metadata including ensemble number, percentile, prediction provider, and prediction model.
- **FR-016**: System MUST cache frequently queried endpoints (simulation lists, latest simulation, available dates) with appropriate invalidation on new data ingestion.
- **FR-017**: System MUST resolve station threshold values from hydro-api using a local cache strategy: fetch thresholds via HTTP on first access and cache them locally with a reasonable expiration time. On cache miss or expiration, the system re-fetches from hydro-api transparently.

### Key Entities

- **PredictionType**: Categorizes what is being predicted (e.g., precipitation forecast, discharge forecast, observed precipitation, observed discharge). Each type has a name and measurement unit. Predefined types are seeded, but the system supports dynamic creation.
- **Simulation**: Represents a single model execution/run, identified by a composite of ID and simulation date (YYYYMMDDHHMMSS format). Tracks the method used (CN, SMA), meteorological model source (WRF, ECMWF, SMC), time resolution, ensemble, execution status, type (automatic/manual/forecast), environment, basin, and creator. Status lifecycle: CREATED → MODEL_PROCESSING → IN_PROGRESS → FINALIZED | MODEL_FAILED.
- **Prediction**: Links a station (by external ID referencing hydro-api), prediction type, and simulation for a specific forecast. Contains ensemble number, percentile, provider, prediction model, and the prediction time window (start/end dates).
- **PredictionResult**: Individual time-stamped prediction values (the actual time series data). Each record has a date and numerical value, indexed by (prediction_id, date) for fast range queries.
- **Notification**: Alert generated when a prediction result exceeds a station's threshold. Contains station ID (reference to hydro-api), the triggering prediction result, verification status (pending/verified), prediction outcome (fulfilled/not fulfilled/undefined), and read status.

**Note**: Station, SubBasin, and Basin entities are NOT in this service. They live in hydro-api. This service references stations by ID only.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The system processes incoming time series messages and makes prediction data queryable within 5 seconds of receipt under normal load.
- **SC-002**: Historical prediction queries for a single station return results in under 2 seconds, even with 6 months of data.
- **SC-003**: Batch ingestion of 50 predictions with 200 events each completes within 30 seconds.
- **SC-004**: Threshold notifications are generated within 5 seconds of the triggering prediction result being persisted.
- **SC-005**: The system handles 100 concurrent time series messages without data loss or duplicate records.
- **SC-006**: All query endpoints support pagination and return paginated results in under 3 seconds for datasets exceeding 10,000 records.
- **SC-007**: Zero data loss during message queue reconnection — all unacknowledged messages are reprocessed after recovery.

## Assumptions

- The message queue infrastructure (RabbitMQ) is already provisioned and shared across microservices.
- ms-model-api publishes to the topic "model.timeseries.ingested" with a defined message schema containing stationId (referencing hydro-api), parameterId, forecastDate, moduleInstanceId, and events[].
- **Station, SubBasin, and Basin management lives in hydro-api** (a separate microservice). predictions-api only stores stationId as a foreign reference and does NOT manage station CRUD.
- Station threshold (umbral) values are obtained from hydro-api — either via HTTP call or cached locally.
- Notification delivery channels (email, SMS, push) are out of scope — this feature only creates notification records. Delivery is handled by a separate notification service.
- Simulation dates use the YYYYMMDDHHMMSS format (14-digit string) as established in the existing Python system.
- Prediction types are a fixed set (Precipitation_forecast, Discharge_forecast, Precipitation, Discharge) seeded at deployment time, but the system supports dynamic creation for forward compatibility.
- The composite identifier pattern for simulations (id + simulation_date) is preserved from the existing Python system for backward compatibility.
- Data retention policies are managed externally and are not part of this feature.
- The existing User and Role entities from the 001-user-roles feature remain unchanged; authorization enforcement is out of scope.

## Dependencies

- **ms-model-api**: Publishes normalized time series to RabbitMQ topic "model.timeseries.ingested". Message schema must be agreed upon.
- **hydro-api**: Owns Station, SubBasin, and Basin entities. predictions-api references station IDs and may call hydro-api to resolve station metadata (name, threshold) for notifications and enriched query responses.
- **RabbitMQ**: Shared message broker infrastructure must be available.
- **PostgreSQL**: Dedicated database instance for ms-predictions-api.
- **Redis**: Shared cache infrastructure for query caching.

## Out of Scope

- Station, SubBasin, and Basin CRUD (belongs to hydro-api).
- User authentication and authorization enforcement on endpoints.
- Notification delivery (email, SMS, push notifications) — only database record creation.
- Raster image generation from prediction data.
- Integration with ThingsBoard IoT platform.
- Multi-level alert thresholds (warning/danger/critical).
- Data archival and retention policies.
- Real-time WebSocket streaming of predictions.
- Intensity calculations (value/interval) — can be added in a future iteration.
