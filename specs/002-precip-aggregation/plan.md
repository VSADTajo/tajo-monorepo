# Implementation Plan: Precipitation Aggregation Layers (Daily & Total)

**Branch**: `002-precip-aggregation` | **Date**: 2026-05-06 | **Spec**: [spec.md](spec.md)  
**Input**: Feature specification from `/specs/002-precip-aggregation/spec.md`

## Summary

Extend ms-meteo-api to produce daily and total precipitation aggregation layers from existing hourly GeoTIFFs. After each hourly sync, the system groups hourly rasters by UTC date, sums them via GDAL VRT pixel functions, and publishes the results as new ImageMosaic layers in GeoServer. The feature touches only ms-meteo-api — no Dockerfile, database, or GeoServer configuration changes needed.

## Technical Context

**Language/Version**: TypeScript 5.7+ on Node.js >= 22  
**Primary Dependencies**: NestJS 11, @nestjs/cqrs 11, TypeORM 0.3, GDAL CLI (gdal_translate, gdalinfo)  
**Storage**: PostgreSQL 16 (audit table only — no new migrations), GeoServer ImageMosaic (raster files), filesystem  
**Testing**: Jest + Supertest + Testcontainers  
**Target Platform**: Linux container (node:22-alpine + gdal + gdal-tools)  
**Project Type**: single (NestJS microservice)  
**Performance Goals**: Aggregation completes within 5 minutes for a 48-hour forecast across all datasets  
**Constraints**: Must not block hourly sync; GDAL tools already installed (no Dockerfile changes); reuse existing config  
**Scale/Scope**: ~5–10 datasets (Harmonie + EPS variants), each with ~48 hourly GeoTIFFs per forecast

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Hexagonal Architecture | PASS | New service in `application/services/`. VRT/GDAL logic in `infrastructure/gdal/`. Domain value objects extended. No layer violations. |
| II. CQRS with MediatR | PASS | Aggregation triggered from existing `SyncMeteoHandler` (command handler). No new command needed — aggregation is a side effect of sync. |
| III. Dependency Inversion | PASS | `IRasterConverter` port extended with `sumGeoTiffs()`. Implementation in `GdalRasterConverter`. Testable via mock. |
| IV. Domain-Driven Validation | PASS | `LayerNameValueObject` extended with `withSuffix()`. File paths computed via `GeoTiffPathValueObject`. No anemic entities. |
| V. Integration Testing | PASS | E2E tests will verify aggregation via the `POST /meteo/sync` endpoint. Mock GDAL/GeoServer for unit tests. |
| VI. Type Safety | PASS | Strict mode. All new interfaces and types properly typed. |
| VII. Structured Error Hierarchy | PASS | GDAL failures throw `ProviderError`. Aggregation errors logged and reported in sync result. |

**Post-Design Re-Check**: All gates still PASS. No constitution violations.

## Project Structure

### Documentation (this feature)

```text
specs/002-precip-aggregation/
├── spec.md
├── plan.md                    # This file
├── research.md                # Phase 0: technical decisions
├── data-model.md              # Phase 1: domain entities and relationships
├── quickstart.md              # Phase 1: development quickstart
├── contracts/
│   ├── geoserver-wms.md       # External: new WMS layers
│   └── sync-api.md            # Internal: extended sync response
├── checklists/
│   └── requirements.md        # Spec quality checklist
└── tasks.md                   # Phase 2: implementation tasks (via /speckit.tasks)
```

### Source Code (files to modify/create)

```text
src/
├── app/
│   ├── application/
│   │   ├── commands/
│   │   │   └── meteo.commands.ts              # MODIFY: call aggregation after sync
│   │   └── services/
│   │       ├── meteo-aggregation.service.ts   # CREATE: core aggregation orchestration
│   │       └── image-mosaic-bootstrap.service.ts  # MODIFY: minor (reuse for daily/total stores)
│   │
│   ├── domain/
│   │   ├── ports/
│   │   │   └── raster-converter.port.ts       # MODIFY: add sumGeoTiffs() method
│   │   ├── value-objects/
│   │   │   └── layer-name.value-object.ts     # MODIFY: add withSuffix() method
│   │   └── results/
│   │       └── meteo.results.ts               # MODIFY: add AggregationResult type
│   │
│   └── infrastructure/
│       └── gdal/
│           └── gdal-raster-converter.ts       # MODIFY: implement sumGeoTiffs() with VRT
│
├── app/application/
│   └── application.module.ts                  # MODIFY: register MeteoAggregationService
```

**Structure Decision**: Single NestJS microservice, following existing hexagonal layout. No new modules — the aggregation service joins the existing `ApplicationModule` as a provider.

## Complexity Tracking

No constitution violations. No complexity justifications needed.

## Implementation Phases

### Phase 1: Domain Layer Extensions

**Files**: `layer-name.value-object.ts`, `raster-converter.port.ts`, `meteo.results.ts`

1. Add `withSuffix(suffix: string): LayerNameValueObject` to `LayerNameValueObject`
   - Returns a new instance with `bare = {originalBare}_{suffix}`
   - Workspace preserved from parent

2. Add `sumGeoTiffs(inputPaths: string[], outputPath: string): Promise<void>` to `IRasterConverter`
   - Abstract method on the port
   - Contract: reads raster metadata from first input, generates VRT, produces summed GeoTIFF

3. Add `AggregationResult` to `meteo.results.ts`
   - Fields: `datasetsProcessed`, `dailyLayersUpdated`, `totalLayersUpdated`, `errors`
   - Add `aggregation?: AggregationResult` to `SyncResult`

### Phase 2: Infrastructure — GDAL VRT Summation

**Files**: `gdal-raster-converter.ts`

1. Implement `sumGeoTiffs()` in `GdalRasterConverter`:
   - Run `gdalinfo -json <firstInput>` to read metadata (size, geotransform, SRS, NoData)
   - Build VRT XML string with `VRTDerivedRasterBand` + `PixelFunctionType=sum`
   - Write VRT to temp file
   - Run `gdal_translate -of GTiff -co COMPRESS=DEFLATE -co TILED=YES <vrt> <output>`
   - Clean up temp VRT file

2. Helper: `runGdalInfo(path: string): Promise<GdalInfo>` — spawns `gdalinfo -json` and parses result

3. Helper: `buildSumVrt(info: GdalInfo, inputPaths: string[]): string` — generates VRT XML

### Phase 3: Application — Aggregation Service

**Files**: `meteo-aggregation.service.ts` (new), `application.module.ts`

1. Create `MeteoAggregationService` (injectable):
   - Dependencies: `IRasterConverter`, `IGeoserverImageMosaicClient`, `IFileSystem`, `ImageMosaicBootstrapService`, `MeteoConfigService`, `Logger`

2. Method `aggregateDataset(dataset: DiscoveredDataset): Promise<DatasetAggregationResult>`:
   - Read hourly GeoTIFF directory for the dataset
   - List `.tif` files, parse timestamps from filenames
   - **Daily**: Group by UTC date → for each group, call `rasterConverter.sumGeoTiffs()` → bootstrap daily store → publish granule
   - **Total**: All files → call `rasterConverter.sumGeoTiffs()` → bootstrap total store → publish granule
   - Return counts of daily/total layers updated

3. Method `aggregateAll(datasets: DiscoveredDataset[]): Promise<AggregationResult>`:
   - Iterate over datasets, call `aggregateDataset()` for each
   - Collect results, catch per-dataset errors

4. Register in `ApplicationModule` providers

### Phase 4: Integration — Wire Into Sync Pipeline

**Files**: `meteo.commands.ts`

1. Inject `MeteoAggregationService` into `SyncMeteoHandler`

2. At the end of `execute()`, after cache invalidation:
   - If `changed` is true (any dataset had `filesOk > 0`)
   - Call `aggregationService.aggregateAll(datasets)`
   - Add `aggregation` result to `SyncResult`

3. For NOOP syncs (no changes), skip aggregation

### Phase 5: Retention Extension

**Files**: `meteo.commands.ts`

1. Extend `PurgeMeteoGranulesHandler` to also purge aggregated layers:
   - For each dataset, derive `_diaria` and `_total` layer names
   - Delete daily granules older than threshold
   - Delete corresponding daily `.tif` files from disk
   - For total: if all hourly data is purged, delete total layer and files

### Phase 6: Testing

1. **Unit tests** for `LayerNameValueObject.withSuffix()`
2. **Unit tests** for VRT XML generation (string output verification)
3. **Integration tests** for `sumGeoTiffs()` with real GDAL (requires GDAL in test environment)
4. **E2E tests** via `POST /meteo/sync` verifying aggregation runs and GeoServer receives the layers (mock GeoServer client)

## Dependencies

| Dependency | Type | Risk |
|-----------|------|------|
| GDAL VRT pixel functions (built-in `sum`) | Runtime | Low — built into GDAL C++ core, available on Alpine `gdal` package |
| `gdalinfo -json` output format | Runtime | Low — stable GDAL CLI, used universally |
| GeoServer ImageMosaic REST API | Runtime | Low — same API already used for hourly layers |
| Hourly GeoTIFFs on shared volume | Data | Low — prerequisite is existing sync working |

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| VRT `sum` pixel function not available on Alpine GDAL build | Aggregation fails | Verify with `gdal_translate --version` and a test VRT. Fallback: iterative `gdal_calc.py` with Python added to Dockerfile. |
| Large number of hourly files causes slow VRT processing | Aggregation takes >5 min | Bounded by forecast length (~48h). Monitor processing time in logs. |
| Race condition between sync and aggregation on disk files | Corrupt reads | Aggregation runs after sync completes (sequential, not parallel). Dataset mutex prevents concurrent syncs. |
| GeoServer store creation fails for aggregated layers | Layers not visible | Same retry/error handling as hourly pipeline. Logged and reported in aggregation result. |
