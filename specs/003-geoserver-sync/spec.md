# Feature Specification: GeoServer Data Sync

**Feature Branch**: `003-geoserver-sync`
**Created**: 2026-03-24
**Status**: Draft
**Input**: User description: "Add a read-only secondary connection to the GeoServer PostGIS database and implement a manual sync endpoint that reads geographic reference data (stations, sub-basins, zones) and upserts it into hydro-api's existing tables, enriching them with geographic context."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Sync Geographic Reference Data (Priority: P1)

An administrator triggers a manual sync to import the 254 stations, 119 sub-basins, and 11 zones from the GeoServer geographic database into hydro-api. The system reads the reference data, creates or updates basins (from zones), sub-basins, and stations, and returns a summary of what was created or updated. Existing operational data (such as alert thresholds) is preserved.

**Why this priority**: Without the sync, hydro-api has empty or manually-entered reference data. The sync populates the entire hierarchy (basins, sub-basins, stations) from the authoritative geographic source in one operation, making all other features functional.

**Independent Test**: Can be tested by calling the sync endpoint against a GeoServer database with known data and verifying the correct number of records appear in hydro-api's own database.

**Acceptance Scenarios**:

1. **Given** the GeoServer database contains 254 stations, 119 sub-basins, and 11 zones, **When** an administrator calls the sync endpoint, **Then** hydro-api creates 11 basins, 119 sub-basins, and 254 stations, and returns a summary with the counts of records created.
2. **Given** a previous sync has already been run and a station has an alert threshold (umbral) set, **When** the administrator runs the sync again, **Then** the station's geographic fields are updated but the existing alert threshold is preserved.
3. **Given** a previous sync has been run, **When** the administrator runs the sync again with unchanged GeoServer data, **Then** all records are updated (idempotent) and the summary shows updated counts with zero created.

---

### User Story 2 - View Enriched Station Data (Priority: P2)

After a sync, users querying stations through the existing API see enriched data including municipality, province, autonomous community, and station type code alongside the existing fields. This allows downstream consumers (frontends, prediction engines) to display and filter stations by geographic attributes.

**Why this priority**: The enriched data adds immediate value to all existing station consumers without requiring any changes to their integration — the new fields appear alongside existing ones.

**Independent Test**: After running a sync, call the existing list/get stations endpoints and verify the new geographic fields (municipio, provincia, ccaa, tipoCod) are populated in responses.

**Acceptance Scenarios**:

1. **Given** a sync has been completed, **When** a user lists stations, **Then** each station includes municipio, provincia, ccaa, and tipoCod fields.
2. **Given** a sync has been completed, **When** a user retrieves a single station by ID, **Then** the response includes all geographic fields populated from GeoServer data.

---

### User Story 3 - Updated Station Classification (Priority: P2)

The station type classification is expanded from 3 generic types to 7 specific types that match the official SAIH network classification. This allows users and systems to filter and categorize stations with precise, domain-standard terminology.

**Why this priority**: The current 3-type classification (HYDROLOGICAL, METEOROLOGICAL, PLUVIOMETRIC) loses information. The 7 real types match the authoritative classification and enable accurate filtering.

**Independent Test**: After sync, verify that station types use the new 7-value classification and that filtering by station type works correctly.

**Acceptance Scenarios**:

1. **Given** the station types have been expanded, **When** a user filters stations by type EMBALSE_SAIH, **Then** only reservoir stations are returned.
2. **Given** a station in GeoServer is classified as "AFORO EN RIO" with tipo_cod "AR", **When** sync runs, **Then** the station is stored with stationType AFORO_EN_RIO.

---

### User Story 4 - View Enriched Sub-Basin Data (Priority: P3)

After a sync, sub-basins include geographic metrics (area, perimeter, centroid coordinates) from the GeoServer reference data, enabling spatial context for downstream visualization and analysis.

**Why this priority**: Sub-basin geographic metrics are useful for cartographic display and area-based analysis but are secondary to having the stations correctly mapped.

**Independent Test**: After running a sync, call the existing list/get sub-basins endpoints and verify area, perimeter, and centroid fields are populated.

**Acceptance Scenarios**:

1. **Given** a sync has been completed, **When** a user lists sub-basins, **Then** each sub-basin includes area, perimetro, centroidX, and centroidY fields.

---

### Edge Cases

- What happens when GeoServer database is unreachable during sync? The system returns a clear error indicating the external database is unavailable.
- What happens when a station in GeoServer does not fall within any sub-basin? Based on spatial analysis, all 254 stations fall within sub-basins. If a station were orphaned, it should be reported in the sync errors array but not block the rest of the sync.
- What happens when a sub-basin has no stations within it? The sub-basin is still created/updated — it simply has no stations linked to it.
- What happens when the zona-to-basin mapping encounters an unknown zona value? The system logs a warning, uses the raw zona value slugified as the code, and includes it in sync errors.
- What happens when multiple stations share the same sub-basin? This is expected (254 stations in 119 sub-basins). The subBasinName field is populated but not required to be unique.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST connect to the GeoServer database as a secondary read-only data source.
- **FR-002**: System MUST provide a manual sync endpoint that reads geographic reference data from GeoServer and upserts it into hydro-api's own database.
- **FR-003**: System MUST create or update basins from the distinct zone values found in GeoServer station data (11 zones).
- **FR-004**: System MUST create or update sub-basins from GeoServer's sub-basin table (119 records), linking each to its corresponding basin.
- **FR-005**: System MUST create or update stations from GeoServer's station table (254 records), linking each to its corresponding sub-basin using spatial containment (point-in-polygon).
- **FR-006**: System MUST preserve existing alert thresholds (umbral) when updating stations during sync — never overwrite a non-null umbral.
- **FR-007**: System MUST expand station type classification from 3 generic types to 7 domain-specific types matching the official SAIH network classification (AFORO_EN_RIO, AFOROS_EN_CANAL, EMBALSE_SAIH, PLUVIOMETRO, TELENIVOMETRO, IMPULSION, MARCO_DE_CONTROL).
- **FR-008**: System MUST enrich stations with: municipality (municipio), province (provincia), autonomous community (ccaa), and station type code (tipoCod).
- **FR-009**: System MUST enrich sub-basins with: area, perimeter, centroid X and Y coordinates.
- **FR-010**: System MUST return a sync summary with counts of records created and updated per entity type, plus any errors encountered.
- **FR-011**: System MUST allow multiple stations to belong to the same sub-basin (remove unique constraint on sub-basin name per station).
- **FR-012**: System MUST determine sub-basin-to-basin mapping by identifying which zone the majority of a sub-basin's stations belong to.
- **FR-013**: System MUST map zone names to valid basin codes by removing diacritics and replacing spaces with hyphens (e.g., "TIÉTAR" → "TIETAR", "TAJO IZQUIERDA" → "TAJO-IZQUIERDA").
- **FR-014**: System MUST be idempotent — running sync multiple times with unchanged source data produces the same result.
- **FR-015**: System MUST invalidate all relevant caches after a successful sync.
- **FR-016**: Existing station and sub-basin API responses MUST include the new fields after sync.
- **FR-017**: System MUST NOT write to or modify the GeoServer database in any way.

### Key Entities

- **Basin**: Represents a hydrographic zone (e.g., Cabecera, Madrid, Henares). Derived from the 11 distinct zone values in GeoServer station data. Key attributes: name, code (slugified from zone name).
- **Sub-Basin**: Represents a sub-catchment area within a basin. Sourced from GeoServer's 119 records. Key attributes: name, code, area, perimeter, centroid coordinates. Belongs to one basin.
- **Station**: Represents a SAIH monitoring point. Sourced from GeoServer's 254 records. Key attributes: station code, name, type (7-value classification), type code, municipality, province, autonomous community, coordinates, alert threshold (operational, not from GeoServer). Belongs to one sub-basin.
- **GeoServer Station (external, read-only)**: Source reference entity. Contains: code, name, type code, type description, zone, municipality, province, autonomous community, coordinates, geometry.
- **GeoServer Sub-Basin (external, read-only)**: Source reference entity. Contains: code, name, area, perimeter, centroid coordinates, geometry (polygon).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A single sync operation imports all 254 stations, 119 sub-basins, and 11 basins within 30 seconds.
- **SC-002**: After sync, 100% of stations have municipality, province, and autonomous community fields populated.
- **SC-003**: After sync, 100% of sub-basins have area, perimeter, and centroid fields populated.
- **SC-004**: After sync, all 254 stations are classified using one of the 7 domain-specific station types.
- **SC-005**: Running sync twice produces identical results (idempotent) — zero errors on re-sync.
- **SC-006**: Existing alert thresholds are preserved with 100% fidelity after re-sync.
- **SC-007**: All existing API endpoints continue to function with enriched response data — zero breaking changes for existing consumers.

## Assumptions

- The GeoServer database schema (`cht_puntos_saih`, `cht_subcuencas`) is stable and will not change without coordination.
- The GeoServer instance has PostGIS extension installed (required for spatial queries).
- The GeoServer database is accessible from the hydro-api service via the Docker internal network.
- The 11 zone values in GeoServer data are exhaustive — no new zones will appear without coordination.
- The spatial containment query correctly maps 100% of stations to sub-basins (verified with current data).
- The 3 original station type enum values have no existing data in production that needs preservation — if they do, they will be mapped to the closest new type during migration.
- Zone-to-basin code mapping uses diacritic removal and space-to-hyphen substitution.
