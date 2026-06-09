# Quickstart — ms-meteo-api (local development)

This document describes how to run the new `ms-meteo-api` service locally and exercise it manually.

## Prerequisites

- Docker + Docker Compose
- Node.js >= 22 (only if running the service outside Docker)
- The `infra` repo already running (`infra-network` exists, `ms-sftp-api` and `vsad-tajo-geoserver` reachable on that network)

## 1. Bring up the dependencies

From the `infra/` directory:

```bash
docker compose up -d                       # postgres user/sftp/geoserver, redis, rabbitmq
docker compose -f docker-compose.yml -f docker-compose.apps.yml up -d ms-sftp-api vsad-tajo-geoserver
```

(Once the Phase 2 changes land, `ms-meteo-api` will also be in `docker-compose.apps.yml` and these can be replaced by a single command.)

## 2. Run the service

From `ms-meteo-api/`:

```bash
cp .env.example .env                       # adjust if needed
docker compose up -d                       # uses ./docker-compose.yml
docker compose logs -f app
```

The service starts on `http://localhost:3010`.

## 3. Health check

```bash
curl -s http://localhost:3010/health | jq .
```

Should return `{ "status": "ok" }`.

## 4. List available datasets

```bash
curl -s -H 'x-internal-caller: ms-gateway-api' http://localhost:3010/meteo/info | jq .
```

You should see one entry per `(provider, variable)` currently in the SFTP storage. If you have not run a sync yet, `lastRun` will be `null` for all entries.

## 5. Trigger a manual sync of one dataset

```bash
curl -s -X POST -H 'x-internal-caller: ms-gateway-api' \
  http://localhost:3010/meteo/radar/_/sync | jq .
```

This will:

1. Fetch `tajo/METEO/RADAR/info.json` from `ms-sftp-api`.
2. List the 48 raster files.
3. Query GeoServer for already-published granules of `tajo:radar_precipitacion`.
4. Download, convert and publish only the missing files.

The first run will also bootstrap the ImageMosaic store and layer.

## 6. Verify in GeoServer

Open `http://localhost:8085/geoserver/web/` (admin / geoserver) → Data → Layers → `tajo:radar_precipitacion`. Use Layer Preview → OpenLayers and notice the time slider at the bottom.

Or via WMS:

```bash
open "http://localhost:8085/geoserver/tajo/wms?service=WMS&version=1.1.0&request=GetMap&layers=tajo:radar_precipitacion&bbox=-7.6,38.7,-1.4,41.4&width=800&height=600&srs=EPSG:4326&format=image/png&TIME=2026-04-05T03:00:00Z"
```

## 7. Trigger a full sync (all datasets)

```bash
curl -s -X POST -H 'x-internal-caller: ms-gateway-api' \
  http://localhost:3010/meteo/sync | jq .
```

The response lists every `(provider, variable)` processed and its status.

## 8. Check audit records

```bash
docker exec -it ms-meteo-api-db psql -U postgres -d ms_meteo \
  -c "SELECT provider, variable, status, files_ok, files_failed, started_at FROM meteo_ingest_run ORDER BY started_at DESC LIMIT 20;"
```

## 9. Run tests

```bash
docker compose run --rm app npm run test:e2e
```

Tests use Testcontainers (real Postgres) and mock the HTTP clients (`ms-sftp-api`, GeoServer REST) and the GDAL adapter, so they require Docker but no real meteo data.

## Troubleshooting

- **GeoServer 500 on `external.imagemosaic`**: most likely the GeoTIFF file path is not visible from inside the GeoServer container. Verify the bind mount alignment described in `contracts/geoserver-rest.md` (notes section).
- **`gdal_translate: not found`**: the `gdal-bin` package is missing from the image. Re-run `docker compose build app`.
- **`x-internal-caller header missing`**: when calling sftp-api or meteo-api, the whitelist middleware rejects requests without it. Always add `-H 'x-internal-caller: ms-gateway-api'` (or another whitelisted caller).
- **Cron not firing**: check `METEO_SYNC_CRON` (default `0 */3 * * *`). Lower it temporarily (e.g. `*/2 * * * *`) for local testing.
