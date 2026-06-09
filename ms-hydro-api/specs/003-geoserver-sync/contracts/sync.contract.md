# Contract: Sync Endpoint

**Feature**: `003-geoserver-sync` | **Date**: 2026-03-24

## POST /sync/geoserver

Triggers a manual sync of geographic reference data from the GeoServer database into hydro-api.

### Request

No request body required.

### Response (201 Created)

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

### Response on re-sync (201 Created)

```json
{
  "basinsCreated": 0,
  "basinsUpdated": 11,
  "subBasinsCreated": 0,
  "subBasinsUpdated": 119,
  "stationsCreated": 0,
  "stationsUpdated": 254,
  "errors": []
}
```

### Error Response (500)

```json
{
  "StatusCode": 500,
  "ErrorCode": "TR999",
  "ErrorDescription": "GeoServer database is unreachable"
}
```

---

## Modified Responses: GET /stations

New fields added to all station response DTOs:

```json
{
  "id": "uuid",
  "name": "TRASVASE ENTREPEÑAS-BUENDÍA",
  "stationCode": "AC01",
  "stationType": "AFOROS_EN_CANAL",
  "subBasinName": "ENTREPEÑAS",
  "subBasinId": "uuid",
  "umbral": null,
  "latitude": 40.4826,
  "longitude": -1.4572,
  "altitude": null,
  "municipio": "Sacedón",
  "provincia": "Guadalajara",
  "ccaa": "Castilla La Mancha",
  "tipoCod": "AC",
  "description": null,
  "isActive": true,
  "createdAt": "2026-03-24T00:00:00.000Z",
  "updatedAt": "2026-03-24T00:00:00.000Z"
}
```

### StationType enum values (new)

```
AFORO_EN_RIO | AFOROS_EN_CANAL | EMBALSE_SAIH | PLUVIOMETRO | TELENIVOMETRO | IMPULSION | MARCO_DE_CONTROL
```

---

## Modified Responses: GET /sub-basins

New fields added to all sub-basin response DTOs:

```json
{
  "id": "uuid",
  "name": "ENTREPEÑAS",
  "code": "E_01",
  "basinId": "uuid",
  "description": null,
  "area": 1234.56,
  "perimetro": 234.78,
  "centroidX": -2.345,
  "centroidY": 40.123,
  "isActive": true,
  "createdAt": "2026-03-24T00:00:00.000Z",
  "updatedAt": "2026-03-24T00:00:00.000Z"
}
```
