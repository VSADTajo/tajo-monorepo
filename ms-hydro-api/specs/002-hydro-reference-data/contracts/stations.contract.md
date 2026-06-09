# API Contract: Stations

**Base Path**: `/stations`

---

## POST /stations — Create Station

**Request**:
```json
{
    "name": "Estación Arroyo de la Vega",
    "subBasinName": "Arroyo de la Vega",
    "stationCode": "EST-AVG-01",
    "stationType": "HYDROLOGICAL",
    "subBasinId": "uuid",
    "umbral": 150.5,          // optional
    "latitude": 40.4168,       // optional
    "longitude": -3.7038,      // optional
    "altitude": 650.0,         // optional
    "description": "Main station"  // optional
}
```

**Validation**:
- `name`: required, string, non-empty, max 100 chars
- `subBasinName`: required, string, non-empty, max 100 chars
- `stationCode`: required, string, non-empty, max 50 chars, alphanumeric + hyphens
- `stationType`: required, enum: `HYDROLOGICAL` | `METEOROLOGICAL` | `PLUVIOMETRIC`
- `subBasinId`: required, valid UUID
- `umbral`: optional, number (any numeric value including 0, negative)
- `latitude`: optional, number
- `longitude`: optional, number
- `altitude`: optional, number
- `description`: optional, string, max 255 chars

**Response 201**:
```json
{
    "id": "uuid",
    "name": "Estación Arroyo de la Vega",
    "subBasinName": "Arroyo de la Vega",
    "stationCode": "EST-AVG-01",
    "stationType": "HYDROLOGICAL",
    "subBasinId": "uuid",
    "umbral": 150.5,
    "latitude": 40.4168,
    "longitude": -3.7038,
    "altitude": 650.0,
    "description": "Main station",
    "isActive": true,
    "createdAt": "2026-03-12T10:00:00.000Z",
    "updatedAt": "2026-03-12T10:00:00.000Z"
}
```

**Errors**:
- 400: Validation error
- 404: SubBasin with given subBasinId not found
- 409: Station with same subBasinName or stationCode already exists

---

## GET /stations — List Stations

**Query Parameters**:
- `page`: number (default 1)
- `limit`: number (default 10)
- `subBasinId`: UUID (optional filter)
- `stationType`: enum (optional filter)
- `isActive`: boolean (optional filter)

**Response 200**:
```json
{
    "items": [
        {
            "id": "uuid",
            "name": "Estación Arroyo de la Vega",
            "subBasinName": "Arroyo de la Vega",
            "stationCode": "EST-AVG-01",
            "stationType": "HYDROLOGICAL",
            "subBasinId": "uuid",
            "umbral": 150.5,
            "latitude": 40.4168,
            "longitude": -3.7038,
            "altitude": 650.0,
            "description": "...",
            "isActive": true,
            "createdAt": "...",
            "updatedAt": "..."
        }
    ],
    "total": 42,
    "page": 1,
    "limit": 10
}
```

---

## GET /stations/:id — Get Station by ID (CRITICAL — consumed by ms-predictions-api)

**Response 200**:
```json
{
    "id": "uuid",
    "name": "Estación Arroyo de la Vega",
    "subBasinName": "Arroyo de la Vega",
    "stationCode": "EST-AVG-01",
    "stationType": "HYDROLOGICAL",
    "subBasinId": "uuid",
    "umbral": 150.5,
    "latitude": 40.4168,
    "longitude": -3.7038,
    "altitude": 650.0,
    "description": "...",
    "isActive": true,
    "createdAt": "...",
    "updatedAt": "..."
}
```

**CRITICAL**: The `umbral` field MUST be present in the response. ms-predictions-api's StationThresholdService extracts `data.umbral as number | null` from this response.

**Errors**:
- 404: Station not found

---

## GET /stations/by-sub-basin-name/:subBasinName — Get Station by SubBasin Name

**Response 200**: Same shape as GET /stations/:id

**Errors**:
- 404: No station found with given subBasinName

**Usage**: Alternative lookup used by ms-predictions-api when it has the locationId (which maps to subBasinName) instead of the station UUID.

---

## PUT /stations/:id — Update Station

**Request**:
```json
{
    "name": "Estación Arroyo Updated",
    "subBasinName": "Arroyo de la Vega",
    "stationCode": "EST-AVG-01",
    "stationType": "HYDROLOGICAL",
    "subBasinId": "uuid",
    "umbral": 200.0,
    "latitude": 40.4168,
    "longitude": -3.7038,
    "altitude": 650.0,
    "description": "Updated description"
}
```

**Response 200**: Updated station object

**Errors**:
- 400: Validation error
- 404: Station not found, or subBasinId references non-existent sub-basin
- 409: subBasinName or stationCode conflict with another station

---

## PATCH /stations/:id/toggle — Toggle Station Active Status

**Request**: No body required

**Response 200**:
```json
{
    "id": "uuid",
    "name": "Estación Arroyo de la Vega",
    "stationCode": "EST-AVG-01",
    "isActive": false,
    "updatedAt": "..."
}
```

**Errors**:
- 404: Station not found

---

## DELETE /stations/:id — Soft Delete Station

**Response 200**: Station object with `isActive: false`

**Errors**:
- 404: Station not found

**Behavior**: Sets `isActive = false`. Idempotent.

---

## PUT /stations/:id/threshold — Update Station Threshold

**Request**:
```json
{
    "umbral": 200.0
}
```

**Validation**:
- `umbral`: required, number (any numeric value). Use `null` to clear the threshold.

**Response 200**:
```json
{
    "id": "uuid",
    "name": "Estación Arroyo de la Vega",
    "stationCode": "EST-AVG-01",
    "umbral": 200.0,
    "updatedAt": "..."
}
```

**Errors**:
- 400: Validation error (umbral not a number)
- 404: Station not found

---

## GET /stations/:id/threshold — Get Station Threshold

**Response 200**:
```json
{
    "id": "uuid",
    "stationCode": "EST-AVG-01",
    "umbral": 150.5
}
```

**Errors**:
- 404: Station not found

**Usage**: Lightweight endpoint for ms-predictions-api cache misses. Returns only the threshold-relevant fields.
