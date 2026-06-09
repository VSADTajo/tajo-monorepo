# Contract Consumed: GeoServer REST API

GeoServer 2.24.2 endpoints used by `ms-meteo-api`. Auth: HTTP Basic (`GEOSERVER_USER` / `GEOSERVER_PASSWORD`).

**Base URL**: `http://vsad-tajo-geoserver:8080/geoserver` (configurable via `GEOSERVER_URL`).
**Workspace**: `tajo` (already exists).

All these are documented at https://docs.geoserver.org/2.24.x/en/user/rest/

---

## 1. Check whether a coverage store exists

`GET /rest/workspaces/tajo/coveragestores/<store>.json`

- `200` → exists.
- `404` → does not exist; we need to bootstrap.

Used by `IGeoserverImageMosaicClient.storeExists()`.

---

## 2. Create an ImageMosaic store + layer (bootstrap)

The first time we encounter a dataset we create:

1. The `coveragestore` of type `ImageMosaic` pointing to `/opt/datasets/meteo/<provider>_<variable>/`.
2. Two property files in that directory **before** creating the store:
   - `indexer.properties`:
     ```properties
     Schema=*the_geom:Polygon,location:String,ingestion:java.util.Date
     TimeAttribute=ingestion
     ElevationAttribute=
     PropertyCollectors=TimestampFileNameExtractorSPI[timeregex](ingestion)
     Caching=false
     ```
   - `timeregex.properties`:
     ```properties
     regex=([0-9]{8}T[0-9]{6}),format=yyyyMMdd'T'HHmmss
     ```
3. The store:
   ```http
   PUT /rest/workspaces/tajo/coveragestores/<store>/external.imagemosaic
   Content-Type: text/plain

   file:///opt/datasets/meteo/<store>/
   ```
4. Enable the time dimension on the resulting coverage:
   ```http
   PUT /rest/workspaces/tajo/coveragestores/<store>/coverages/<store>.json
   Content-Type: application/json

   {
     "coverage": {
       "enabled": true,
       "metadata": {
         "entry": [
           { "@key": "time", "dimensionInfo": { "enabled": true, "presentation": "LIST", "units": "ISO8601", "defaultValue": { "strategy": "MAXIMUM" } } }
         ]
       }
     }
   }
   ```

(`<store>` = the snake-cased dataset name, same as the layer suffix, e.g. `harmonie_precipitacion`.)

Used by `IGeoserverImageMosaicClient.createImageMosaicStore()`.

---

## 3. List existing granules of a layer (idempotency check)

`GET /rest/workspaces/tajo/coveragestores/<store>/coverages/<store>/index/granules.json`

**Response**:
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "id": "harmonie_precipitacion.1",
      "geometry": { "type": "Polygon", "coordinates": [...] },
      "properties": {
        "location": "harmonie_precipitacion_20260406T120000.tif",
        "ingestion": "2026-04-06T12:00:00.000+0000"
      }
    }
  ]
}
```

We extract `properties.ingestion` for each feature → set of timestamps already published. Diff against the expected timestamps from `info.json` → list of files that need processing.

Used by `IGeoserverImageMosaicClient.listGranules()`.

---

## 4. Add a new granule (after gdal_translate writes the file)

```http
POST /rest/workspaces/tajo/coveragestores/<store>/external.imagemosaic
Content-Type: text/plain

file:///opt/datasets/meteo/<store>/<store>_<TIMESTAMP>.tif
```

Where `<TIMESTAMP>` is `yyyyMMdd'T'HHmmss` UTC. The mosaic indexer parses the timestamp from the filename via `timeregex.properties` and creates a granule entry.

Used by `IGeoserverImageMosaicClient.addGranule()`.

---

## 5. Delete granules older than a threshold (retention)

```http
DELETE /rest/workspaces/tajo/coveragestores/<store>/coverages/<store>/index/granules?filter=ingestion < <ISO-8601>
```

Returns the number of deleted features. The corresponding `.tif` files on disk are deleted by the meteo service after the REST call succeeds.

Used by `IGeoserverImageMosaicClient.deleteGranulesOlderThan()`.

---

## Notes / gotchas

- Bootstrap is **idempotent**: we always check existence first and we always re-create the property files (overwrites are safe).
- All endpoints require basic auth on every call. The client wraps `axios` with `auth: { username, password }`.
- All write endpoints can return `5xx` if the file path is unreachable from the GeoServer container — this is why the bind mount layout matters. The plan ensures that `/opt/datasets` inside `ms-meteo-api` is the **same** physical directory as `/opt/datasets` inside the GeoServer container (both bind-mounted to `/opt/geoserver/datasets` on the host).
- We do **not** use the GeoServer DataStore (PostGIS) at all in this iteration.
