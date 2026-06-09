# Feature Specification: Precipitation Aggregation Layers (Daily & Total)

**Feature Branch**: `002-precip-aggregation`  
**Created**: 2026-05-06  
**Status**: Draft  
**Input**: User description: "Necesitamos capas para precipitaciones EPS y Harmonie, ademas de las horarias (que son las que ya tenemos) diarias y totales. Seria pillar esas imagenes que ya tenemos, agruparlas por dia y agrupar el total y mostrarlo en geoserver."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View Daily Accumulated Precipitation (Priority: P1)

As a hydrologist or water resource manager, I want to view the total precipitation accumulated over an entire day on a map, so I can assess daily rainfall patterns across the Tajo basin without manually summing hourly values.

Currently, users can only query individual hourly precipitation maps. To understand daily totals, they must mentally aggregate 24 separate hourly maps. This feature automatically computes and serves the daily sum as a single map layer.

**Why this priority**: Daily precipitation totals are the most commonly used temporal resolution for water resource management, flood assessment, and reporting. This is the primary deliverable requested by the team.

**Independent Test**: Can be fully tested by requesting a WMS GetMap for the daily layer with a specific date and verifying the returned image shows accumulated precipitation values.

**Acceptance Scenarios**:

1. **Given** hourly precipitation GeoTIFFs exist for a full day (e.g., 24 hourly files for 2026-05-06), **When** the aggregation process runs, **Then** a single daily GeoTIFF is produced whose pixel values equal the sum of all hourly pixel values for that day.
2. **Given** the daily layer is published in GeoServer, **When** a user requests `LAYERS=Tajo:harmonie_precipitacion_diaria&TIME=2026-05-06`, **Then** GeoServer returns a precipitation map showing the daily total for May 6th.
3. **Given** a forecast spans two calendar days (e.g., 48h starting May 6th 00:00), **When** the aggregation runs, **Then** two daily GeoTIFFs are produced: one for May 6th and one for May 7th.
4. **Given** a partial day exists (e.g., forecast ends at May 7th 12:00, so only 12 hourly files for that day), **When** aggregation runs, **Then** the daily GeoTIFF for May 7th is the sum of the available 12 hours (not padded with zeros).

---

### User Story 2 - View Total Accumulated Precipitation (Priority: P1)

As a hydrologist, I want to view the total accumulated precipitation across the entire forecast period on a single map, so I can quickly assess the overall expected rainfall without inspecting individual days or hours.

**Why this priority**: The total forecast accumulation is equally critical as daily totals. It provides the single most important overview number for flood risk assessment and reservoir management.

**Independent Test**: Can be fully tested by requesting a WMS GetMap for the total layer and verifying the returned image shows the sum of all hourly precipitation values across the forecast.

**Acceptance Scenarios**:

1. **Given** hourly precipitation GeoTIFFs exist for a complete forecast (e.g., 48 files), **When** the aggregation process runs, **Then** a single total GeoTIFF is produced whose pixel values equal the sum of all hourly pixel values.
2. **Given** the total layer is published in GeoServer, **When** a user requests `LAYERS=Tajo:harmonie_precipitacion_total` (no TIME parameter), **Then** GeoServer returns a precipitation map showing the total accumulated precipitation for the entire forecast period.
3. **Given** a new forecast replaces the previous one, **When** aggregation runs, **Then** the total GeoTIFF is regenerated from the new hourly data, not accumulated on top of the old forecast.

---

### User Story 3 - Automatic Aggregation After Sync (Priority: P2)

As a system operator, I want the daily and total aggregation to happen automatically after each hourly ingest cycle, so the aggregated layers are always up to date without manual intervention.

**Why this priority**: Without automation, operators would need to manually trigger aggregation after every sync. Since the sync runs every 3 hours via cron, this must be seamless.

**Independent Test**: Can be tested by triggering a sync (manual or cron) and verifying that daily and total layers are updated in GeoServer after the sync completes.

**Acceptance Scenarios**:

1. **Given** the hourly sync cron runs and ingests new GeoTIFFs, **When** the sync completes successfully, **Then** aggregation runs automatically for all datasets that received new data.
2. **Given** a manual sync is triggered via `POST /meteo/sync`, **When** it completes, **Then** aggregation also runs for the affected datasets.
3. **Given** the hourly sync finds nothing new (NOOP), **When** sync completes, **Then** aggregation is skipped (no unnecessary recomputation).

---

### User Story 4 - EPS Precipitation Aggregation (Priority: P2)

As a hydrologist, I want daily and total aggregation applied to all EPS precipitation layers (e.g., eps_precipitacion_25, eps_precipitacion_50), not only Harmonie, so I can compare ensemble forecasts at daily and total scales.

**Why this priority**: EPS layers are equally important but share the same aggregation logic as Harmonie. Once the core mechanism works, extending to EPS is straightforward.

**Independent Test**: Can be tested by querying `LAYERS=Tajo:eps_precipitacion_25_diaria&TIME=2026-05-06` and verifying the response.

**Acceptance Scenarios**:

1. **Given** hourly EPS precipitation GeoTIFFs exist, **When** aggregation runs, **Then** daily and total layers are created for each EPS variant (e.g., `eps_precipitacion_25_diaria`, `eps_precipitacion_25_total`).
2. **Given** multiple EPS variants exist (Precipitacion_25, Precipitacion_50, etc.), **When** aggregation runs, **Then** each variant gets its own independent daily and total layers.

---

### User Story 5 - Retention Cleanup of Aggregated Layers (Priority: P3)

As a system operator, I want aggregated GeoTIFFs to be cleaned up when their source hourly data is purged by the retention policy, so disk space is not consumed by stale aggregations.

**Why this priority**: Without cleanup, aggregated files would accumulate indefinitely. Important for operational hygiene but not needed for initial feature delivery.

**Independent Test**: Can be tested by running the retention purge command and verifying that daily and total GeoTIFFs corresponding to purged hourly data are also removed.

**Acceptance Scenarios**:

1. **Given** the retention cron purges hourly granules older than 7 days, **When** purge completes, **Then** daily GeoTIFFs whose date falls entirely within the purged range are also deleted from disk and GeoServer.
2. **Given** hourly data for a specific dataset is completely purged, **When** purge completes, **Then** the corresponding total GeoTIFF and GeoServer layer are also cleaned up.

---

### Edge Cases

- What happens when a forecast has fewer than 24 hours for a given day (partial day)? The daily sum includes only the available hours.
- What happens when no hourly GeoTIFFs exist for a dataset? Aggregation is skipped for that dataset (no empty layers created).
- What happens when only 1 hourly GeoTIFF exists for a day? The daily sum equals that single hour's values.
- What happens when a pixel has NoData in some hours but valid values in others? The sum includes only valid pixels; pixels that are NoData in ALL hours remain NoData in the aggregate.
- What happens if GDAL summation fails for one dataset? The error is logged, that dataset is skipped, other datasets continue to be processed.
- What happens if the aggregation runs while a sync is in progress? The aggregation should wait for or run after the sync completes (no race conditions on shared GeoTIFF files).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST compute a daily precipitation sum by adding all hourly GeoTIFF pixel values that fall within the same UTC calendar day.
- **FR-002**: System MUST compute a total precipitation sum by adding all hourly GeoTIFF pixel values across the entire forecast period.
- **FR-003**: System MUST publish daily aggregations as a GeoServer ImageMosaic layer with a TIME dimension at day granularity, using the naming convention `<hourly_layer>_diaria` (e.g., `harmonie_precipitacion_diaria`).
- **FR-004**: System MUST publish total aggregations as a GeoServer coverage layer without a TIME dimension, using the naming convention `<hourly_layer>_total` (e.g., `harmonie_precipitacion_total`).
- **FR-005**: System MUST apply aggregation to all precipitation datasets (both Harmonie and EPS providers), not just a single layer.
- **FR-006**: System MUST trigger aggregation automatically after a successful hourly sync that ingested new data.
- **FR-007**: System MUST skip aggregation when the hourly sync results in no changes (NOOP).
- **FR-008**: System MUST regenerate (replace, not accumulate) daily and total aggregations each time aggregation runs, reflecting the latest hourly data on disk.
- **FR-009**: System MUST handle NoData pixels correctly: pixels that are NoData in all hourly inputs remain NoData in the aggregate; partial NoData pixels are summed from valid values only.
- **FR-010**: System MUST clean up aggregated GeoTIFFs and GeoServer layers when the corresponding hourly source data is purged by the retention policy.
- **FR-011**: System MUST log the outcome of each aggregation run (datasets processed, successes, failures) using the existing structured logging.
- **FR-012**: System MUST not block or interfere with the hourly sync process; aggregation runs after sync completes.

### Key Entities

- **Hourly GeoTIFF**: Existing raster file representing precipitation for one hour at one forecast step. Source input for aggregation. Located at `<geotiffDir>/<layer>/<layer>_<yyyyMMddHHmmss>.tif`.
- **Daily GeoTIFF**: New raster file representing the sum of all hourly precipitation for a single UTC day. Published to a `_diaria` ImageMosaic layer. Located at `<geotiffDir>/<layer>_diaria/<layer>_diaria_<yyyyMMdd>000000.tif`.
- **Total GeoTIFF**: New raster file representing the sum of all hourly precipitation across the entire forecast. Published to a `_total` coverage layer. Located at `<geotiffDir>/<layer>_total/<layer>_total_<forecastStartTimestamp>.tif`.
- **Aggregated Layer**: A GeoServer layer (daily or total) derived from hourly data. Has its own ImageMosaic store or simple coverage store.

## Assumptions

- All hourly GeoTIFFs for the same (provider, variable) share identical spatial extent, resolution, projection (EPSG:4326), and NoData value. No reprojection or resampling is needed.
- The container already has the required GDAL CLI tools (`gdal_translate`, `gdalinfo`) installed — no Dockerfile changes needed.
- Aggregation applies to all discovered datasets, not just precipitation. However, the primary use case and naming follow precipitation conventions. Non-precipitation datasets (if any) will also receive daily/total layers.
- The daily layer uses UTC dates for grouping (not local timezone).
- The total layer represents the full forecast period as a single accumulation, regenerated with each forecast cycle.
- No new environment variables or database migrations are required; the feature reuses existing configuration (`meteoGeotiffDir`, `geoserverWorkspace`, GeoServer REST API credentials).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can retrieve a daily precipitation map for any date covered by the current forecast by querying the `_diaria` layer with a TIME parameter, and the map visually and numerically reflects the sum of all hourly precipitation for that day.
- **SC-002**: Users can retrieve a total accumulated precipitation map for the entire forecast by querying the `_total` layer without a TIME parameter, and the map reflects the sum of all hourly precipitation across all forecast hours.
- **SC-003**: Aggregated layers are available in GeoServer within 5 minutes of a successful hourly sync completing (accounting for GDAL processing time).
- **SC-004**: All existing precipitation datasets (Harmonie and all EPS variants) have their corresponding `_diaria` and `_total` layers published automatically.
- **SC-005**: Disk usage from aggregated GeoTIFFs does not grow unboundedly; old aggregations are cleaned up when source hourly data is purged.
- **SC-006**: Aggregation failures for one dataset do not prevent aggregation of other datasets; errors are logged and the system remains operational.
