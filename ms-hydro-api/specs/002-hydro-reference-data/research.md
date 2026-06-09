# Research: Hydrological Reference Data Layer

**Feature**: 002-hydro-reference-data
**Date**: 2026-03-12

## Decision 1: Entity Hierarchy Design (Basin → SubBasin → Station)

**Decision**: Three separate entities with FK relationships, each with its own CRUD endpoints and repository.

**Rationale**: The geographic hierarchy is well-defined and stable. Each entity has distinct behavior (basins aggregate sub-basins, sub-basins aggregate stations, stations own the threshold). Separate entities allow independent management and follow the same per-entity pattern as 001-user-roles (User, Role, UserRole).

**Alternatives considered**:
- Single "Location" entity with type/parent_id tree: Rejected — adds complexity for querying (recursive CTEs), loses type-specific fields like `umbral` on stations, and makes the API less intuitive.
- Two entities (Basin + Station with basinId directly): Rejected — loses the mid-level grouping that sub-basins provide. The user's design explicitly includes sub-basins as the mapping unit between model-api's `locationId` and stations.

## Decision 2: Station Identification Strategy

**Decision**: Station.subBasinName serves as the external identifier used by ms-predictions-api. Station.id (UUID) is the primary key. Both are unique.

**Rationale**: ms-predictions-api's StationThresholdService calls `GET /stations/{stationId}` where stationId maps to `locationId` from ms-model-api's time series, which corresponds to `sub_basin_name`. Providing both `GET /stations/:id` (by UUID) and `GET /stations/by-sub-basin-name/:subBasinName` (by name) covers both internal and cross-service lookup patterns.

**Alternatives considered**:
- Using subBasinName as primary key: Rejected — non-UUID primary keys complicate TypeORM patterns and are inconsistent with the rest of the codebase.
- Separate lookup table: Rejected — over-engineering for a simple unique field lookup.

## Decision 3: Soft Delete via isActive Flag

**Decision**: All entities have an `isActive` boolean (default true). DELETE endpoints set `isActive = false`. No physical deletion.

**Rationale**: ms-predictions-api may have historical predictions referencing station IDs. Physical deletion would break referential integrity. The toggle endpoint (PATCH /:id/toggle) and DELETE endpoint both operate on the same flag, giving administrators two REST-conventional ways to manage entity lifecycle.

**Alternatives considered**:
- TypeORM @DeleteDateColumn (soft delete with deletedAt): Rejected — requires global query scoping to exclude deleted records, adds complexity. The isActive pattern is simpler and already understood in the codebase.
- Physical delete with cascade: Rejected — would break historical references from predictions-api.

## Decision 4: Pagination Pattern

**Decision**: Offset-based pagination with `page` and `limit` query parameters. Default: page=1, limit=10. Response includes items array and total count.

**Rationale**: Consistent with standard REST pagination. The dataset is small (hundreds of stations at most), so offset pagination is adequate. No need for cursor-based pagination.

**Alternatives considered**:
- Cursor-based pagination: Rejected — over-engineering for a dataset of this size.
- No pagination (return all): Rejected — bad practice even for small datasets; spec requires pagination.

## Decision 5: Cache Strategy

**Decision**: Cache station lookups (GetStationById, GetStationBySubBasinName) and list queries in Redis via CachingQueryBus. Invalidate on create/update/delete/toggle commands using the established cache key pattern from cache-config.registry.ts.

**Rationale**: Station threshold lookups are the most frequent read operation (called by predictions-api on every ingestion). The CachingQueryBus pattern is already established in 001-user-roles. Cache invalidation uses the centralized cache key constants.

**Alternatives considered**:
- No caching: Rejected — station threshold is a hot path; predictions-api already caches on its side, but server-side caching reduces DB load.
- External cache (predictions-api only): Already exists, but server-side cache in hydro-api benefits all consumers.

## Decision 6: Station Type Enum

**Decision**: TypeScript string enum with values: `HYDROLOGICAL`, `METEOROLOGICAL`, `PLUVIOMETRIC`. Stored as PostgreSQL enum type.

**Rationale**: Fixed set of station types per the spec. PostgreSQL enum provides DB-level validation. TypeScript enum provides type safety at compile time.

**Alternatives considered**:
- Varchar with class-validator @IsEnum: Rejected — loses DB-level constraint enforcement.
- Separate StationType table: Rejected — over-engineering for a fixed, small set of values that won't change.

## Decision 7: Value Objects

**Decision**: Create two value objects:
- `BasinCodeValueObject`: Validates and normalizes basin/sub-basin codes (trim, uppercase, alphanumeric + hyphens, max 20 chars)
- `StationCodeValueObject`: Validates station codes (trim, uppercase, alphanumeric + hyphens, max 50 chars)

Reuse existing `NameValueObject` for basin/sub-basin/station names.

**Rationale**: Codes are short identifiers that benefit from normalization (uppercase, trimmed). The existing NameValueObject handles name validation. No need for additional VOs — coordinates are optional informational fields, umbral accepts any numeric value.

**Alternatives considered**:
- VO for coordinates (LatLongValueObject): Rejected — coordinates are optional and informational only per the spec. No range validation needed.
- VO for umbral: Rejected — any numeric value is valid (positive, negative, zero). Null means no threshold. No normalization needed.

## Decision 8: Migration Strategy

**Decision**: Three migrations in order: basins → sub_basins (FK to basins) → stations (FK to sub_basins). Each creates the table with all columns, constraints, and indexes.

**Rationale**: Follows the FK dependency chain. Same raw SQL migration pattern as 001-user-roles. Each migration is independently reversible.

**Alternatives considered**:
- Single migration for all three tables: Rejected — harder to review and debug. The 001-user-roles feature uses separate migrations per entity.
