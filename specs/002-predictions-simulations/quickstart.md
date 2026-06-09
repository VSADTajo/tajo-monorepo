# Quickstart: Predictions & Simulations Layer

**Feature**: 002-predictions-simulations
**Date**: 2026-03-11

## Integration Scenarios

### Scenario 1: End-to-End Ingestion via RabbitMQ

**Precondition**: ms-model-api running, RabbitMQ running, hydro-api running with stations configured.

1. ms-model-api executes an ingestion for a FEWS_API provider
2. ms-model-api publishes to exchange `model-events` with routing key `timeseries.ingested`
3. ms-predictions-api consumer receives the message
4. For each time series in the message:
   - PredictionType "Discharge_forecast" is found (or created with unit "m3/s")
   - Simulation is found (or created with simulationDate from forecastDate)
   - Prediction record links stationId + type + simulation
   - PredictionResults are bulk-inserted (one per event)
   - Station threshold is checked (via Redis cache → hydro-api)
   - If threshold exceeded → Notification created
5. Message is acked

**Verify**: `GET /simulations/latest` returns the new simulation. `GET /predictions/historical/{stationId}` returns the time series.

### Scenario 2: Batch Ingestion via REST

**Precondition**: Database running, no RabbitMQ needed.

1. POST to `/simulations/with-predictions` with:
   ```json
   {
     "simulationDate": "20260311100000",
     "modmeteo": "WRF",
     "environment": "HEC_HMS_MANUAL",
     "type": "MANUAL",
     "basin": "Tajo",
     "createdBy": "admin",
     "predictions": [
       {
         "stationId": "550e8400-...",
         "stationName": "Aranjuez",
         "typeName": "Discharge_forecast",
         "units": "m3/s",
         "ensemble": "000",
         "percentile": 50.0,
         "predictedBy": "HEC_HMS_MANUAL",
         "events": [
           { "timestamp": "2026-03-10T00:00:00Z", "value": 45.2 },
           { "timestamp": "2026-03-10T01:00:00Z", "value": 52.8 }
         ]
       }
     ]
   }
   ```
2. Response: 201 with simulation + prediction IDs

**Verify**: `GET /simulations/20260311100000` returns the simulation with predictions.

### Scenario 3: Threshold Notification

**Precondition**: Station in hydro-api has umbral = 100 m3/s.

1. Ingest prediction with value 150 m3/s for that station
2. System detects 150 > 100
3. Notification created with status PENDING, thresholdValue=100, actualValue=150

**Verify**: `GET /notifications?status=PENDING` returns the notification. `PATCH /notifications/{id}/verify` changes status to VERIFIED.

### Scenario 4: Query Dashboard Data

1. `GET /predictions/available-dates` → list of simulation dates
2. `GET /simulations/latest` → latest finalized simulation
3. `GET /predictions/historical/{stationId}?startDate=...&endDate=...&predictionType=Discharge_forecast` → time series chart data
4. `GET /predictions/max-and-latest-values?typeName=Discharge_forecast&percentile=50` → table of max/latest per station
5. `GET /notifications?status=PENDING&stationId=...` → active alerts

## Environment Variables (new for this feature)

| Variable | Default | Description |
|----------|---------|-------------|
| `HYDRO_API_BASE_URL` | `http://localhost:3004` | Base URL for hydro-api (station threshold lookups) |
| `STATION_THRESHOLD_CACHE_TTL` | `300` | TTL in seconds for cached station thresholds |

## RabbitMQ Configuration

The consumer subscribes to:
- **Exchange**: `model-events` (topic)
- **Routing key**: `timeseries.ingested`
- **Queue**: `predictions-timeseries-processing` (durable, auto-created)

This is registered in `messaging.registry.ts` and the consumer is bootstrapped in `main.ts` alongside the existing RabbitMQ transport.
