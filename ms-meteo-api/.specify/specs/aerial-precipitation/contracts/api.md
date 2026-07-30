# API Contracts: Aerial Precipitation

**Plan**: `.specify/specs/aerial-precipitation/plan.md`

All endpoints live on `ms-meteo-api` (`:3010`) and are mirrored 1-to-1 as passthrough on `ms-gateway-api` (`:3000`). The public surface is the gateway; the meteo-api endpoints are internal.

Read endpoints go through `CachingQueryBus`. Global validation pipe is `whitelist: true, forbidNonWhitelisted: true` → unknown params return 400.

All timestamps in responses are ISO 8601 UTC.

---

## Shared response shapes

### `AerialPrecipitationSeriesDto` (summary mode — default)

```jsonc
{
    "id": "uuid",
    "locationId": "Cuenca.NAM.E_08",
    "parameterId": "P.areal.ens.subcNAM.Med.24h",
    "provider": "ens",          // ens | harmonie | obs
    "layer": "subcNAM",         // sistema | aemet | subcNAM
    "stat": "Med",              // Med | Max | null
    "accumulation": "24h",      // 1h | 12h | 24h
    "forecastDate": "2026-07-21T00:00:00.000Z",
    "startDate": "2026-07-21T01:00:00.000Z",
    "endDate": "2026-07-24T01:00:00.000Z",
    "moduleInstanceId": "Processing_Catchment_EPS",
    "stationName": "CABECERA",
    "lat": 40.4721,
    "lon": -2.4155,
    "units": "mm",
    "timeStepSeconds": 3600,
    "creationDate": "2026-07-21T11:15:08.000Z",
    "approvedDate": "2026-07-21T11:17:46.000Z",
    "sourceFileName": "tagus_eps_Pareal_202607210000.json",
    "max":  { "eventDate": "2026-07-22T14:00:00.000Z", "value": 32.4, "flag": 2 },
    "last": { "eventDate": "2026-07-24T00:00:00.000Z", "value": 0.5,  "flag": 2 }
    // no "events" key in summary mode
}
```

### `AerialPrecipitationSeriesWithEventsDto` (full mode — `?includeEvents=true`)

Same as above plus:

```jsonc
{
    // ... summary fields ...
    "events": [
        { "eventDate": "2026-07-21T01:00:00.000Z", "value": 0.9, "flag": 2 },
        { "eventDate": "2026-07-21T02:00:00.000Z", "value": 1.19, "flag": 2 }
    ]
}
```

---

## 1. `GET /aerial-precipitation`

Filtered list of series, paginated.

### Query params

| Param | Type | Required | Notes |
|---|---|---|---|
| `layer` | enum `sistema` \| `aemet` \| `subcNAM` | no | |
| `provider` | enum `ens` \| `harmonie` \| `obs` | no | |
| `locationId` | string (repeatable) | no | Repeat to filter by multiple: `?locationId=Cuenca.NAM.E_08&locationId=Sistema.Tajo.3` |
| `accumulation` | enum `1h` \| `12h` \| `24h` | no | Case-insensitive; normalized server-side |
| `stat` | enum `Med` \| `Max` \| `none` | no | `none` matches series where `stat IS NULL` |
| `fromForecastDate` | ISO 8601 | no | Inclusive lower bound on `forecastDate` |
| `toForecastDate` | ISO 8601 | no | Inclusive upper bound |
| `includeEvents` | boolean (`true`/`false`/`1`/`0`) | no, default `false` | If true, response includes each series' full `events[]` |
| `page` | int, min 1 | no, default 1 | |
| `limit` | int, min 1, max 500 | no, default 50 | |

### Response 200

```jsonc
{
    "data": [ AerialPrecipitationSeriesDto | AerialPrecipitationSeriesWithEventsDto ],
    "total": 4176,
    "page": 1,
    "limit": 50
}
```

### Errors

- **400** — validation failure (unknown param, wrong enum value, `limit > 500`, `page < 1`).
- **500** — DB failure.

### Cache

- Key: `aerial-precipitation:list:v1:{json(filters)}` (includes `includeEvents` in the key — different payload shape).
- TTL: 60s.

---

## 2. `GET /aerial-precipitation/latest`

For a `(layer, provider, accumulation, stat?)` combination, returns the single series per polygon that has the maximum `forecastDate`.

### Query params

| Param | Type | Required | Notes |
|---|---|---|---|
| `layer` | enum | **yes** | |
| `provider` | enum | **yes** | |
| `accumulation` | enum | **yes** | |
| `stat` | enum \| `none` | no | Required for `provider=ens` (Med or Max); ignored for others |
| `includeEvents` | boolean | no, default `false` | |

### Response 200

```jsonc
{
    "generatedAt": "2026-07-21T11:20:00.000Z",  // when the server ran the query
    "layer": "subcNAM",
    "provider": "harmonie",
    "accumulation": "24h",
    "stat": null,
    "series": [ AerialPrecipitationSeriesDto | ...WithEventsDto ]  // one per polygon
}
```

### Errors

- **400** — missing required param, invalid combination (e.g. `stat=Max` with `provider=harmonie`).
- **500** — DB failure.

### Cache

- Key: `aerial-precipitation:latest:v1:{layer}:{provider}:{accumulation}:{stat ?? '_'}:{includeEvents}`.
- TTL: 300s.

---

## 3. `GET /aerial-precipitation/by-location/:locationId`

All active series for one polygon.

### Path params

| Param | Type | Notes |
|---|---|---|
| `locationId` | string | Must match one of the known prefixes (`Sistema.`, `Cuenca.NAM.`, `Cuenca.AEMET.`), else 400 |

### Query params

| Param | Type | Required | Notes |
|---|---|---|---|
| `provider` | enum | no | Optional filter |
| `accumulation` | enum | no | Optional filter |
| `fromForecastDate` | ISO 8601 | no | If set (with or without `to`), returns the historical fan — every `forecastDate` in the window. Otherwise the endpoint returns only the latest `forecastDate` per `(provider, accumulation, stat)`. |
| `toForecastDate` | ISO 8601 | no | Idem. |
| `includeEvents` | boolean | no, default `false` | |

### Response 200

```jsonc
{
    "locationId": "Cuenca.NAM.E_08",
    "groups": [
        {
            "provider": "obs",
            "accumulation": "1h",
            "stat": null,
            "series": [ AerialPrecipitationSeriesDto ]   // len=1 in default (latest) mode, >1 with fromForecastDate
        },
        {
            "provider": "ens",
            "accumulation": "24h",
            "stat": "Med",
            "series": [ AerialPrecipitationSeriesDto ]
        }
        // ... one group per distinct (provider, accumulation, stat)
    ]
}
```

### Errors

- **400** — invalid `locationId` format.
- **500** — DB failure.

A well-formed `locationId` with no series returns **200** with `groups: []` (not 404).

### Cache

- Key: `aerial-precipitation:by-location:v1:{locationId}:{json(filters)}`.
- TTL: 60s.

---

## Gateway passthrough

`ms-gateway-api` exposes each endpoint at the same URL under its own base. Behavior:

- Adds `@ApiQuery` per param + a rich `@ApiResponse example` (following the same pattern established for `simulation-results`).
- Forwards **only** the whitelisted query params (`layer`, `provider`, `locationId`, `accumulation`, `stat`, `fromForecastDate`, `toForecastDate`, `includeEvents`, `page`, `limit`). Any other param sent by the client is dropped at the gateway (defense in depth since upstream is `forbidNonWhitelisted`).
- Sets the standard `x-internal-caller: ms-gateway-api` header on the outbound call.
- Preserves auth / trace context (same helpers as other proxies).

---

## Swagger examples (embedded in gateway controller)

Each of the three routes ships one full response example in its `@ApiResponse` decorator, drawn from the real sample payloads:

- List example → 2 series from the `Sistema.Tajo.3` HENARES polygon (one Harmonie 1h + one SAIH 1h).
- Latest example → 3 series (one `Cuenca.NAM.E_08`, one `Cuenca.AEMET.1`, one `Sistema.Tajo.3`) for `layer=subcNAM|aemet|sistema` × `provider=harmonie` × `accumulation=24h`.
- By-location example → `Cuenca.NAM.E_08` with 3 groups (`obs 1h`, `harmonie 24h`, `ens 24h Med`) each with 1 series.

Same conventions as the `simulation-results` swagger: full nested station snapshot is out of scope here (this feature deals only with polygon-scoped data, no station join).
