# Quickstart: Hydrological Reference Data Layer

**Feature**: 002-hydro-reference-data
**Date**: 2026-03-12

## Prerequisites

- Node.js >= 22 (check with `node -v`, use `nvm use 22`)
- Docker running (for PostgreSQL Testcontainers)
- `npm install` completed

## Quick Verification

```bash
# Build
npm run build

# Lint
npm run lint

# Run e2e tests (requires Docker)
npm run test:e2e
```

## Integration Scenarios

### Scenario 1: Create Geographic Hierarchy and Verify Threshold Lookup

This is the critical end-to-end flow — creating the data that ms-predictions-api depends on.

```bash
# 1. Create a basin
curl -X POST http://localhost:3004/basins \
  -H "Content-Type: application/json" \
  -d '{"name": "Cuenca del Tajo", "code": "TAJO"}'
# → Returns: { "id": "<basin-uuid>", "name": "Cuenca del Tajo", "code": "TAJO", "isActive": true, ... }

# 2. Create a sub-basin under the basin
curl -X POST http://localhost:3004/sub-basins \
  -H "Content-Type: application/json" \
  -d '{"name": "Arroyo de la Vega", "code": "AVG", "basinId": "<basin-uuid>"}'
# → Returns: { "id": "<sub-basin-uuid>", ... }

# 3. Create a station with an umbral threshold
curl -X POST http://localhost:3004/stations \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Estación Arroyo",
    "subBasinName": "Arroyo de la Vega",
    "stationCode": "EST-AVG-01",
    "stationType": "HYDROLOGICAL",
    "subBasinId": "<sub-basin-uuid>",
    "umbral": 150.5,
    "latitude": 40.4168,
    "longitude": -3.7038
  }'
# → Returns: { "id": "<station-uuid>", "umbral": 150.5, ... }

# 4. Verify threshold lookup (this is what ms-predictions-api calls)
curl http://localhost:3004/stations/<station-uuid>
# → Must return: { ..., "umbral": 150.5, ... }

# 5. Alternative lookup by sub-basin name
curl http://localhost:3004/stations/by-sub-basin-name/Arroyo%20de%20la%20Vega
# → Same station with umbral field
```

### Scenario 2: Update Threshold and Verify

```bash
# Update just the threshold
curl -X PUT http://localhost:3004/stations/<station-uuid>/threshold \
  -H "Content-Type: application/json" \
  -d '{"umbral": 200.0}'

# Verify lightweight threshold endpoint
curl http://localhost:3004/stations/<station-uuid>/threshold
# → { "id": "...", "stationCode": "EST-AVG-01", "umbral": 200.0 }
```

### Scenario 3: List with Filters and Pagination

```bash
# List stations filtered by type
curl "http://localhost:3004/stations?stationType=HYDROLOGICAL&page=1&limit=5"

# List sub-basins filtered by basin
curl "http://localhost:3004/sub-basins?basinId=<basin-uuid>"

# List only active basins
curl "http://localhost:3004/basins?isActive=true"
```

### Scenario 4: Toggle and Soft Delete

```bash
# Deactivate a station
curl -X PATCH http://localhost:3004/stations/<station-uuid>/toggle
# → { ..., "isActive": false }

# Reactivate it
curl -X PATCH http://localhost:3004/stations/<station-uuid>/toggle
# → { ..., "isActive": true }

# Soft delete (same as deactivate)
curl -X DELETE http://localhost:3004/stations/<station-uuid>
# → { ..., "isActive": false }
```

## E2E Test Coverage Map

| Endpoint | Test File | Scenarios |
|----------|-----------|-----------|
| POST /basins | create-basin.e2e-spec.ts | Create, duplicate name (409), duplicate code (409), validation errors (400) |
| GET /basins | list-basins.e2e-spec.ts | List all, filter by isActive, pagination |
| GET /basins/:id | get-basin.e2e-spec.ts | Get with sub-basins, not found (404) |
| PUT /basins/:id | update-basin.e2e-spec.ts | Update, not found (404), conflict (409) |
| PATCH /basins/:id/toggle | toggle-basin.e2e-spec.ts | Toggle active→inactive→active, not found (404) |
| POST /sub-basins | create-sub-basin.e2e-spec.ts | Create, invalid basinId (404), duplicate code (409) |
| GET /sub-basins | list-sub-basins.e2e-spec.ts | List all, filter by basinId/isActive, pagination |
| GET /sub-basins/:id | get-sub-basin.e2e-spec.ts | Get with stations, not found (404) |
| PUT /sub-basins/:id | update-sub-basin.e2e-spec.ts | Update, not found (404), conflict (409) |
| PATCH /sub-basins/:id/toggle | toggle-sub-basin.e2e-spec.ts | Toggle, not found (404) |
| POST /stations | create-station.e2e-spec.ts | Create, invalid subBasinId (404), duplicate subBasinName (409), duplicate stationCode (409), all station types |
| GET /stations | list-stations.e2e-spec.ts | List all, filter by subBasinId/stationType/isActive, pagination |
| GET /stations/:id | get-station.e2e-spec.ts | Get with umbral, null umbral, not found (404) — **critical for predictions-api** |
| GET /stations/by-sub-basin-name/:name | get-station-by-sub-basin-name.e2e-spec.ts | Lookup by name, not found (404) |
| PUT /stations/:id | update-station.e2e-spec.ts | Update all fields, not found (404), conflict (409) |
| PATCH /stations/:id/toggle | toggle-station.e2e-spec.ts | Toggle, not found (404) |
| PUT /stations/:id/threshold | update-threshold.e2e-spec.ts | Update umbral, clear umbral (null), not found (404) |
| DELETE /stations/:id | delete-station.e2e-spec.ts | Soft delete, already inactive (idempotent), not found (404) |
