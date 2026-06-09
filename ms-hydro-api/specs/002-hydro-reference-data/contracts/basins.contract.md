# API Contract: Basins

**Base Path**: `/basins`

---

## POST /basins — Create Basin

**Request**:
```json
{
    "name": "Cuenca del Tajo",
    "code": "TAJO",
    "description": "Main watershed of the Tagus river"  // optional
}
```

**Validation**:
- `name`: required, string, non-empty, max 100 chars
- `code`: required, string, non-empty, max 20 chars, alphanumeric + hyphens
- `description`: optional, string, max 255 chars

**Response 201**:
```json
{
    "id": "uuid",
    "name": "Cuenca del Tajo",
    "code": "TAJO",
    "description": "Main watershed of the Tagus river",
    "isActive": true,
    "createdAt": "2026-03-12T10:00:00.000Z",
    "updatedAt": "2026-03-12T10:00:00.000Z"
}
```

**Errors**:
- 400: Validation error (missing/invalid fields)
- 409: Basin with same name or code already exists

---

## GET /basins — List Basins

**Query Parameters**:
- `page`: number (default 1)
- `limit`: number (default 10)
- `isActive`: boolean (optional filter)

**Response 200**:
```json
{
    "items": [
        {
            "id": "uuid",
            "name": "Cuenca del Tajo",
            "code": "TAJO",
            "description": "...",
            "isActive": true,
            "createdAt": "...",
            "updatedAt": "..."
        }
    ],
    "total": 5,
    "page": 1,
    "limit": 10
}
```

---

## GET /basins/:id — Get Basin by ID

**Response 200**:
```json
{
    "id": "uuid",
    "name": "Cuenca del Tajo",
    "code": "TAJO",
    "description": "...",
    "isActive": true,
    "createdAt": "...",
    "updatedAt": "...",
    "subBasins": [
        {
            "id": "uuid",
            "name": "Arroyo de la Vega",
            "code": "AVG",
            "isActive": true
        }
    ]
}
```

**Errors**:
- 404: Basin not found

---

## PUT /basins/:id — Update Basin

**Request**:
```json
{
    "name": "Cuenca del Tajo Updated",
    "code": "TAJO",
    "description": "Updated description"
}
```

**Response 200**: Updated basin object (same shape as Create response)

**Errors**:
- 400: Validation error
- 404: Basin not found
- 409: Name or code conflict with another basin

---

## PATCH /basins/:id/toggle — Toggle Basin Active Status

**Request**: No body required

**Response 200**:
```json
{
    "id": "uuid",
    "name": "Cuenca del Tajo",
    "code": "TAJO",
    "isActive": false,
    "updatedAt": "..."
}
```

**Errors**:
- 404: Basin not found

---

## DELETE /basins/:id — Soft Delete Basin

**Response 200**: Basin object with `isActive: false`

**Errors**:
- 404: Basin not found

**Behavior**: Sets `isActive = false`. Idempotent — deleting an already-inactive basin returns it unchanged.
