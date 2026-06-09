# Data Model: GeoServer Data Sync

**Feature**: `003-geoserver-sync` | **Date**: 2026-03-24

## Entity Changes

### Station (MODIFIED)

| Field | Type | Nullable | Change |
|-------|------|----------|--------|
| id | UUID | No | — |
| name | varchar(100) | No | — |
| subBasinName | varchar(100) | No | **DROP UNIQUE constraint** |
| stationCode | varchar(50) | No | — (unique) |
| umbral | double | Yes | — |
| stationType | enum | No | **REPLACE: 3 → 7 values** |
| subBasinId | UUID FK | No | — |
| latitude | double | Yes | — |
| longitude | double | Yes | — |
| altitude | double | Yes | — |
| **municipio** | **varchar(150)** | **Yes** | **NEW** |
| **provincia** | **varchar(100)** | **Yes** | **NEW** |
| **ccaa** | **varchar(100)** | **Yes** | **NEW** |
| **tipoCod** | **varchar(10)** | **Yes** | **NEW** |
| description | varchar(255) | Yes | — |
| isActive | boolean | No | — |

### SubBasin (MODIFIED)

| Field | Type | Nullable | Change |
|-------|------|----------|--------|
| id | UUID | No | — |
| name | varchar(100) | No | — |
| code | varchar(20) | No | — (unique) |
| basinId | UUID FK | No | — |
| description | varchar(255) | Yes | — |
| **area** | **double** | **Yes** | **NEW** |
| **perimetro** | **double** | **Yes** | **NEW** |
| **centroidX** | **double** | **Yes** | **NEW** |
| **centroidY** | **double** | **Yes** | **NEW** |
| isActive | boolean | No | — |

### Basin (UNCHANGED)

No schema changes. Basins are populated from GeoServer's 11 zona values during sync.

### StationType Enum (REPLACED)

| Old Value | New Value | Mapping |
|-----------|-----------|---------|
| HYDROLOGICAL | AFORO_EN_RIO | Default mapping for existing data |
| PLUVIOMETRIC | PLUVIOMETRO | Direct mapping |
| METEOROLOGICAL | TELENIVOMETRO | Closest match |
| — | AFOROS_EN_CANAL | New |
| — | EMBALSE_SAIH | New |
| — | IMPULSION | New |
| — | MARCO_DE_CONTROL | New |

## GeoServer Entities (Read-Only)

These entities map to existing tables in the GeoServer PostGIS database. They are NOT created by migrations — they map to pre-existing tables.

### GeoPuntoSaih → `cht_puntos_saih`

| Field | Type | Column | Notes |
|-------|------|--------|-------|
| ogcFid | integer | ogc_fid | PK |
| codigo | varchar | codigo | Maps to Station.stationCode |
| nombre | varchar | nombre | Maps to Station.name |
| tipoCod | varchar | tipo_cod | e.g., AR, AC, E, P, N, IM, MC |
| tipo | varchar | tipo | Full type name |
| zona | varchar | zona | Maps to Basin (via mapping) |
| municipio | varchar | municipio | Maps to Station.municipio |
| provincia | varchar | provincia | Maps to Station.provincia |
| ccaa | varchar | ccaa | Maps to Station.ccaa |

Latitude/longitude extracted via `ST_Y(geom)` / `ST_X(geom)` in spatial query.

### GeoSubcuenca → `cht_subcuencas`

| Field | Type | Column | Notes |
|-------|------|--------|-------|
| ogcFid | integer | ogc_fid | PK |
| code | varchar | code | Maps to SubBasin.code |
| name | varchar | name | Maps to SubBasin.name |
| area | double | area | Maps to SubBasin.area |
| perimetro | double | perimetro | Maps to SubBasin.perimetro |
| centroidX | double | centroid_x | Maps to SubBasin.centroidX |
| centroidY | double | centroid_y | Maps to SubBasin.centroidY |

## Relationships

```
Basin (11)
  └── has many SubBasin (119)
       └── has many Station (254)

GeoServer (read-only):
  cht_puntos_saih (254) ──spatial join──▶ cht_subcuencas (119)
  cht_puntos_saih.zona ──mapping──▶ Basin.code
```

## Zona → Basin Code Mapping

| GeoServer zona | Basin code | Basin name |
|---|---|---|
| CABECERA | CABECERA | Cabecera |
| MADRID | MADRID | Madrid |
| HENARES | HENARES | Henares |
| TIÉTAR | TIETAR | Tiétar |
| ALBERCHE | ALBERCHE | Alberche |
| TAJO IZQUIERDA | TAJO-IZQUIERDA | Tajo Izquierda |
| ÁRRAGO | ARRAGO | Árrago |
| BAJO TAJO | BAJO-TAJO | Bajo Tajo |
| ALAGÓN | ALAGON | Alagón |
| JARAMA | JARAMA | Jarama |
| TAJUÑA | TAJUNA | Tajuña |

## tipo_cod → StationType Mapping

| tipo_cod | GeoServer tipo | StationType |
|---|---|---|
| AR | AFORO EN RÍO | AFORO_EN_RIO |
| AC | AFOROS EN CANAL | AFOROS_EN_CANAL |
| E | EMBALSE SAIH | EMBALSE_SAIH |
| P | PLUVIÓMETRO/PLUVIONIVÓMETRO | PLUVIOMETRO |
| N | TELENIVÓMETRO | TELENIVOMETRO |
| IM | IMPULSIÓN | IMPULSION |
| MC | MARCO DE CONTROL | MARCO_DE_CONTROL |
