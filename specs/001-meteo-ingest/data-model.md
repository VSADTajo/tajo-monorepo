# Data Model — ms-meteo-api

This document describes entities, value objects and the persisted schema for feature `001-meteo-ingest`.

---

## Persisted entity

### `meteo_ingest_run`

One row per ingest attempt on a single dataset. Cron and manual triggers both write here. Cycles that find nothing to do also write a row (`status = 'noop'`) so cycles are never invisible.

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `id` | `uuid` PK | no | `uuid_generate_v4()` |
| `provider` | `varchar(32)` | no | Uppercase: `RADAR`, `HARMONIE`, `EPS`, `SAIH`, ... |
| `variable` | `varchar(64)` | yes | Snake-case-ish folder name (`Precipitacion`, `Precipitacion_25`, ...). `null` for providers without a variable level (RADAR). |
| `forecast_run` | `timestamptz` | yes | The `fecha_inicio` of the dataset's `info.json` at the time of this run. `null` for `noop` / `failed` cycles when `info.json` could not be read. |
| `files_processed` | `integer` | no | Files we attempted to convert and publish during this run (only the missing ones, not the whole dataset). Default `0`. |
| `files_ok` | `integer` | no | Successfully published. Default `0`. |
| `files_failed` | `integer` | no | Failed to publish. Default `0`. |
| `status` | `varchar(16)` | no | One of `running`, `ok`, `partial`, `failed`, `noop`. |
| `triggered_by` | `varchar(16)` | no | One of `cron`, `manual`. |
| `started_at` | `timestamptz` | no | When the worker began processing this dataset. |
| `finished_at` | `timestamptz` | yes | When the worker finished. `null` while `status = 'running'`. |
| `error_summary` | `text` | yes | Truncated multi-line summary of errors (per file or overall). |
| `created_at` | `timestamptz` | no | Default `now()`. Audit immutability hint. |

**Constraints**:
- `CHECK (status IN ('running','ok','partial','failed','noop'))`
- `CHECK (triggered_by IN ('cron','manual'))`
- `CHECK (files_processed = files_ok + files_failed)`

**Indexes**:
- `idx_meteo_ingest_run_provider_variable_started_at` on `(provider, variable, started_at DESC)` — covers "latest run for X" queries (used by metadata endpoints to attach `lastRun`).
- `idx_meteo_ingest_run_started_at` on `(started_at DESC)` — covers "recent activity" queries.
- `idx_meteo_ingest_run_status` on `(status)` — partial index for monitoring of failures.

**Migration**: `XXXXXXXXXXXXX-create-meteo-ingest-run.ts` with raw SQL `CREATE TABLE` + indexes (per project convention).

**State transitions**:

```text
                +---------+
                | running |---fail---> failed
                +----+----+
                     |
       +------+------+------+------+
       |             |             |
       v             v             v
       ok          partial        noop
```

`partial` is reachable when at least one file failed and at least one succeeded. `noop` is the start-and-end state for cycles with nothing to process.

---

## Value objects (in-memory only, no persistence)

### `ProviderName`

- Constructor takes a `string`, normalizes to uppercase, validates against `/^[A-Z][A-Z0-9_]{1,31}$/`.
- Throws `EntityError('Invalid provider name', 'provider')` on failure.
- Used everywhere a provider identifier flows.

### `VariableName`

- Constructor takes a `string`, validates against `/^[A-Za-z][A-Za-z0-9_]{1,63}$/`.
- Preserves the casing as found in the SFTP (we display it back to consumers).
- Has a `toSnakeCase(): string` method used by `LayerName.compose()` to derive the GeoServer layer suffix.
- Optional (`null`) for providers without a variable level.

### `MeteoInfoJson`

The parsed and validated content of an `info.json` file. Constructor takes the raw JSON object and:

1. Validates that **all** required fields are present: `nombre`, `fecha_inicio`, `fecha_fin`, `paso_de_tiempo`, `unidad`, `ncols`, `nrows`, `xtopleft`, `ytopleft`, `xbottomright`, `ybottomright`, `cellsize`, `NODATA`. Missing or wrongly-typed fields throw `EntityError`.
2. Parses `fecha_inicio` and `fecha_fin` from `YYYYMMDDHHMM` strings to `Date` objects (UTC). Invalid dates throw `EntityError`.
3. Validates that `paso_de_tiempo > 0`, `ncols > 0`, `nrows > 0`, `cellsize > 0`.
4. Exposes the bounding box as `{ minX, minY, maxX, maxY }` ready for GeoServer.

**Methods**:
- `expectedTimestamps(fileCount: number): Date[]` — returns `[fecha_inicio, fecha_inicio + 1*paso, ..., fecha_inicio + (fileCount-1)*paso]` in UTC. Used to map raster file index → granule timestamp.
- `bbox(): { minX: number; minY: number; maxX: number; maxY: number }`
- `crs(): 'EPSG:4326'` (constant under current assumptions)
- `noDataValue(): number` — returns `this.NODATA` (`-999.0` in current data).

### `LayerName`

Static helper that composes the deterministic layer name:

```ts
LayerName.compose('HARMONIE', 'Precipitacion')  // → 'tajo:harmonie_precipitacion'
LayerName.compose('RADAR', null)                // → 'tajo:radar_precipitacion'  (RADAR's implicit variable)
LayerName.compose('EPS', 'Precipitacion_25')    // → 'tajo:eps_precipitacion_25'
```

Includes the workspace prefix (`tajo:`). The bare layer name (without workspace) is also exposed via `bareName()`.

### `MeteoRasterFilename`

Parses a raster filename of the form `<prefix>0000.<step>` (e.g. `radarprec0000.005`, `harm_temp0000.047`).

- Extracts `step: number` (zero-padded 3 digits).
- Returns `null` for filenames that do not match (e.g. `info.json`, `radar_info.xml`) — used to filter listings.
- Has `static parse(filename: string): MeteoRasterFilename | null`.

---

## Domain ports (interfaces, no persistence)

### `ISftpFileClient`

```ts
abstract class ISftpFileClient {
    abstract listDirectory(path: string): Promise<SftpFileEntry[]>;
    abstract readText(path: string): Promise<string>;          // for info.json
    abstract download(path: string): Promise<Buffer>;          // for raster files
}
```

### `IGeoserverImageMosaicClient`

```ts
abstract class IGeoserverImageMosaicClient {
    abstract storeExists(workspace: string, store: string): Promise<boolean>;
    abstract createImageMosaicStore(opts: CreateStoreOptions): Promise<void>;
    abstract listGranules(workspace: string, layer: string): Promise<Granule[]>;
    abstract addGranule(workspace: string, store: string, geotiffPath: string): Promise<void>;
    abstract deleteGranulesOlderThan(workspace: string, layer: string, threshold: Date): Promise<number>;
}
```

`Granule` carries `{ id: string; time: Date; location: string }`.

### `IRasterConverter`

```ts
abstract class IRasterConverter {
    abstract toGeoTiff(input: ConvertRequest): Promise<void>;
}
// ConvertRequest: { sourceBuffer: Buffer; outputPath: string; nodata: number; srs: string }
```

The implementation writes the input to a temp file, runs `gdal_translate`, and removes the temp file. The output path is the final destination on disk.

### `IMeteoIngestRunRepository`

```ts
abstract class IMeteoIngestRunRepository {
    abstract create(run: MeteoIngestRun): Promise<MeteoIngestRun>;
    abstract update(run: MeteoIngestRun): Promise<MeteoIngestRun>;
    abstract findLatestByDataset(provider: string, variable: string | null): Promise<MeteoIngestRun | null>;
    abstract findLatestForAll(): Promise<Map<string, MeteoIngestRun>>;  // key = `${provider}::${variable ?? ''}`
}
```

---

## Result objects (returned from queries/commands)

### `MeteoInfoResult`

Returned by the metadata queries:

```ts
class MeteoInfoResult {
    provider: string;
    variable: string | null;
    layerName: string;            // 'tajo:harmonie_precipitacion'
    info: {
        nombre: string;
        fechaInicio: string;      // ISO 8601
        fechaFin: string;         // ISO 8601
        pasoDeTiempo: number;     // minutes
        unidad: string;
        ncols: number;
        nrows: number;
        bbox: { minX: number; minY: number; maxX: number; maxY: number };
        cellsize: number;
        nodata: number;
    };
    lastRun: {
        startedAt: string | null;
        finishedAt: string | null;
        status: string;           // 'running'|'ok'|'partial'|'failed'|'noop'
        filesOk: number;
        filesFailed: number;
    } | null;
}
```

`GET /meteo/info` returns `MeteoInfoResult[]`. The provider/variable variants return the relevant subset.

### `SyncResult`

Returned by the sync commands:

```ts
class SyncResult {
    triggeredBy: 'cron' | 'manual';
    datasets: Array<{
        provider: string;
        variable: string | null;
        status: 'ok' | 'partial' | 'failed' | 'noop';
        filesOk: number;
        filesFailed: number;
        runId: string;
    }>;
}
```

---

## Relationship summary

```text
                                ┌──────────────────────────┐
                                │   meteo_ingest_run (DB)  │
                                └──────────────────────────┘
                                          ▲
                                          │ writes
                                          │
   ┌─────────────────┐    ┌───────────────────────────────┐    ┌──────────────────────┐
   │  MeteoController│ →  │  Sync*Handler / Get*Handler   │ →  │  Domain Ports        │
   │    (api/)       │    │  (application/)               │    │  ISftpFileClient     │
   └─────────────────┘    └───────────────────────────────┘    │  IGeoserverImageMosaicClient │
                                                                │  IRasterConverter    │
                                                                │  IMeteoIngestRunRepository │
                                                                └──────────┬───────────┘
                                                                           │ implemented by
                                                                           ▼
                                                  ┌────────────────────────────────────────┐
                                                  │ infrastructure adapters                │
                                                  │  - SftpFileClient (axios)              │
                                                  │  - GeoserverImageMosaicClient (axios)  │
                                                  │  - GdalRasterConverter (child_process) │
                                                  │  - MeteoIngestRunRepository (TypeORM)  │
                                                  └────────────────────────────────────────┘
```

No new tables besides `meteo_ingest_run`. No relations to other domains in this iteration.
