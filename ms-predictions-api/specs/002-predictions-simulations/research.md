# Research: Predictions & Simulations Layer

**Feature**: 002-predictions-simulations
**Date**: 2026-03-11

## R1: RabbitMQ Message Contract with ms-model-api

**Decision**: Subscribe to exchange `model-events` with routing key `timeseries.ingested`.

**Rationale**: ms-model-api already publishes to this topic in `ExecuteIngestionHandler`. The payload is:

```json
{
    "providerConfigId": "uuid",
    "providerName": "string",
    "providerType": "FEWS_API | SFTP_FILE",
    "seriesCount": 2,
    "eventsCount": 150,
    "timeSeries": [
        {
            "locationId": "LOC001",
            "parameterId": "Q.NAM.ens.Med",
            "moduleInstanceId": "HEC_HMS_AUTO",
            "stationName": "Estación Aranjuez",
            "lat": 40.03, "lon": -3.60,
            "units": "m3/s",
            "timeStep": { "unit": "hour", "multiplier": 1 },
            "forecastDate": "2026-03-11T10:00:00.000Z",
            "startDate": "2026-03-10T00:00:00.000Z",
            "endDate": "2026-03-11T23:00:00.000Z",
            "events": [
                { "timestamp": "2026-03-10T00:00:00.000Z", "value": 5.2, "flag": 0, "isMissing": false }
            ]
        }
    ]
}
```

**Alternatives considered**: Direct queue (rejected — topic exchange allows multiple consumers in future).

## R2: Mapping ms-model-api Fields to predictions-api Entities

**Decision**: Field mapping:

| ms-model-api field | predictions-api entity.field |
|--------------------|------------------------------|
| `locationId` | `Prediction.stationId` (external ref to hydro-api) |
| `parameterId` | `PredictionType.name` (get-or-create) |
| `moduleInstanceId` | `Prediction.predictedBy` (e.g., HEC_HMS_AUTO) |
| `forecastDate` | `Simulation.simulationDate` (normalized to YYYYMMDDHHMMSS) |
| `providerType` | `Prediction.predictionProvider` (WRF, ECMWF, SMC derived from provider config) |
| `stationName` | Stored on Prediction for denormalization (avoids hydro-api call for display) |
| `units` | `PredictionType.unit` |
| `events[].timestamp` | `PredictionResult.date` |
| `events[].value` | `PredictionResult.value` |
| `events[].flag` | `PredictionResult.flag` (quality flag) |
| `events[].isMissing` | Skip events where isMissing=true |

**Rationale**: locationId maps to stationId because Station entity lives in hydro-api. We store stationName for display convenience (denormalized). Missing events are skipped to avoid storing sentinel values.

## R3: Simulation Identification and Composite Key

**Decision**: Use UUID primary key (`id`) + `simulationDate` column (varchar 14, format YYYYMMDDHHMMSS). Unique constraint on `(simulationDate, environment, modmeteo)` for get-or-create logic.

**Rationale**: The existing Python system uses a composite key (id + simulation_date). We simplify to UUID PK for TypeORM compatibility but preserve simulationDate as the natural business identifier. The unique constraint ensures we reuse simulations correctly.

**Alternatives considered**: Composite PK in TypeORM (rejected — TypeORM composite PKs have edge cases with relations and QueryBuilder).

## R4: Simulation Field Derivation from Message

**Decision**: Derive simulation fields from the incoming message:

| Simulation field | Source |
|-----------------|--------|
| `simulationDate` | `forecastDate` normalized to YYYYMMDDHHMMSS |
| `environment` | `moduleInstanceId` (e.g., HEC_HMS_AUTO → HEC_HMS_AUTO) |
| `modmeteo` | Derived from `providerType` or `providerName` (WRF, ECMWF, SMC) |
| `jobType` | `providerType` (FEWS_API, SFTP_FILE) |
| `method` | Default "CN" (configurable per provider in future) |
| `modmeteots` | Derived from `timeStep` (e.g., hour/1 → "1HOUR") |
| `type` | "AUTOMATIC" for MQ messages, "MANUAL" for batch endpoint |
| `status` | Created as MODEL_PROCESSING, progresses to IN_PROGRESS, then FINALIZED |

**Rationale**: Most fields can be derived from the ms-model-api message. For fields that can't be determined (method, basin), we use sensible defaults that can be overridden via the batch endpoint.

## R5: Station Threshold Resolution Strategy

**Decision**: Option A — Cache locally in Redis with TTL.

**Implementation**:
1. `IStationThresholdService` port with method `getThreshold(stationId: string): Promise<number | null>`
2. `StationThresholdService` implementation: check Redis first (`station-threshold:{stationId}`), if miss → HTTP GET to `hydro-api/stations/{stationId}` → extract `umbral` → cache in Redis with 5-minute TTL
3. New configuration module `hydro-api/` with `HYDRO_API_BASE_URL` env var
4. On hydro-api failure → log warning, return null (no notification generated, data still persisted)

**Rationale**: Thresholds change rarely (admin updates). 5-minute TTL balances freshness vs. performance. Ingestion continues even if hydro-api is down.

**Alternatives considered**:
- HTTP on every ingestion (rejected — too many calls, hydro-api becomes bottleneck)
- Event-driven sync (rejected — overkill for low-mutation data)

## R6: Bulk Insert Strategy for PredictionResults

**Decision**: Use TypeORM `createQueryBuilder().insert().values([...]).execute()` for bulk inserts.

**Rationale**: A single message can have 1000+ events. Individual inserts would be too slow. TypeORM's bulk insert generates a single INSERT INTO ... VALUES (...), (...), ... statement.

**Alternatives considered**:
- `repository.save([...])` (rejected — generates individual queries internally)
- Raw SQL `COPY` (rejected — overkill, bulk insert is sufficient for our scale)

## R7: Idempotent Message Processing

**Decision**: Use a unique constraint on `(simulationId, stationId, predictionTypeId, ensemble, percentile)` on the `predictions` table. On conflict, skip (do not update).

**Rationale**: If the same message is delivered twice, the second attempt will hit the unique constraint and be gracefully handled. PredictionResults are only created if the parent Prediction is new.

**Alternatives considered**:
- Deduplication ID in Redis (rejected — adds complexity, DB constraint is simpler and authoritative)
- Upsert (rejected — we don't want to overwrite existing predictions)

## R8: Consumer → Command Flow

**Decision**: The RabbitMQ consumer (`TimeSeriesIngestedConsumer`) receives the full message, then dispatches one `ProcessTimeSeriesCommand` per series in the `timeSeries[]` array. Each command is processed independently.

**Rationale**: Processing per-series allows partial success (if one series fails, others still persist). The consumer acks the message only after all series are processed.

**Flow**:
```
RabbitMQ message arrives
  → TimeSeriesIngestedConsumer.handle(data)
    → for each series in data.timeSeries:
        → commandBus.execute(new ProcessTimeSeriesCommand({ series, metadata }))
    → ack() if all succeed
    → nack(requeue) if any fail
```

## R9: Notification Generation Timing

**Decision**: Check thresholds inline during prediction processing (inside `ProcessTimeSeriesHandler`), after PredictionResults are persisted.

**Rationale**: Checking during ingestion ensures notifications are generated immediately. The threshold lookup is cheap (Redis cache hit). No need for a separate background job.

**Flow**:
```
ProcessTimeSeriesHandler:
  1. Get/create PredictionType
  2. Get/create Simulation
  3. Create Prediction
  4. Bulk insert PredictionResults
  5. Get station threshold (from cache/hydro-api)
  6. If threshold exists → check max(PredictionResult.value) > threshold
  7. If exceeded → create Notification record
```
