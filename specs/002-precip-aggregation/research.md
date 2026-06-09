# Research: Precipitation Aggregation Layers

**Feature**: 002-precip-aggregation  
**Date**: 2026-05-06

## Decision 1: Raster Summation Method

**Decision**: Use GDAL VRT (Virtual Raster Table) with the built-in `sum` pixel function, processed by `gdal_translate`.

**Rationale**:
- The container already has `gdal` and `gdal-tools` (Alpine packages) installed — no Dockerfile changes needed.
- The built-in `sum` pixel function is compiled into GDAL's C++ core and does not require Python. It works with any `gdal_translate` invocation that reads a VRT.
- VRT files are lightweight XML descriptors that reference existing GeoTIFFs without copying data. They can reference an unlimited number of source files (no 26-letter limit like `gdal_calc.py`).
- The existing `GdalRasterConverter` already spawns `gdal_translate` via `child_process`, so extending it with a VRT-based summation follows the same proven pattern.

**Alternatives considered**:
- `gdal_calc.py`: Requires Python + `python3-gdal` not installed in the Alpine Node container. Would need Dockerfile changes. Limited to 26 inputs per invocation.
- `node-gdal-async` npm package: Ships its own GDAL build, increases image size and attack surface. Rejected in 001-meteo-ingest research for the same reasons.
- Sequential `gdal_translate` merging: No native way to sum pixel values via simple translate calls without VRT intermediary.
- GeoServer WPS on-the-fly aggregation: Not installed on the GeoServer instance. Slow, complex configuration, fragile for production use.

## Decision 2: VRT XML Structure for Summation

**Decision**: Generate a `VRTDerivedRasterBand` with `PixelFunctionType=sum` that lists all input GeoTIFFs as `SimpleSource` elements.

**Rationale**:
- The `sum` pixel function sums all source values for each pixel position.
- NoData handling: when all sources are NoData for a pixel, the result is NoData. When some sources have NoData, they are treated as 0 in the sum (acceptable for precipitation — missing hours contribute 0, not NoData).
- Raster metadata (extent, resolution, projection, NoData) can be read from any existing hourly GeoTIFF via `gdalinfo -json`, ensuring the VRT matches exactly.

**VRT structure**:
```xml
<VRTDataset rasterXSize="{ncols}" rasterYSize="{nrows}">
  <SRS>EPSG:4326</SRS>
  <GeoTransform>{xmin}, {cellsize}, 0, {ymax}, 0, -{cellsize}</GeoTransform>
  <VRTRasterBand dataType="Float64" band="1" subClass="VRTDerivedRasterBand">
    <PixelFunctionType>sum</PixelFunctionType>
    <SourceTransferType>Float64</SourceTransferType>
    <NoDataValue>{nodata}</NoDataValue>
    <SimpleSource>
      <SourceFilename relativeToVRT="0">{absolute_path_1}</SourceFilename>
      <SourceBand>1</SourceBand>
      <NoDataValue>{nodata}</NoDataValue>
    </SimpleSource>
    <!-- one SimpleSource per hourly GeoTIFF -->
  </VRTRasterBand>
</VRTDataset>
```

## Decision 3: Daily Layer — ImageMosaic with TIME Dimension

**Decision**: Publish daily aggregation as ImageMosaic with TIME dimension at day granularity, using the same bootstrap pattern as hourly layers.

**Rationale**:
- Reuses the proven `ImageMosaicBootstrapService` flow (property files + GeoServer REST API).
- The TIME dimension allows querying by date: `TIME=2026-05-06`.
- Daily GeoTIFFs are named with midnight timestamp (e.g., `_20260506000000.tif`), which the existing `timeregex.properties` pattern `([0-9]{14})` will parse correctly.
- Each day = one granule in the mosaic. GeoServer's default strategy `MAXIMUM` returns the latest day when TIME is omitted.

**Alternatives considered**:
- Separate coverage store per day: Would create hundreds of stores over time. Not scalable.
- WMS Rendering Transformations: Requires GeoServer WPS extension, complex SLD, runtime computation overhead.

## Decision 4: Total Layer — ImageMosaic with Single Granule

**Decision**: Publish total aggregation as an ImageMosaic store with a single granule (using the forecast start timestamp), with TIME dimension enabled but containing only one entry.

**Rationale**:
- Reuses the same `ImageMosaicBootstrapService` and `IGeoserverImageMosaicClient` infrastructure. No new GeoServer client methods needed.
- A single-granule ImageMosaic behaves identically to a simple coverage for WMS clients: querying without TIME returns the only available granule.
- When a new forecast arrives, the old granule is replaced with the new total. The timestamp identifies which forecast it belongs to.
- This avoids creating a separate "simple coverage" store type in GeoServer, which would require different REST API calls and a second code path.

**Alternatives considered**:
- GeoServer CoverageStore (GeoTIFF type): Simpler conceptually, but requires different REST API endpoints (`/coveragestores/{name}/file.geotiff` vs `external.imagemosaic`). Would need new methods on the port and client.
- Disable TIME dimension via `enableTimeDimension` flag: Adds complexity to the port interface for minimal benefit. A single-entry LIST is functionally equivalent.

## Decision 5: Aggregation Trigger — Post-Sync Hook in SyncMeteoHandler

**Decision**: Call the aggregation service directly at the end of `SyncMeteoHandler.execute()`, after all datasets are processed and only if any dataset had changes.

**Rationale**:
- The sync handler already has the `changed` flag (`results.some(r => r.filesOk > 0)`). Aggregation should only run when new hourly data was ingested.
- Running inline keeps the logic sequential and avoids race conditions with the dataset mutex.
- The cron scheduler already calls `SyncMeteoCommand` every 3 hours, so aggregation inherits the same schedule for free.

**Alternatives considered**:
- Separate cron job for aggregation: Adds scheduling complexity and potential for hourly data to exist without its daily/total counterpart during the gap.
- Event-driven via RabbitMQ: Overengineered for a single-process service. Introduces async failure modes.
- Per-dataset aggregation (inside `processOne`): Would run aggregation N times (once per dataset per batch). Better to aggregate once after all datasets are synced.

## Decision 6: Retention of Aggregated Layers

**Decision**: Extend `PurgeMeteoGranulesHandler` to also clean up `_diaria` and `_total` layers when their source hourly data is purged.

**Rationale**:
- The purge handler already iterates over all datasets and has access to the GeoServer client and filesystem port.
- For daily layers: delete granules whose date is entirely before the retention threshold.
- For total layers: regenerate from remaining hourly data (or delete if no hourly data remains).
- Keeps retention logic centralized in one handler.

## Decision 7: Extending IRasterConverter Port

**Decision**: Add a `sumGeoTiffs(inputPaths: string[], outputPath: string): Promise<void>` method to the `IRasterConverter` abstract class.

**Rationale**:
- The port already abstracts GDAL operations. Raster summation is a natural extension.
- The VRT generation + `gdal_translate` implementation lives in `GdalRasterConverter`, maintaining the pattern.
- Tests can mock `sumGeoTiffs()` independently, without needing GDAL installed.
- The method needs `gdalinfo -json` to read raster metadata from the first input file, then generates the VRT XML and translates it.

## Decision 8: Layer Naming Convention

**Decision**: Extend `LayerNameValueObject` with a static method to derive aggregated layer names from the base hourly name.

**Rationale**:
- Naming is domain policy, already encapsulated in `LayerNameValueObject`.
- Convention: `{base}_diaria` for daily, `{base}_total` for total.
- Example: `harmonie_precipitacion` → `harmonie_precipitacion_diaria`, `harmonie_precipitacion_total`.
- The aggregated names follow the same `{workspace}:{bare}` pattern for GeoServer.
