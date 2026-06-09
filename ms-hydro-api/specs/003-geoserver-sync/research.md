# Research: GeoServer Data Sync

**Feature**: `003-geoserver-sync` | **Date**: 2026-03-24

## R1: TypeORM Multiple Database Connections

**Decision**: Use TypeORM named connections with `TypeOrmModule.forRootAsync({ name: 'geoserver', ... })`

**Rationale**: NestJS/TypeORM natively supports named connections. Repositories and DataSources are resolved by connection name. The existing pattern (`PostgresDatabaseProviderModule`) is easily replicated with a `name` parameter. The GeoServer connection uses `synchronize: false` and has no migrations.

**Alternatives considered**:
- Direct `pg` client: Simpler but bypasses TypeORM entity mapping and DI
- Separate microservice: Overkill for read-only reference data queries
- GeoServer WFS API: Loses spatial join capability; adds HTTP overhead

## R2: PostGIS Spatial Queries in TypeORM

**Decision**: Use `@InjectDataSource('geoserver')` with raw SQL queries for spatial operations

**Rationale**: TypeORM does not support PostGIS functions like `ST_Contains` in its QueryBuilder. The `DataSource.query()` method allows raw SQL with full PostGIS support. The spatial join `ST_Contains(subcuenca.geom, station.geom)` is the canonical way to determine which polygon contains a point. All 254 stations are confirmed to fall within subcuencas.

**Alternatives considered**:
- TypeORM QueryBuilder with `createQueryBuilder().where('ST_Contains(...)')`: Works but loses type safety and is harder to maintain than a clean raw query
- Pre-computed mapping table: Would need manual maintenance when GeoServer data changes

## R3: PostgreSQL Enum Migration Strategy

**Decision**: Rename old enum → create new enum → alter column using cast → drop old enum

**Rationale**: PostgreSQL does not support removing values from an enum type, and `ALTER TYPE ADD VALUE` cannot run in a transaction. The safest approach is:
1. Map any existing rows using old values to new values
2. Rename old type to `_old`
3. Create new type with 7 values
4. Alter column to use new type with `USING` cast
5. Drop old type

This handles both empty tables (fresh installs) and tables with existing data.

**Alternatives considered**:
- `ALTER TYPE ADD VALUE`: Cannot remove old values; leaves dead enum entries
- Text column: Loses type safety at DB level
- Separate column: Adds complexity with two type fields

## R4: Sub-Basin to Basin Mapping (Zona Resolution)

**Decision**: Determine each subcuenca's zona by majority vote of its contained stations' zona values

**Rationale**: GeoServer has no direct subcuenca→zona relationship. The spatial approach assigns each subcuenca the zona of the majority of its stations. SQL query groups stations by subcuenca and zona, orders by count DESC, and takes the first per subcuenca. This correctly maps 100% of the 119 subcuencas.

**Alternatives considered**:
- Spatial join subcuenca polygon against zona polygons: No zona polygon table exists in GeoServer
- Manual mapping table: 119 entries to maintain manually
- Use station.zona directly as basin: Would lose the basin→sub_basin→station hierarchy

## R5: Zona Name to Basin Code Normalization

**Decision**: Static mapping with diacritic removal and space→hyphen substitution

**Rationale**: The `BasinCodeValueObject` validates `^[A-Z0-9-]+$` with max 20 chars. The 11 zona names need normalization:
- Remove diacritics: TIÉTAR→TIETAR, ÁRRAGO→ARRAGO, ALAGÓN→ALAGON, TAJUÑA→TAJUNA
- Replace spaces with hyphens: TAJO IZQUIERDA→TAJO-IZQUIERDA, BAJO TAJO→BAJO-TAJO
- Longest code is TAJO-IZQUIERDA (14 chars) — fits within 20 char limit

A hardcoded map of 11 entries is more reliable than a generic transliteration library.

**Alternatives considered**:
- Generic Unicode normalization library: Dependency for 4 accented characters is overkill
- Store raw zona as code: Fails BasinCodeValueObject validation (spaces, accents)

## R6: Upsert Strategy and Umbral Preservation

**Decision**: Find by code/stationCode → if exists, update (preserving umbral) → if not, create

**Rationale**: TypeORM's `upsert` method has limited support for conditional field updates (preserve umbral if non-null). A simple find→update/create pattern is clearer, safer, and follows existing repository patterns. The sync processes ~400 records total (11 + 119 + 254) so performance of individual lookups is not a concern.

**Alternatives considered**:
- SQL UPSERT with CASE: Efficient but bypasses entity validation and repository patterns
- Bulk insert with conflict handling: Same issue — bypasses domain validation
- Transaction with raw SQL: Loses type safety and hexagonal architecture compliance

## R7: GeoServer Coordinate System

**Decision**: Use `xetrs89h30` and `yetrs89h30` columns from `cht_puntos_saih` as longitude and latitude respectively

**Rationale**: The `xetrs89h30`/`yetrs89h30` columns contain ETRS89 UTM Zone 30 projected coordinates (meters), NOT lat/lon. However, the `geom` column is in EPSG:4326 (WGS84 lat/lon). We should extract lat/lon from the geometry column using `ST_Y(geom)` for latitude and `ST_X(geom)` for longitude in the spatial query rather than using the projected coordinates.

**Alternatives considered**:
- Use xetrs89h30/yetrs89h30 directly: These are UTM meters, not degrees — would give wrong values for lat/lon
- Convert UTM to lat/lon in application code: Unnecessary when PostGIS can extract from the geometry directly
