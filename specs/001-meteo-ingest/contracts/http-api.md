# HTTP Contract — ms-meteo-api

Public contract that this service exposes (consumed via the gateway).

**Base path**: `/meteo`
**Auth**: Internal-caller header `x-internal-caller: ms-gateway-api` (whitelist middleware inherited from the boilerplate). External traffic enters through `ms-gateway-api`.

---

## `GET /meteo/info`

Returns metadata for meteorological datasets currently present in the SFTP. The same endpoint serves all three use cases (all datasets / one provider / one variable) via optional query parameters.

**Query parameters** (all optional):

| Param | Type | Description |
|---|---|---|
| `provider` | `string` | Filter by provider name (case-insensitive). Examples: `radar`, `harmonie`, `eps`, `saih`. |
| `variable` | `string` | Filter by variable name. Requires `provider` to also be set. Examples: `Precipitacion`, `Temperatura`, `Precipitacion_25`. Use `_` to explicitly select RADAR's implicit (no variable) dataset. |

**Behavior**:

| Query | Result |
|---|---|
| `GET /meteo/info` | Array of all `(provider, variable)` datasets currently in the SFTP. |
| `GET /meteo/info?provider=harmonie` | Array of every variable of the given provider. |
| `GET /meteo/info?provider=radar` | Array with one entry (RADAR's implicit dataset). |
| `GET /meteo/info?provider=harmonie&variable=Precipitacion` | Array with one entry. |

The response is **always an array** so consumers can use the same parser regardless of the filter.

**Response 200**:

```json
[
  {
    "provider": "RADAR",
    "variable": null,
    "layerName": "tajo:radar_precipitacion",
    "info": {
      "nombre": "Precipitación",
      "fechaInicio": "2026-04-04T19:00:00Z",
      "fechaFin": "2026-04-06T18:00:00Z",
      "pasoDeTiempo": 60,
      "unidad": "mm",
      "ncols": 677,
      "nrows": 280,
      "bbox": { "minX": -7.5438, "minY": 38.7845, "maxX": -1.4508, "maxY": 41.3045 },
      "cellsize": 0.009,
      "nodata": -999.0
    },
    "lastRun": {
      "startedAt": "2026-04-06T18:00:00Z",
      "finishedAt": "2026-04-06T18:02:14Z",
      "status": "ok",
      "filesOk": 48,
      "filesFailed": 0
    }
  },
  {
    "provider": "HARMONIE",
    "variable": "Precipitacion",
    "layerName": "tajo:harmonie_precipitacion",
    "info": { /* ... */ },
    "lastRun": { /* ... */ }
  }
]
```

**Errors**:
- `400` — `variable` provided without `provider`.
- `404` — the requested provider (or provider+variable) does not exist in the SFTP.
- `502` — `ms-sftp-api` is unreachable (`ProviderError`).

**Internals**: All filter combinations execute the same `MeteoInfoQuery({ provider?, variable? })` handler. Discovery walks the SFTP tree once via `ms-sftp-api`, parses every `info.json`, and the handler applies the filter in memory before returning. Cached for 60 s via `CachingQueryBus` (cache key includes the filter).

---

## `POST /meteo/sync`

Trigger an immediate sync of every dataset. Same logic as the cron tick.

**Query parameters** (all optional):

| Param | Type | Description |
|---|---|---|
| `provider` | `string` | Limit the sync to a single provider. |
| `variable` | `string` | Limit the sync to a single variable. Requires `provider`. Use `_` for RADAR's implicit dataset. |

**Behavior**:

| Query | Result |
|---|---|
| `POST /meteo/sync` | Sync every dataset (cron-equivalent). |
| `POST /meteo/sync?provider=radar` | Sync RADAR only. |
| `POST /meteo/sync?provider=harmonie&variable=Precipitacion` | Sync that single dataset only. |

**Request body**: empty.

**Response 200**:

```json
{
  "triggeredBy": "manual",
  "datasets": [
    {
      "provider": "RADAR",
      "variable": null,
      "status": "ok",
      "filesOk": 0,
      "filesFailed": 0,
      "runId": "..."
    },
    {
      "provider": "HARMONIE",
      "variable": "Precipitacion",
      "status": "ok",
      "filesOk": 3,
      "filesFailed": 0,
      "runId": "..."
    }
  ]
}
```

If a dataset fails entirely, its `status` is `failed` and `filesFailed >= 0`. If only some files fail, `status` is `partial`. If there is nothing new to process, `status` is `noop`. The endpoint returns 200 even when individual datasets fail (overall success means "the cycle ran"); it returns 500 only if it could not even discover datasets.

**Errors**:
- `400` — `variable` provided without `provider`.
- `404` — the requested provider/variable does not exist in the SFTP.

**Internals**: Same `SyncMeteoCommand({ provider?, variable?, triggeredBy: 'manual' })` for all variants. The cron worker dispatches the same command with `triggeredBy: 'cron'` and no filter.

---

## Cross-cutting

**Standard error envelope** (inherited from the boilerplate's `HttpExceptionFilter`):

```json
{ "StatusCode": 502, "ErrorCode": "TRxxx", "ErrorDescription": "..." }
```

**Logging**: Every request gets a `x-correlation-id` header (generated if missing). Sync runs propagate it through to sftp-api and GeoServer REST calls.

**Caching**:
- `GET /meteo/info` is wrapped by `CachingQueryBus` with TTL 60 s; cache key includes `provider`/`variable` query.
- `POST /meteo/sync` invalidates the relevant cache keys before returning.

---

## Endpoint summary

| Method | Path | Query | Purpose |
|---|---|---|---|
| `GET` | `/meteo/info` | `provider?`, `variable?` | List metadata (all / by provider / by dataset) |
| `POST` | `/meteo/sync` | `provider?`, `variable?` | Trigger sync (all / by provider / by dataset) |

**Two endpoints total**, each fronting a single CQRS handler with optional filters. No path-parameter variants.
