# Quickstart: Precipitation Aggregation Layers

**Feature**: 002-precip-aggregation

## Prerequisites

- ms-meteo-api running (locally or Docker)
- GeoServer running and accessible
- At least one hourly sync completed (hourly GeoTIFFs exist in `METEO_GEOTIFF_DIR`)
- No additional environment variables needed (reuses existing config)

## Verify Existing Hourly Data

```bash
# Check hourly GeoTIFFs on disk
ls /opt/datasets/meteo/harmonie_precipitacion/

# Expected: files like harmonie_precipitacion_20260506000000.tif, ...010000.tif, etc.
```

## Trigger Sync (includes aggregation)

```bash
# Manual trigger — aggregation runs automatically after hourly sync
curl -X POST http://localhost:3010/meteo/sync

# Response includes aggregation summary
# {
#   "triggeredBy": "manual",
#   "datasets": [...],
#   "aggregation": {
#     "datasetsProcessed": 1,
#     "dailyLayersUpdated": 2,
#     "totalLayersUpdated": 1,
#     "errors": []
#   }
# }
```

## Verify New Layers in GeoServer

### Check daily layer exists
```bash
curl -u admin:geoserver \
  "http://vsad-tajo-geoserver:8080/geoserver/rest/workspaces/tajo/coveragestores/harmonie_precipitacion_diaria.json"
```

### Check total layer exists
```bash
curl -u admin:geoserver \
  "http://vsad-tajo-geoserver:8080/geoserver/rest/workspaces/tajo/coveragestores/harmonie_precipitacion_total.json"
```

## Query New Layers via WMS

### Daily precipitation for a specific date
```
http://localhost:8085/geoserver/Tajo/wms?
  SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&
  LAYERS=Tajo:harmonie_precipitacion_diaria&
  TIME=2026-05-06&
  BBOX=-7.5438,38.7845,-1.4508,41.3045&
  WIDTH=768&HEIGHT=330&SRS=EPSG:4326&FORMAT=image/png
```

### Total accumulated precipitation
```
http://localhost:8085/geoserver/Tajo/wms?
  SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&
  LAYERS=Tajo:harmonie_precipitacion_total&
  BBOX=-7.5438,38.7845,-1.4508,41.3045&
  WIDTH=768&HEIGHT=330&SRS=EPSG:4326&FORMAT=image/png
```

### Hourly (unchanged, existing)
```
http://localhost:8085/geoserver/Tajo/wms?
  SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&
  LAYERS=Tajo:harmonie_precipitacion&
  TIME=2026-05-06T14:00:00.000Z&
  BBOX=-7.5438,38.7845,-1.4508,41.3045&
  WIDTH=768&HEIGHT=330&SRS=EPSG:4326&FORMAT=image/png
```

## Verify Aggregated Files on Disk

```bash
# Daily GeoTIFFs
ls /opt/datasets/meteo/harmonie_precipitacion_diaria/
# Expected: harmonie_precipitacion_diaria_20260506000000.tif, ...20260507000000.tif

# Total GeoTIFF
ls /opt/datasets/meteo/harmonie_precipitacion_total/
# Expected: harmonie_precipitacion_total_20260506000000.tif (one file)
```

## Development: Run Tests

```bash
npm run test         # Unit tests
npm run test:e2e     # Integration tests (requires Docker)
```
