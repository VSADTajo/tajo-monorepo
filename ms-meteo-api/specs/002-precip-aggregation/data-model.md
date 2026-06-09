# Data Model: Precipitation Aggregation Layers

**Feature**: 002-precip-aggregation  
**Date**: 2026-05-06

## Overview

This feature does **not** introduce new database entities or migrations. All data is file-based (GeoTIFF rasters on disk) and managed through GeoServer's REST API. The domain model extends existing value objects with aggregation concepts.

## Domain Value Objects (Extended)

### LayerNameValueObject (extended)

Existing value object that computes deterministic GeoServer layer names. Extended with aggregation suffix support.

| Method | Input | Output | Example |
|--------|-------|--------|---------|
| `compose(provider, variable)` | `'HARMONIE', 'Precipitacion'` | `tajo:harmonie_precipitacion` | Existing — hourly layer |
| `withSuffix(suffix)` | `'diaria'` | `tajo:harmonie_precipitacion_diaria` | New — daily layer |
| `withSuffix(suffix)` | `'total'` | `tajo:harmonie_precipitacion_total` | New — total layer |

**Invariants**:
- Suffix is appended to the bare name, not the workspace
- Valid suffixes: `diaria`, `total`
- The resulting name follows the same `{workspace}:{bare}` format

### GeoTiffPathValueObject (reused)

Existing value object for deterministic file path composition. Used as-is for aggregated GeoTIFFs.

| Layer Type | Path Pattern | Example |
|------------|-------------|---------|
| Hourly (existing) | `{baseDir}/{layer}/{layer}_{yyyyMMddHHmmss}.tif` | `/opt/datasets/meteo/harmonie_precipitacion/harmonie_precipitacion_20260506140000.tif` |
| Daily (new) | `{baseDir}/{layer}_diaria/{layer}_diaria_{yyyyMMdd}000000.tif` | `/opt/datasets/meteo/harmonie_precipitacion_diaria/harmonie_precipitacion_diaria_20260506000000.tif` |
| Total (new) | `{baseDir}/{layer}_total/{layer}_total_{forecastStart}.tif` | `/opt/datasets/meteo/harmonie_precipitacion_total/harmonie_precipitacion_total_20260506000000.tif` |

**Invariants**:
- Daily timestamp always uses midnight UTC (`000000`) for the date being aggregated
- Total timestamp uses the forecast start time from `info.json` (`fechaInicio`)
- Directory structure mirrors the layer name

## File Entities (on disk, not in database)

### Hourly GeoTIFF (existing, read-only input)

| Attribute | Type | Description |
|-----------|------|-------------|
| path | string | Absolute path on shared volume |
| layer | string | Bare layer name (e.g., `harmonie_precipitacion`) |
| timestamp | Date | Forecast step time (extracted from filename) |
| nodata | number | NoData sentinel value |
| srs | string | Always `EPSG:4326` |
| ncols | number | Raster width in pixels |
| nrows | number | Raster height in pixels |

### Daily GeoTIFF (new, computed output)

| Attribute | Type | Description |
|-----------|------|-------------|
| path | string | `{baseDir}/{layer}_diaria/{layer}_diaria_{yyyyMMdd}000000.tif` |
| layer | string | `{hourlyLayer}_diaria` |
| date | string | UTC date being aggregated (YYYY-MM-DD) |
| timestamp | Date | Midnight UTC of the aggregated date |
| sourceFiles | string[] | Hourly GeoTIFF paths summed to produce this file |
| pixelValues | Float64[][] | Sum of all hourly pixel values for the date |

### Total GeoTIFF (new, computed output)

| Attribute | Type | Description |
|-----------|------|-------------|
| path | string | `{baseDir}/{layer}_total/{layer}_total_{forecastStart}.tif` |
| layer | string | `{hourlyLayer}_total` |
| forecastStart | Date | `fechaInicio` from info.json |
| sourceFiles | string[] | All hourly GeoTIFF paths summed |
| pixelValues | Float64[][] | Sum of all hourly pixel values |

## GeoServer Entities (managed via REST API)

### ImageMosaic Store — Daily

| Property | Value |
|----------|-------|
| Workspace | `tajo` |
| Store name | `{hourlyLayer}_diaria` |
| Coverage name | `{hourlyLayer}_diaria` |
| TIME dimension | Enabled, LIST presentation, ISO8601 |
| Default strategy | MAXIMUM (latest day) |
| Index storage | PostGIS table `{store}` in GeoServer DB |

### ImageMosaic Store — Total

| Property | Value |
|----------|-------|
| Workspace | `tajo` |
| Store name | `{hourlyLayer}_total` |
| Coverage name | `{hourlyLayer}_total` |
| TIME dimension | Enabled (single entry = effectively no dimension) |
| Default strategy | MAXIMUM |
| Index storage | PostGIS table `{store}` in GeoServer DB |

## Relationships

```
DiscoveredDataset (provider, variable)
  ├── LayerName: harmonie_precipitacion (hourly, existing)
  │     └── GeoTIFFs: *_20260506{HH}0000.tif (1 per hour)
  │
  ├── LayerName: harmonie_precipitacion_diaria (daily, new)
  │     └── GeoTIFFs: *_diaria_20260506000000.tif (1 per day, sum of hourly)
  │
  └── LayerName: harmonie_precipitacion_total (total, new)
        └── GeoTIFF: *_total_20260506000000.tif (1 per forecast, sum of all hourly)
```

## State Transitions

### Aggregation Lifecycle

```
Hourly sync completes with new data
  → Aggregation triggered
    → For each dataset with changes:
        → Read hourly GeoTIFFs from disk
        → Group by UTC date
        → For each date group:
            → Generate VRT XML (sum pixel function)
            → gdal_translate VRT → daily GeoTIFF
            → Bootstrap daily ImageMosaic store (if needed)
            → Replace daily granule in GeoServer
        → Sum all hourly GeoTIFFs:
            → Generate VRT XML (sum pixel function)
            → gdal_translate VRT → total GeoTIFF
            → Bootstrap total ImageMosaic store (if needed)
            → Replace total granule in GeoServer
```

### Retention Lifecycle

```
Retention purge runs (daily cron)
  → Purge hourly granules older than threshold (existing)
  → For daily layers:
      → Delete granules whose date < threshold
      → Delete corresponding .tif files
  → For total layers:
      → If hourly data still exists: regenerate total from remaining hours
      → If no hourly data remains: delete total layer and .tif files
```
