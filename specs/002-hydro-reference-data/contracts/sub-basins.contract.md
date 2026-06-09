# API Contract: SubBasins

**Base Path**: `/sub-basins`

---

## POST /sub-basins — Create SubBasin

**Request**:
```json
{
    "name": "Arroyo de la Vega",
    "code": "AVG",
    "basinId": "uuid",
    "description": "Sub-basin in the Tajo watershed"  // optional
}
```

**Validation**:
- `name`: required, string, non-empty, max 100 chars
- `code`: required, string, non-empty, max 20 chars, alphanumeric + hyphens
- `basinId`: required, valid UUID
- `description`: optional, string, max 255 chars

**Response 201**:
```json
{
    "id": "uuid",
    "name": "Arroyo de la Vega",
    "code": "AVG",
    "basinId": "uuid",
    "description": "Sub-basin in the Tajo watershed",
    "isActive": true,
    "createdAt": "2026-03-12T10:00:00.000Z",
    "updatedAt": "2026-03-12T10:00:00.000Z"
}
```

**Errors**:
- 400: Validation error (missing/invalid fields)
- 404: Basin with given basinId not found
- 409: SubBasin with same code already exists, or same name within the same basin

---

## GET /sub-basins — List SubBasins

**Query Parameters**:
- `page`: number (default 1)
- `limit`: number (default 10)
- `basinId`: UUID (optional filter)
- `isActive`: boolean (optional filter)

**Response 200**:
```json
{
    "items": [
        {
            "id": "uuid",
            "name": "Arroyo de la Vega",
            "code": "AVG",
            "basinId": "uuid",
            "description": "...",
            "isActive": true,
            "createdAt": "...",
            "updatedAt": "..."
        }
    ],
    "total": 12,
    "page": 1,
    "limit": 10
}
```

---

## GET /sub-basins/:id — Get SubBasin by ID

**Response 200**:
```json
{
    "id": "uuid",
    "name": "Arroyo de la Vega",
    "code": "AVG",
    "basinId": "uuid",
    "description": "...",
    "isActive": true,
    "createdAt": "...",
    "updatedAt": "...",
    "stations": [
        {
            "id": "uuid",
            "name": "Estación Arroyo",
            "subBasinName": "Arroyo de la Vega",
            "stationCode": "EST-AVG-01",
            "stationType": "HYDROLOGICAL",
            "umbral": 150.5,
            "isActive": true
        }
    ]
}
```

**Errors**:
- 404: SubBasin not found

---

## PUT /sub-basins/:id — Update SubBasin

**Request**:
```json
{
    "name": "Arroyo de la Vega Updated",
    "code": "AVG",
    "basinId": "uuid",
    "description": "Updated description"
}
```

**Response 200**: Updated sub-basin object (same shape as Create response)

**Errors**:
- 400: Validation error
- 404: SubBasin not found, or basinId references non-existent basin
- 409: Code or name+basinId conflict

---

## PATCH /sub-basins/:id/toggle — Toggle SubBasin Active Status

**Request**: No body required

**Response 200**:
```json
{
    "id": "uuid",
    "name": "Arroyo de la Vega",
    "code": "AVG",
    "isActive": false,
    "updatedAt": "..."
}
```

**Errors**:
- 404: SubBasin not found

---

## DELETE /sub-basins/:id — Soft Delete SubBasin

**Response 200**: SubBasin object with `isActive: false`

**Errors**:
- 404: SubBasin not found

**Behavior**: Sets `isActive = false`. Idempotent. Child stations remain unchanged.
