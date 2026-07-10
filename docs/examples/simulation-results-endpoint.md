# Simulation Results Endpoint — Manual Invocation Example

## Overview

`GET /simulations/manual/:id/results` returns the full model output of a manual simulation:
the simulation identity, every `Prediction` linked to it, and each prediction's complete
ordered time-series `PredictionResult` records.

This document shows how to invoke the endpoint locally for QA/debugging without opening
the frontend.

## Prerequisites

1. The full infrastructure stack must be running. Use the `run-monorepo-local` skill or:

   ```bash
   cd infra/infra && docker compose up -d
   ```

2. `ms-predictions-api` must be running on port **3007**.

3. A manual simulation that has reached `FINALIZED` status with persisted predictions
   must exist in the database. Follow the existing manual simulation flow documented in
   [`docs/flows/manual-simulation.md`](../flows/manual-simulation.md) to produce one, or
   use the existing manual-simulation example scripts.

4. Note the `simulationId` of the finalized simulation (you can obtain it from
   `GET http://localhost:3007/simulations/manual`).

## Invocation

Replace `<SIMULATION_ID>` with the UUID of a finalized manual simulation:

```bash
curl -s http://localhost:3007/simulations/manual/<SIMULATION_ID>/results | jq .
```

### With pretty-print and pagination check

```bash
SIMULATION_ID="<paste-uuid-here>"

curl -s "http://localhost:3007/simulations/manual/${SIMULATION_ID}/results" \
  -H "Content-Type: application/json" | jq '{
    simulation: .simulation,
    predictions_count: (.predictions | length),
    first_prediction: .predictions[0]
  }'
```

## Sample Abbreviated Response

```json
{
  "simulation": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "simulationDate": "20260710120000",
    "status": "FINALIZED",
    "type": "MANUAL",
    "dataOrigin": "FORECAST",
    "createdAt": "2026-07-10T12:00:00.000Z",
    "updatedAt": "2026-07-10T12:35:12.000Z"
  },
  "predictions": [
    {
      "id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
      "stationId": "AR71",
      "stationName": "Embalse del Tranco",
      "predictionTypeId": "c3d4e5f6-a7b8-9012-cdef-012345678902",
      "predictionTypeName": "Q.NAM.forecast",
      "predictionTypeUnit": "m3/s",
      "percentile": null,
      "predictionProvider": "aemet",
      "predictedBy": "mod-1",
      "predictionDate": "2026-07-10T00:00:00.000Z",
      "predictionStartDate": "2026-07-10T00:00:00.000Z",
      "predictionEndDate": "2026-07-13T00:00:00.000Z",
      "results": [
        { "date": "2026-07-10T00:00:00.000Z", "value": 123.4, "flag": 0 },
        { "date": "2026-07-10T01:00:00.000Z", "value": 118.7, "flag": 0 },
        { "date": "2026-07-10T02:00:00.000Z", "value": 115.2, "flag": 0 }
      ]
    }
  ]
}
```

Predictions are ordered by `(stationId ASC, predictionTypeId ASC)` and each prediction's
`results` array is ordered by `date ASC` — no client-side sorting required.

## Error Cases

| Status | Cause |
|--------|-------|
| `400 Bad Request` | The provided `id` is not a valid UUID |
| `404 Not Found` | No manual simulation exists with this id (or it is soft-deleted, or it is not of type `MANUAL`) |
| `500 Internal Server Error` | Unexpected repository or runtime error |

## Empty-results Case

If the simulation is still being processed (status `CREATED`, `MODEL_PROCESSING`, or
`IN_PROGRESS`) or has failed (`MODEL_FAILED`), the endpoint still returns `200 OK` with
an empty `predictions` array and the current `status` so the frontend can render a
"no results yet" or "failed" state:

```json
{
  "simulation": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "simulationDate": "20260710120000",
    "status": "MODEL_PROCESSING",
    "type": "MANUAL",
    "dataOrigin": "FORECAST",
    "createdAt": "2026-07-10T12:00:00.000Z",
    "updatedAt": "2026-07-10T12:01:00.000Z"
  },
  "predictions": []
}
```

## Notes

- The gateway proxy (`ms-gateway-api`) and frontend consumption (`vsad-tajo-frontend`)
  will be added in follow-up specs. Until then, use port `3007` directly.
- The Swagger UI at `http://localhost:3007/docs` documents the full request/response
  schema including all error responses.
- Cache TTL for this endpoint is 60 seconds. After ingesting new predictions via the
  `timeseries.ingested` RabbitMQ event, the cache is automatically invalidated so
  subsequent reads reflect the new data.
