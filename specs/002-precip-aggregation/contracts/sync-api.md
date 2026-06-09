# Contract: Sync API Response (Extended)

**Feature**: 002-precip-aggregation  
**Type**: Internal contract — `POST /meteo/sync` response

## Current Response (unchanged)

The existing `POST /meteo/sync` endpoint triggers hourly ingest and returns `SyncResult`.

```json
{
  "triggeredBy": "manual",
  "datasets": [
    {
      "provider": "HARMONIE",
      "variable": "Precipitacion",
      "status": "ok",
      "filesOk": 48,
      "filesFailed": 0,
      "runId": "uuid"
    }
  ]
}
```

## Extended Response (after feature)

The response includes an additional `aggregation` field summarizing the aggregation results:

```json
{
  "triggeredBy": "manual",
  "datasets": [
    {
      "provider": "HARMONIE",
      "variable": "Precipitacion",
      "status": "ok",
      "filesOk": 48,
      "filesFailed": 0,
      "runId": "uuid"
    }
  ],
  "aggregation": {
    "datasetsProcessed": 1,
    "dailyLayersUpdated": 2,
    "totalLayersUpdated": 1,
    "errors": []
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `aggregation.datasetsProcessed` | number | How many datasets had aggregation computed |
| `aggregation.dailyLayersUpdated` | number | Number of daily GeoTIFFs published/replaced |
| `aggregation.totalLayersUpdated` | number | Number of total GeoTIFFs published/replaced |
| `aggregation.errors` | string[] | Error messages for any failed datasets |

When no hourly data changed (NOOP), the `aggregation` field is omitted or null.

## Backward Compatibility

- The `datasets` array structure is unchanged.
- The `aggregation` field is additive (new field). Existing clients that don't read it are unaffected.
