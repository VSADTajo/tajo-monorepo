# Phase 0 Research — ms-meteo-api

All NEEDS CLARIFICATION items from Technical Context: **none** (the feature is fully specified after the design conversation that produced `spec.md`). This document records the technical decisions and the alternatives considered, so they are reviewable later.

---

## Decision 1 — Service ownership of the feature

**Decision**: Create a new microservice `ms-meteo-api` rather than extending an existing one.

**Rationale**:
- The feature is a long-running ETL pipeline with its own dependencies (GDAL ~200 MB extra in the image, scheduler, GeoServer REST client, bind mount to `/opt/datasets`).
- Existing microservices have unrelated responsibilities: `ms-sftp-api` is pure file I/O, `ms-hydro-api` owns hydrological masters, `ms-model-api` runs hydrological models, `ms-predictions-api` runs predictions.
- The dataset surface is going to grow (4 providers × N variables, more variables expected). A dedicated service keeps the meteo domain isolated and independently deployable.
- Aligns with the platform's "one micro per bounded context" pattern.

**Alternatives considered**:
- *Extend `ms-hydro-api`*: rejected because it would mix data masters (low-volume CRUD) with heavy ETL, and bloat its Docker image with GDAL.
- *Extend `ms-model-api`*: rejected because models consume meteo data, they should not be the producer of it.
- *Cron job in `ms-sftp-api`*: rejected because it would violate the "I/O purity" of that service and couple it to GeoServer.

---

## Decision 2 — How to read SFTP files from the new service

**Decision**: Consume the existing `ms-sftp-api` over HTTP. Do **not** mount the `sftp-storage` Docker volume in `ms-meteo-api`.

**Rationale**:
- `ms-sftp-api` already exposes `GET /files?directory=...` (list) and `GET /files/download?path=...` (binary stream) with a client whitelist (`x-internal-caller`). Two services already use this pattern (`ms-model-api`, `sftp-frontend`).
- Mounting the volume in a second service would create implicit coupling and make storage moves harder.
- Adds one missing endpoint: `GET /files/read?path=...` for text content (so we can fetch `info.json` as parsed text without abusing `download`).

**Alternatives considered**:
- *Mount `sftp-storage`* in `ms-meteo-api`: rejected for coupling reasons.
- *Have `ms-sftp-api` push events via RabbitMQ when files arrive*: rejected as out of scope (current cleanup/upload model is pull-based, providers do not send notifications).

---

## Decision 3 — Where the GeoTIFFs are written

**Decision**: Write generated GeoTIFFs to `/opt/datasets/meteo/<provider>_<variable>/` inside the container, which is bind-mounted from `/opt/geoserver/datasets` on the host. GeoServer already reads `/opt/datasets/...` (its own bind mount).

**Rationale**:
- GeoServer's ImageMosaic store works best with files on a path it can stat directly.
- The bind mount is reused — no new persistent volume to manage.
- Naming convention `meteo/<provider>_<variable>/` keeps each layer's granules isolated.

**Alternatives considered**:
- *Streaming via GeoServer's `external.imagemosaic` POST with a temporary URL*: more complex, requires the file to live somewhere reachable anyway.
- *Push GeoTIFF bytes directly to GeoServer via `imagemosaic` POST*: works but doubles the I/O (write to disk, read back into HTTP body) and the mosaic indexer still needs the file on disk.

---

## Decision 4 — Raster conversion: GDAL vs in-process libraries

**Decision**: Spawn `gdal_translate` from the system `gdal-bin` package via Node `child_process`, wrapped behind a `RasterConverterPort` in the domain.

**Rationale**:
- ESRI ASCII Grid → GeoTIFF is the canonical use case for `gdal_translate -of GTiff`. Stable, battle-tested, supports all the flags we need (`-a_srs`, `-a_nodata`, `-co COMPRESS`, `-co TILED`).
- No reliable Node binding for this pipeline that does not still require the GDAL native library on the image.
- Wrapping it behind a port keeps the rest of the code free of `child_process` and lets us mock it in tests.

**Command**:
```bash
gdal_translate \
  -of GTiff \
  -a_srs EPSG:4326 \
  -a_nodata -999 \
  -co COMPRESS=DEFLATE \
  -co TILED=YES \
  <input.NNN> <output.tif>
```

**Alternatives considered**:
- *`node-gdal-async`*: an actively-maintained N-API binding, but it ships its own GDAL build, increasing attack surface and image size, and historically has had compatibility issues on alpine. Spawning the CLI is simpler.
- *Pure-JS ASCII Grid → GeoTIFF*: writing one ourselves would be fragile and out of scope.

---

## Decision 5 — Layer model in GeoServer (one layer per dataset, with TIME)

**Decision**: One GeoServer ImageMosaic store + one layer per `(provider, variable)` dataset, using the TIME dimension to expose the per-step rasters as granules of that layer.

**Rationale**:
- Frontend wants a single `tajo:harmonie_precipitacion` layer with a time slider, not 48 separate layers.
- ImageMosaic with `timeregex.properties` is GeoServer's native way of doing this; the regex extracts the timestamp from the file name (`radar_precipitacion_20260405T030000.tif`).
- Bootstrap is idempotent: if the store/layer already exists we no-op.
- Adding a new granule is `POST /workspaces/tajo/coveragestores/<store>/external.imagemosaic` with the file path. GeoServer takes care of the index update.

**Alternatives considered**:
- *One layer per timestamp*: rejected, would create 13 × 48 = 624 layers, unmanageable in the UI and unnatural for clients.
- *GeoServer image pyramid*: not applicable, our rasters are small (677×280) and not multi-scale.
- *Hosting on a tile server (Mapbox GL, MapTiler)*: out of scope; the platform standardizes on GeoServer.

---

## Decision 6 — Layer naming convention

**Decision**: `tajo:<provider>_<variable>` in lowercase snake_case. RADAR (which has no variable level) becomes `tajo:radar_precipitacion` (its only dataset).

**Examples**:
- `tajo:radar_precipitacion`
- `tajo:harmonie_precipitacion`
- `tajo:harmonie_temperatura`
- `tajo:eps_precipitacion_media`
- `tajo:eps_precipitacion_25`
- `tajo:saih_precipitacion`

**Rationale**:
- Deterministic → consumers can hardcode names without an API call.
- Lowercase + snake_case avoids URL-escaping issues in WMS requests.
- Workspace `tajo` already exists.

---

## Decision 7 — Source of truth for "what is published"

**Decision**: GeoServer is the source of truth. The audit table `meteo_ingest_run` is for human/auditing visibility, **not** for idempotency.

**Rationale**:
- Avoids the desync class of bugs where the DB says "done" but GeoServer was rolled back, or vice versa.
- Recovery from any failure mode is automatic: the next cycle queries `granules.json`, diffs against the expected timestamps, and processes only the missing ones.
- If the operator manually deletes a granule, the next cycle re-creates it. Self-healing.

**Mechanism**: For each dataset, the worker calls
`GET /rest/workspaces/tajo/coveragestores/<store>/coverages/<layer>/index/granules.json`
and parses the `time` attribute of each feature.

**Alternatives considered**:
- *DB-backed idempotency table* (one row per file): more code, more failure modes, no real benefit because GeoServer already knows. Rejected for the reasons above.

---

## Decision 8 — Trigger model: cron + manual

**Decision**: Both. `@nestjs/schedule` cron expression configurable via `METEO_SYNC_CRON` (default `0 */3 * * *`, every 3 hours). Manual triggers via `POST /meteo/sync` (all) and `POST /meteo/:provider/:variable/sync` (one).

**Concurrency**: A run-level mutex per `(provider, variable)` prevents two cycles for the same dataset overlapping (in-process Map of locks, no distributed lock — only one replica of `ms-meteo-api`). Different datasets process in parallel within a cycle (bounded concurrency, default 4).

**Rationale**:
- Cron covers the steady state.
- Manual endpoint enables operators to force a refresh after fixing a provider issue, and is essential for the e2e tests.
- A simple in-process mutex is enough because the service runs as a single container today.

---

## Decision 9 — Retention policy

**Decision**: Accumulate granules. A second cron (daily, configurable via `METEO_RETENTION_CRON`, default `0 3 * * *`) deletes granules whose `time` attribute is older than `now - METEO_RETENTION_DAYS` (default 7) for every meteo layer. Granule deletion is via the GeoServer REST `DELETE /index/granules?filter=...` API. The corresponding GeoTIFF on disk is also deleted (best effort) after the granule is removed.

**Rationale**:
- Allows comparing past forecasts with newer ones (model validation and incident review).
- Bounds disk to ~7 × peak ≈ ~4.5 GB total across all layers.
- Independent from the ingest path so failures cannot block ingest.

---

## Decision 10 — Audit table shape

**Decision**: One table `meteo_ingest_run` with one row per `(cycle, provider, variable)` attempt. Fields described in `data-model.md`. Cycles that find nothing to do still write a row with `status = 'noop'` (per FR-019).

**Rationale**:
- Granularity matches what an operator actually wants to see in a UI ("which datasets ran tonight, and how did they go").
- Avoids per-file rows (~17k/year) until there is a concrete UI requirement that needs them.
- `(provider, variable, started_at desc)` index covers the typical "latest run for X" query.

---

## Decision 11 — Caching of metadata endpoints

**Decision**: Use the existing `CachingQueryBus` with a 60-second TTL on the metadata queries. Cache key includes provider/variable when present.

**Rationale**:
- The `info.json` files change at most every few hours (when providers refresh forecasts). 60 s is a reasonable freshness/load tradeoff.
- The cache layer already exists in the boilerplate; this is zero new code.

**Invalidation**: After a successful sync of a dataset, the corresponding cache key(s) are invalidated by the command handler (same pattern as the boilerplate examples).

---

## Decision 12 — Configuration surface

**Decision**: All tunables come from environment variables (loaded via `@nestjs/config`):

| Variable | Default | Purpose |
|---|---|---|
| `APP_PORT` | `3010` | HTTP port |
| `DB_HOST` / `DB_PORT` / ... | `infra-db-meteo` / `5432` / ... | Postgres connection |
| `REDIS_HOST` / `REDIS_PORT` | `infra-redis` / `6379` | Cache |
| `SFTP_API_URL` | `http://ms-sftp-api:8212` | sftp-api base URL |
| `SFTP_API_INTERNAL_CALLER` | `ms-meteo-api` | x-internal-caller header value |
| `METEO_BASE_PATH` | `tajo/METEO` | Root directory in SFTP |
| `GEOSERVER_URL` | `http://vsad-tajo-geoserver:8080/geoserver` | GeoServer base URL |
| `GEOSERVER_USER` / `GEOSERVER_PASSWORD` | `admin` / `geoserver` | Basic auth |
| `GEOSERVER_WORKSPACE` | `tajo` | Workspace name |
| `METEO_GEOTIFF_DIR` | `/opt/datasets/meteo` | Output directory for GeoTIFFs |
| `METEO_SYNC_CRON` | `0 */3 * * *` | Ingest cron schedule |
| `METEO_RETENTION_CRON` | `0 3 * * *` | Retention cron schedule |
| `METEO_RETENTION_DAYS` | `7` | History to keep |
| `METEO_INGEST_CONCURRENCY` | `4` | Datasets processed in parallel per cycle |

---

## Open follow-ups (not blocking)

- A future iteration may emit a RabbitMQ event `meteo.layer.updated` after a successful sync so `ms-predictions-api` can react. The architecture leaves room for this (the existing `IMessageBroker` port is already wired) but it is **not** in scope for `001-meteo-ingest`.
- A future iteration may add a per-file audit table (`meteo_ingest_file`) when the operations UI needs that drill-down. The schema of `meteo_ingest_run` is forward-compatible (new table, optional FK).
- The current single-replica deployment relies on an in-process mutex for concurrency. If we ever scale to multiple replicas, the mutex becomes a Redis lock or a Postgres advisory lock — also a future change.
