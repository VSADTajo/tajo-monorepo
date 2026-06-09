# Feature Specification: Hydrological Reference Data Layer

**Feature Branch**: `002-hydro-reference-data`
**Created**: 2026-03-12
**Status**: Draft
**Input**: User description: "Hydrological Reference Data Layer for ms-hydro-api — Basin, SubBasin, and Station master data management with threshold (umbral) support for the Hydro Platform"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Station Threshold Lookup for Predictions (Priority: P1)

The predictions microservice needs to retrieve station threshold (umbral) values in real-time to determine whether prediction values exceed alert thresholds and generate notifications. An operator or the predictions system queries a station by its ID or sub-basin name and receives the station details including the umbral value.

**Why this priority**: This is the critical integration point — ms-predictions-api already calls `GET /stations/:stationId` and depends on receiving the `umbral` field. Without this, the entire notification pipeline is broken. This is the reason ms-hydro-api exists in the platform.

**Independent Test**: Can be fully tested by creating a station with an umbral value via POST, then retrieving it via GET /stations/:id and GET /stations/by-sub-basin-name/:subBasinName, verifying the umbral field is present in the response.

**Acceptance Scenarios**:

1. **Given** a station exists with umbral value 150.5, **When** GET /stations/:id is called, **Then** the response includes `"umbral": 150.5` along with all station details
2. **Given** a station exists with sub-basin name "Arroyo de la Vega", **When** GET /stations/by-sub-basin-name/Arroyo%20de%20la%20Vega is called, **Then** the response includes the station details with its umbral value
3. **Given** a station exists with no umbral configured, **When** GET /stations/:id is called, **Then** the response includes `"umbral": null`
4. **Given** no station exists with the given ID, **When** GET /stations/:id is called, **Then** the system returns a 404 error
5. **Given** a station exists, **When** PUT /stations/:id/threshold is called with `{ "umbral": 200.0 }`, **Then** the umbral value is updated and subsequent GET requests reflect the new value
6. **Given** a station exists, **When** GET /stations/:id/threshold is called, **Then** only the umbral value is returned (lightweight response for cache misses)

---

### User Story 2 - Station Management (Priority: P2)

A platform administrator needs to manage hydrological monitoring stations — create new stations, update their information (name, location, type, threshold), activate/deactivate them, and list/filter stations by various criteria. Each station belongs to a sub-basin and has a type classification.

**Why this priority**: Stations are the core entity that predictions-api references. Without station CRUD, no data can be populated for the threshold lookup (US1) to work with real data.

**Independent Test**: Can be fully tested by performing full CRUD lifecycle on stations — create, list with filters, update, toggle active status, and verify all operations via GET.

**Acceptance Scenarios**:

1. **Given** a valid sub-basin exists, **When** POST /stations is called with station details (name, subBasinName, stationCode, stationType, subBasinId), **Then** a new station is created and returned with a generated UUID
2. **Given** stations exist with different types, **When** GET /stations is called with filter `stationType=HYDROLOGICAL`, **Then** only hydrological stations are returned
3. **Given** stations exist across sub-basins, **When** GET /stations is called with filter `subBasinId=<uuid>`, **Then** only stations in that sub-basin are returned
4. **Given** a station exists, **When** PUT /stations/:id is called with updated fields, **Then** the station is updated and the response reflects the changes
5. **Given** an active station, **When** PATCH /stations/:id/toggle is called, **Then** the station becomes inactive and vice versa
6. **Given** stations exist, **When** GET /stations is called with pagination parameters, **Then** results are paginated correctly with total count
7. **Given** a station with duplicate subBasinName is submitted, **When** POST /stations is called, **Then** the system returns a 409 conflict error
8. **Given** a station with duplicate stationCode is submitted, **When** POST /stations is called, **Then** the system returns a 409 conflict error

---

### User Story 3 - Basin Management (Priority: P3)

A platform administrator needs to manage hydrological basins (cuencas) — the top-level geographic unit in the hierarchy. They can create basins, update them, list them, and activate/deactivate them. Viewing a basin shows its associated sub-basins.

**Why this priority**: Basins are the root of the geographic hierarchy. While not directly consumed by predictions-api, they provide the organizational structure for sub-basins and stations.

**Independent Test**: Can be fully tested by performing full CRUD lifecycle on basins — create, list, get by ID (with sub-basins included), update, toggle active status.

**Acceptance Scenarios**:

1. **Given** no basins exist, **When** POST /basins is called with `{ "name": "Cuenca del Tajo", "code": "TAJO" }`, **Then** a new basin is created with a generated UUID and isActive defaults to true
2. **Given** basins exist, **When** GET /basins is called, **Then** all basins are returned with pagination
3. **Given** a basin with sub-basins exists, **When** GET /basins/:id is called, **Then** the basin is returned with its associated sub-basins
4. **Given** a basin exists, **When** PUT /basins/:id is called with updated name, **Then** the basin is updated
5. **Given** an active basin, **When** PATCH /basins/:id/toggle is called, **Then** the basin becomes inactive
6. **Given** a basin with duplicate name is submitted, **When** POST /basins is called, **Then** the system returns a 409 conflict error
7. **Given** a basin with duplicate code is submitted, **When** POST /basins is called, **Then** the system returns a 409 conflict error
8. **Given** basins exist with mixed active status, **When** GET /basins?isActive=true is called, **Then** only active basins are returned

---

### User Story 4 - SubBasin Management (Priority: P4)

A platform administrator needs to manage sub-basins (sub-cuencas) within basins. Sub-basins link basins to stations and represent the mid-level geographic unit. They can create sub-basins under a specific basin, update them, list/filter them, and activate/deactivate them.

**Why this priority**: Sub-basins connect basins to stations. They are needed for the full geographic hierarchy but are not directly consumed by external services.

**Independent Test**: Can be fully tested by creating a basin first, then performing full CRUD lifecycle on sub-basins — create under a basin, list with filters, get by ID (with stations included), update, toggle.

**Acceptance Scenarios**:

1. **Given** a basin exists, **When** POST /sub-basins is called with `{ "name": "Arroyo de la Vega", "code": "AVG", "basinId": "<uuid>" }`, **Then** a new sub-basin is created linked to that basin
2. **Given** sub-basins exist, **When** GET /sub-basins?basinId=<uuid> is called, **Then** only sub-basins for that basin are returned
3. **Given** a sub-basin with stations exists, **When** GET /sub-basins/:id is called, **Then** the sub-basin is returned with its associated stations
4. **Given** a sub-basin exists, **When** PUT /sub-basins/:id is called with updated fields, **Then** the sub-basin is updated
5. **Given** an active sub-basin, **When** PATCH /sub-basins/:id/toggle is called, **Then** the sub-basin becomes inactive
6. **Given** an invalid basinId is provided, **When** POST /sub-basins is called, **Then** the system returns a 404 error indicating the basin was not found
7. **Given** a sub-basin with duplicate code is submitted, **When** POST /sub-basins is called, **Then** the system returns a 409 conflict error

---

### User Story 5 - Station Soft Delete (Priority: P5)

A platform administrator needs to remove stations (and basins/sub-basins) that are no longer in use. Deletion should be a soft delete (deactivate) to preserve historical reference integrity, since predictions-api may have historical predictions referencing these station IDs.

**Why this priority**: Lower priority since toggle already provides activate/deactivate. Soft delete via the DELETE endpoint provides a more conventional REST interface for the same operation.

**Independent Test**: Can be fully tested by creating an entity, calling DELETE, and verifying it becomes inactive rather than being physically removed.

**Acceptance Scenarios**:

1. **Given** an active station exists, **When** DELETE /stations/:id is called, **Then** the station is deactivated (isActive = false) but remains in the database
2. **Given** an active basin with sub-basins exists, **When** DELETE /basins/:id is called, **Then** the basin is deactivated but its sub-basins remain unchanged
3. **Given** an active sub-basin with stations exists, **When** DELETE /sub-basins/:id is called, **Then** the sub-basin is deactivated but its stations remain unchanged
4. **Given** an already inactive entity exists, **When** DELETE is called on it, **Then** the system returns the entity unchanged (idempotent operation)

---

### Edge Cases

- What happens when a station's sub-basin is inactive? The station remains accessible — active status is independent per entity.
- What happens when GET /stations/by-sub-basin-name/:subBasinName receives a name that doesn't match any station? Returns 404.
- What happens when updating a station's subBasinId to point to a non-existent sub-basin? Returns 404 error for the sub-basin.
- What happens when the umbral value is set to 0? It is stored as 0 (valid threshold), distinct from null (no threshold configured).
- What happens when pagination parameters are missing? System uses default values (page 1, 10 items per page).
- What happens when filtering by multiple criteria simultaneously (e.g., subBasinId + stationType + isActive)? All filters are applied with AND logic.
- What happens when a station's subBasinName is updated to a value that already exists on another station? Returns 409 conflict.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a `GET /stations/:id` endpoint that returns station details including the `umbral` field (number or null)
- **FR-002**: System MUST provide a `GET /stations/by-sub-basin-name/:subBasinName` endpoint for alternative station lookup by sub-basin name
- **FR-003**: System MUST provide dedicated threshold endpoints (`GET /stations/:id/threshold` and `PUT /stations/:id/threshold`) for lightweight umbral management
- **FR-004**: System MUST enforce uniqueness on Station.subBasinName and Station.stationCode
- **FR-005**: System MUST enforce uniqueness on Basin.name and Basin.code
- **FR-006**: System MUST enforce uniqueness on SubBasin.code (globally) and SubBasin.name (within a basin)
- **FR-007**: System MUST support pagination on all list endpoints (GET /basins, GET /sub-basins, GET /stations)
- **FR-008**: System MUST support filtering stations by subBasinId, stationType, and isActive
- **FR-009**: System MUST support filtering sub-basins by basinId and isActive
- **FR-010**: System MUST support filtering basins by isActive
- **FR-011**: System MUST validate that a referenced basinId exists when creating/updating a sub-basin
- **FR-012**: System MUST validate that a referenced subBasinId exists when creating/updating a station
- **FR-013**: System MUST support station types: HYDROLOGICAL, METEOROLOGICAL, PLUVIOMETRIC
- **FR-014**: System MUST implement soft delete (deactivation) for all entities via DELETE endpoints
- **FR-015**: System MUST implement toggle (activate/deactivate) via PATCH /:id/toggle for all entities
- **FR-016**: System MUST return related sub-basins when fetching a basin by ID (GET /basins/:id)
- **FR-017**: System MUST return related stations when fetching a sub-basin by ID (GET /sub-basins/:id)
- **FR-018**: System MUST support geographic coordinates (latitude, longitude, altitude) as optional fields on stations
- **FR-019**: System MUST default isActive to true for all newly created entities
- **FR-020**: System MUST return appropriate error responses (400 for validation, 404 for not found, 409 for conflicts)

### Key Entities

- **Basin (Cuenca)**: Represents a major hydrological basin/watershed. Key attributes: unique name, unique short code, optional description, active status. Relationship: contains many sub-basins.
- **SubBasin (SubCuenca)**: Represents a sub-basin within a larger basin. Key attributes: name (unique within its basin), unique short code, optional description, active status. Relationships: belongs to one basin, contains many stations.
- **Station (Estación)**: Represents a hydrological monitoring station. Key attributes: name, unique sub-basin name identifier (used as external reference by predictions service), unique station code, alert threshold (umbral — nullable numeric value), station type classification, optional geographic coordinates (latitude, longitude, altitude), optional description, active status. Relationships: belongs to one sub-basin.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The predictions service can successfully retrieve station threshold values via the station detail endpoint, enabling the full notification pipeline
- **SC-002**: Administrators can perform full lifecycle management (create, read, update, toggle, soft-delete) on all three entity types within a single session
- **SC-003**: All list endpoints return paginated results with correct total counts, supporting at least 1000 entities without degradation
- **SC-004**: Station lookup by sub-basin name returns the correct station on the first attempt for 100% of unique sub-basin names in the system
- **SC-005**: The system correctly rejects duplicate entries (name, code, subBasinName) with clear conflict error messages
- **SC-006**: Threshold updates are immediately reflected in subsequent station detail queries with no stale data
- **SC-007**: All endpoints return responses in under 2 seconds under normal load
- **SC-008**: The geographic hierarchy (Basin → SubBasin → Station) is navigable — fetching a basin shows its sub-basins, fetching a sub-basin shows its stations

### Assumptions

- Station types are fixed to the three defined values (HYDROLOGICAL, METEOROLOGICAL, PLUVIOMETRIC) and do not need to be dynamically configurable.
- Pagination defaults to page 1 with 10 items per page when not specified.
- Soft delete means setting `isActive = false` — no physical deletion occurs.
- The `umbral` field accepts any numeric value (positive, negative, or zero). Null means no threshold is configured.
- Sub-basin name uniqueness is enforced globally (not just within a basin) since it serves as the external identifier used by predictions-api.
- Geographic coordinates are optional and not validated for range (latitude/longitude bounds) — they are informational only.
- The DELETE endpoints are idempotent — deleting an already-inactive entity returns success without error.
