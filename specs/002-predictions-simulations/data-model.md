# Data Model: Predictions & Simulations Layer

**Feature**: 002-predictions-simulations
**Date**: 2026-03-11

## Entity Relationship Diagram

```
PredictionType (1) ──→ (N) Prediction
Simulation (1)     ──→ (N) Prediction
Prediction (1)     ──→ (N) PredictionResult
PredictionResult (1) ──→ (N) Notification

Station lives in hydro-api — referenced by stationId (UUID) only
```

---

## Entities

### PredictionType

Categorizes what is being predicted. Seeded with initial values, supports dynamic creation.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID (PK) | auto-generated | Unique identifier |
| name | varchar(100) | NOT NULL, UNIQUE | Type name (e.g., "Precipitation_forecast") |
| unit | varchar(20) | NOT NULL | Measurement unit (e.g., "mm", "m3/s") |
| createdAt | timestamp | NOT NULL, DEFAULT now() | Audit |
| updatedAt | timestamp | NOT NULL, DEFAULT now() | Audit |

**Seeded values**: Precipitation_forecast (mm), Discharge_forecast (m3/s), Precipitation (mm), Discharge (m3/s)

**Validation**:
- name: required, max 100 chars, trimmed
- unit: required, max 20 chars

---

### Simulation

Represents a single model execution/run.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID (PK) | auto-generated | Unique identifier |
| simulationDate | varchar(14) | NOT NULL | Date in YYYYMMDDHHMMSS format |
| jobType | varchar(20) | nullable | FEWS_API, SFTP_FILE |
| method | varchar(10) | nullable | CN, SMA |
| modmeteo | varchar(20) | nullable | WRF, ECMWF, SMC |
| modmeteots | varchar(10) | nullable | 1HOUR, 3HOUR, 24HOUR |
| ensemble | varchar(5) | nullable | Ensemble identifier |
| status | enum | NOT NULL, DEFAULT 'CREATED' | CREATED, MODEL_PROCESSING, IN_PROGRESS, FINALIZED, MODEL_FAILED |
| type | enum | NOT NULL, DEFAULT 'AUTOMATIC' | AUTOMATIC, MANUAL, FORECAST |
| environment | varchar(30) | nullable | HEC_HMS_AUTO, HEC_HMS_MANUAL, LISFLOOD_AUTO, LISFLOOD_MANUAL |
| state | varchar(1) | nullable | "f" (no hot states) or "c" (with hot states) |
| basin | varchar(100) | nullable | Basin/cuenca name |
| description | text | nullable | Free-form description |
| createdBy | varchar(100) | nullable | Who created the simulation |
| createdAt | timestamp | NOT NULL, DEFAULT now() | Audit |
| updatedAt | timestamp | NOT NULL, DEFAULT now() | Audit |

**Unique constraint**: `(simulationDate, environment, modmeteo)` — for get-or-create logic

**Indexes**:
- `(simulationDate)` — query by date
- `(status, createdAt)` — filter by status + sort

**Status lifecycle**:
```
CREATED → MODEL_PROCESSING → IN_PROGRESS → FINALIZED
                                         → MODEL_FAILED
```

**Validation**:
- simulationDate: required, exactly 14 digits (SimulationDateValueObject)
- status: must be valid enum value

**Business methods**:
- `advanceStatus()`: Transitions CREATED → MODEL_PROCESSING → IN_PROGRESS
- `finalize()`: Sets status to FINALIZED (only from IN_PROGRESS)
- `fail()`: Sets status to MODEL_FAILED

---

### Prediction

Links a station + prediction type + simulation for a specific forecast.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID (PK) | auto-generated | Unique identifier |
| stationId | UUID | NOT NULL | External reference to hydro-api Station |
| stationName | varchar(200) | nullable | Denormalized station name for display |
| predictionTypeId | UUID (FK) | NOT NULL, references prediction_types(id) | What is being predicted |
| simulationId | UUID (FK) | NOT NULL, references simulations(id) | Which simulation run |
| predictionDate | timestamp | nullable | Main prediction target date |
| predictionStartDate | timestamp | nullable | Time window start |
| predictionEndDate | timestamp | nullable | Time window end |
| ensemble | varchar(5) | nullable | Ensemble number (e.g., "000", "001") |
| percentile | decimal(5,1) | nullable | Percentile value (e.g., 10.0, 50.0, 90.0) |
| predictionProvider | varchar(20) | nullable | WRF, ECMWF, SMC |
| predictedBy | varchar(30) | nullable | HEC_HMS_AUTO, LISFLOOD_AUTO, etc. |
| createdAt | timestamp | NOT NULL, DEFAULT now() | Audit |
| updatedAt | timestamp | NOT NULL, DEFAULT now() | Audit |

**Unique constraint**: `(simulationId, stationId, predictionTypeId, ensemble, percentile)` — idempotency

**Indexes**:
- `(stationId, createdAt)` — query by station
- `(predictionTypeId, createdAt)` — query by type
- `(simulationId)` — query by simulation
- `(stationId, predictionTypeId)` — combined filter
- `(predictionProvider, createdAt)` — filter by provider

**Relations**:
- ManyToOne → PredictionType (onDelete: RESTRICT)
- ManyToOne → Simulation (onDelete: CASCADE)
- OneToMany → PredictionResult

**Validation**:
- stationId: required UUID
- predictionTypeId: required UUID
- simulationId: required UUID
- ensemble: optional, max 5 chars (EnsembleValueObject)
- percentile: optional, 0.0-100.0 range (PercentileValueObject)

---

### PredictionResult

Individual time-stamped prediction values (the actual time series data).

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | bigint (PK) | auto-generated | Unique identifier (bigint for high volume) |
| predictionId | UUID (FK) | NOT NULL, references predictions(id) | Parent prediction |
| date | timestamp | NOT NULL | When this prediction is for |
| value | double precision | NOT NULL | Predicted value |
| flag | integer | DEFAULT 0 | Quality flag |
| createdAt | timestamp | NOT NULL, DEFAULT now() | Audit |

**Note**: No `updatedAt` — prediction results are immutable once written.

**Indexes**:
- `(predictionId, date)` — PRIMARY time series query index (composite)
- `(date, createdAt)` — deduplication and range queries

**Relations**:
- ManyToOne → Prediction (onDelete: CASCADE)
- OneToMany → Notification

**Validation**:
- predictionId: required UUID
- date: required, valid timestamp
- value: required, must be a number

---

### Notification

Alert generated when a prediction result exceeds a station's threshold.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID (PK) | auto-generated | Unique identifier |
| stationId | UUID | NOT NULL | External reference to hydro-api Station |
| predictionResultId | bigint (FK) | NOT NULL, references prediction_results(id) | Triggering result |
| identifierId | UUID | NOT NULL, DEFAULT uuid_generate_v4() | Public identifier for external systems |
| thresholdValue | double precision | NOT NULL | Station threshold at time of notification |
| actualValue | double precision | NOT NULL | Prediction result value that triggered alert |
| status | enum | NOT NULL, DEFAULT 'PENDING' | PENDING, VERIFIED |
| resultOfPrediction | enum | NOT NULL, DEFAULT 'UNDEFINED' | FULFILLED, NOT_FULFILLED, UNDEFINED |
| isRead | boolean | NOT NULL, DEFAULT false | Whether operator has read the notification |
| createdAt | timestamp | NOT NULL, DEFAULT now() | Audit |
| updatedAt | timestamp | NOT NULL, DEFAULT now() | Audit |

**Indexes**:
- `(stationId, status)` — filter by station + status
- `(status, createdAt)` — list pending notifications
- `(isRead, createdAt)` — unread count

**Relations**:
- ManyToOne → PredictionResult (onDelete: CASCADE)

**Validation**:
- stationId: required UUID
- predictionResultId: required
- thresholdValue: required number
- actualValue: required number

---

## Value Objects

### SimulationDateValueObject
- Input: string
- Validation: must be exactly 14 digits (YYYYMMDDHHMMSS)
- Normalization: if input is ISO date string, convert to 14-digit format
- Throws `EntityError` on invalid format

### EnsembleValueObject
- Input: string
- Validation: 1-5 characters, alphanumeric
- Normalization: pad to 3 digits if numeric (e.g., "1" → "001")
- Throws `EntityError` on invalid format

### PercentileValueObject
- Input: number
- Validation: 0.0 ≤ value ≤ 100.0
- Throws `EntityError` if out of range

---

## Enums

### SimulationStatus
```
CREATED | MODEL_PROCESSING | IN_PROGRESS | FINALIZED | MODEL_FAILED
```

### SimulationType
```
AUTOMATIC | MANUAL | FORECAST
```

### NotificationStatus
```
PENDING | VERIFIED
```

### PredictionOutcome
```
FULFILLED | NOT_FULFILLED | UNDEFINED
```

---

## Migration Order

1. `create-prediction-types-table` — no dependencies
2. `create-simulations-table` — no dependencies
3. `create-predictions-table` — depends on prediction_types + simulations
4. `create-prediction-results-table` — depends on predictions
5. `create-notifications-table` — depends on prediction_results
