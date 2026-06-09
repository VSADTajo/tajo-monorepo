# REST API Contracts: Data Provider Layer

**Feature**: 002-data-provider-layer
**Base Path**: `/provider-configs` and `/ingestion-runs`

---

## Provider Config Endpoints

### POST /provider-configs

Create a new data provider configuration.

**Request Body**:
```json
{
    "name": "FEWS Tajo Production",
    "type": "FEWS_API",
    "baseUrl": "https://fews.example.com/rest/fewspiservice/v1",
    "pollingIntervalMinutes": 360,
    "settings": {
        "filterId": "NAM_EPS",
        "locationIds": ["AR01", "AR02", "AR03"],
        "parameterIds": ["Q.NAM.ens.Med", "Q.NAM.ens.10", "Q.NAM.ens.90"],
        "documentFormat": "PI_JSON"
    }
}
```

**Response 201**:
```json
{
    "id": "uuid",
    "name": "FEWS Tajo Production",
    "type": "FEWS_API",
    "baseUrl": "https://fews.example.com/rest/fewspiservice/v1",
    "pollingIntervalMinutes": 360,
    "isActive": false,
    "settings": { ... },
    "createdAt": "2026-03-11T10:00:00.000Z",
    "updatedAt": "2026-03-11T10:00:00.000Z"
}
```

**Errors**: 400 (validation), 409 (duplicate name)

---

### GET /provider-configs

List all provider configurations.

**Response 200**:
```json
[
    {
        "id": "uuid",
        "name": "FEWS Tajo Production",
        "type": "FEWS_API",
        "baseUrl": "https://fews.example.com/...",
        "pollingIntervalMinutes": 360,
        "isActive": true,
        "settings": { ... },
        "createdAt": "2026-03-11T10:00:00.000Z",
        "updatedAt": "2026-03-11T10:00:00.000Z"
    }
]
```

---

### GET /provider-configs/:id

Get a single provider configuration by ID.

**Response 200**: Same as single item above.
**Errors**: 404 (not found)

---

### PUT /provider-configs/:id

Update a provider configuration.

**Request Body**: Same fields as POST (all required).
**Response 200**: Updated provider config.
**Errors**: 400 (validation), 404 (not found), 409 (duplicate name)

---

### PATCH /provider-configs/:id/toggle

Toggle provider active/inactive status.

**Response 200**:
```json
{
    "id": "uuid",
    "name": "FEWS Tajo Production",
    "isActive": true,
    ...
}
```

**Side effects**: If activated, registers the CRON polling job. If deactivated, removes it.
**Errors**: 404 (not found)

---

### DELETE /provider-configs/:id

Delete a provider configuration and all its ingestion runs.

**Response 200**: Deleted provider config.
**Side effects**: Removes the CRON job if active. Cascades deletion to ingestion_runs.
**Errors**: 404 (not found)

---

### POST /provider-configs/:id/trigger

Manually trigger an immediate ingestion for a provider.

**Response 201**:
```json
{
    "id": "uuid",
    "providerConfigId": "uuid",
    "status": "RUNNING",
    "startedAt": "2026-03-11T10:00:00.000Z",
    "completedAt": null,
    "seriesCount": 0,
    "eventsCount": 0,
    "errorMessage": null
}
```

**Note**: The ingestion runs asynchronously. The response is the created IngestionRun with status=RUNNING. Poll GET /ingestion-runs/:id for final status.
**Errors**: 404 (provider not found), 409 (ingestion already in progress for this provider)

---

## Ingestion Run Endpoints

### GET /ingestion-runs

List ingestion runs, optionally filtered by provider.

**Query Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| providerConfigId | UUID | No | Filter by provider |

**Response 200**:
```json
[
    {
        "id": "uuid",
        "providerConfigId": "uuid",
        "status": "SUCCESS",
        "startedAt": "2026-03-11T10:00:00.000Z",
        "completedAt": "2026-03-11T10:00:45.000Z",
        "seriesCount": 275,
        "eventsCount": 158400,
        "errorMessage": null,
        "createdAt": "2026-03-11T10:00:00.000Z",
        "updatedAt": "2026-03-11T10:00:45.000Z"
    }
]
```

**Note**: Results are ordered by `startedAt DESC` (most recent first).

---

### GET /ingestion-runs/:id

Get a single ingestion run by ID.

**Response 200**: Same as single item above.
**Errors**: 404 (not found)

---

## RabbitMQ Message Contract

### Topic Exchange: `model-events`
### Routing Key: `timeseries.ingested`

**Message Payload**:
```json
{
    "providerConfigId": "uuid",
    "providerType": "FEWS_API",
    "ingestionRunId": "uuid",
    "forecastDate": "2026-01-29",
    "ingestedAt": "2026-03-11T10:00:45.000Z",
    "series": [
        {
            "locationId": "AR01",
            "parameterId": "Q.NAM.ens.Med",
            "moduleInstanceId": "EnsembleStat_EPS_NAM_Alt",
            "stationName": "AR01 GALLO EN PEÑAMEDIODIA",
            "lat": 40.826895,
            "lon": -1.987333,
            "x": 585389.9,
            "y": 4520034.43,
            "z": 881.224,
            "units": "m3/s",
            "timeStep": { "unit": "second", "multiplier": 900 },
            "forecastDate": "2026-01-29",
            "startDate": "2026-01-29",
            "endDate": "2026-02-04",
            "events": [
                {
                    "timestamp": "2026-01-29T01:00:00.000Z",
                    "value": 9.17,
                    "flag": 0,
                    "isMissing": false
                },
                {
                    "timestamp": "2026-02-04T00:45:00.000Z",
                    "value": -999.0,
                    "flag": 8,
                    "isMissing": true
                }
            ]
        }
    ]
}
```
