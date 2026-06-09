# Contract: GeoServer WMS Layers (External)

**Feature**: 002-precip-aggregation  
**Type**: External contract — consumed by frontend (vsad-tajo-frontend) and other WMS clients

## New WMS Layers

For each existing hourly precipitation layer, two new layers are published.

### Daily Layer (`_diaria`)

| Property | Value |
|----------|-------|
| Layer pattern | `Tajo:{provider}_{variable}_diaria` |
| Example | `Tajo:harmonie_precipitacion_diaria` |
| TIME dimension | Enabled (day-level entries) |
| TIME format | `YYYY-MM-DD` or `YYYY-MM-DDT00:00:00.000Z` |
| Default (no TIME) | Latest available day |

**WMS GetMap example**:
```
GET /geoserver/Tajo/wms?
  SERVICE=WMS&
  VERSION=1.1.1&
  REQUEST=GetMap&
  LAYERS=Tajo:harmonie_precipitacion_diaria&
  TIME=2026-05-06&
  BBOX=-7.5438,38.7845,-1.4508,41.3045&
  WIDTH=768&
  HEIGHT=330&
  SRS=EPSG:4326&
  FORMAT=image/png
```

**WMS GetCapabilities**: The layer will appear in capabilities with available TIME values as a list of dates.

### Total Layer (`_total`)

| Property | Value |
|----------|-------|
| Layer pattern | `Tajo:{provider}_{variable}_total` |
| Example | `Tajo:harmonie_precipitacion_total` |
| TIME dimension | Single entry (forecast start) |
| Default (no TIME) | Only available entry |

**WMS GetMap example**:
```
GET /geoserver/Tajo/wms?
  SERVICE=WMS&
  VERSION=1.1.1&
  REQUEST=GetMap&
  LAYERS=Tajo:harmonie_precipitacion_total&
  BBOX=-7.5438,38.7845,-1.4508,41.3045&
  WIDTH=768&
  HEIGHT=330&
  SRS=EPSG:4326&
  FORMAT=image/png
```

No TIME parameter needed — the total layer always returns the accumulated precipitation for the entire forecast.

## Expected Layer Inventory

After feature deployment, the following layers will exist in GeoServer workspace `Tajo`:

| Existing Layer | New Daily Layer | New Total Layer |
|---------------|----------------|-----------------|
| `harmonie_precipitacion` | `harmonie_precipitacion_diaria` | `harmonie_precipitacion_total` |
| `eps_precipitacion_25` | `eps_precipitacion_25_diaria` | `eps_precipitacion_25_total` |
| `eps_precipitacion_50` | `eps_precipitacion_50_diaria` | `eps_precipitacion_50_total` |
| (any other precip layer) | `{layer}_diaria` | `{layer}_total` |

## Backward Compatibility

- Existing hourly layers are **not modified**. All current WMS queries continue to work unchanged.
- New layers are additive. No breaking changes to existing contracts.
