# Quickstart: GeoServer Data Sync

**Feature**: `003-geoserver-sync` | **Date**: 2026-03-24

## What This Feature Does

Adds a manual sync endpoint (`POST /sync/geoserver`) that imports geographic reference data from the GeoServer PostGIS database into hydro-api's own tables. After sync:

- 11 **basins** are created from the SAIH network zones
- 119 **sub-basins** are populated with area, perimeter, and centroid data
- 254 **stations** are enriched with municipality, province, autonomous community, and precise station type classification

## Quick Setup

### 1. Environment Variables

Add to `.env`:

```bash
GEOSERVER_DB_HOST=infra-db-geoserver   # Docker: infra-db-geoserver, Local: 127.0.0.1
GEOSERVER_DB_PORT=5432                  # Docker: 5432 (internal), Local: 5436 (mapped)
GEOSERVER_DB_USERNAME=postgres
GEOSERVER_DB_PASSWORD=secret
GEOSERVER_DB_DATABASE=geoserver
```

### 2. Run Migration

```bash
npm run migration:run
```

This will:
- Replace the station type enum (3 → 7 values)
- Drop the UNIQUE constraint on `stations.subBasinName`
- Add new columns to `stations` and `sub_basins`

### 3. Trigger Sync

```bash
curl -X POST http://localhost:3006/sync/geoserver
```

Expected first-run response:
```json
{
  "basinsCreated": 11,
  "basinsUpdated": 0,
  "subBasinsCreated": 119,
  "subBasinsUpdated": 0,
  "stationsCreated": 254,
  "stationsUpdated": 0,
  "errors": []
}
```

### 4. Verify

```bash
# Check basins
curl http://localhost:3006/basins

# Check stations with enriched data
curl http://localhost:3006/stations

# Check sub-basins with area/perimeter
curl http://localhost:3006/sub-basins
```

## Key Concepts

| Concept | Description |
|---------|-------------|
| **Zona → Basin** | GeoServer's 11 zone values (CABECERA, MADRID, etc.) become basins |
| **Subcuenca → SubBasin** | GeoServer's 119 subcuencas map 1:1 to sub_basins by code |
| **Punto SAIH → Station** | GeoServer's 254 stations map 1:1 to stations by stationCode (codigo) |
| **Spatial Join** | `ST_Contains(subcuenca.geom, station.geom)` determines which sub-basin a station belongs to |
| **Umbral Preservation** | Sync never overwrites existing alert thresholds |
| **Idempotent** | Running sync multiple times is safe — creates on first run, updates on subsequent runs |

## New Station Types

| Code | Type | Description |
|------|------|-------------|
| AR | AFORO_EN_RIO | River gauging |
| AC | AFOROS_EN_CANAL | Canal gauging |
| E | EMBALSE_SAIH | Reservoir |
| P | PLUVIOMETRO | Rain gauge |
| N | TELENIVOMETRO | Snow gauge |
| IM | IMPULSION | Pumping station |
| MC | MARCO_DE_CONTROL | Control point |
