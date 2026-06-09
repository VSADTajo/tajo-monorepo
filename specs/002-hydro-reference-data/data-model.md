# Data Model: Hydrological Reference Data Layer

**Feature**: 002-hydro-reference-data
**Date**: 2026-03-12

## Entity Relationship Diagram

```
┌──────────────┐       ┌──────────────────┐       ┌──────────────────────┐
│    Basin     │       │    SubBasin       │       │      Station         │
│──────────────│       │──────────────────│       │──────────────────────│
│ id (PK, UUID)│──1:N──│ id (PK, UUID)    │──1:N──│ id (PK, UUID)        │
│ name (UQ)    │       │ name             │       │ name                 │
│ code (UQ)    │       │ code (UQ)        │       │ subBasinName (UQ)    │
│ description  │       │ basinId (FK)     │       │ stationCode (UQ)     │
│ isActive     │       │ description      │       │ umbral               │
│ createdAt    │       │ isActive         │       │ stationType          │
│ updatedAt    │       │ createdAt        │       │ subBasinId (FK)      │
└──────────────┘       │ updatedAt        │       │ latitude             │
                       └──────────────────┘       │ longitude            │
                                                  │ altitude             │
                                                  │ description          │
                                                  │ isActive             │
                                                  │ createdAt            │
                                                  │ updatedAt            │
                                                  └──────────────────────┘
```

## Entities

### Basin

**Table**: `basins`
**Extends**: `BaseAuditEntity` (provides `createdAt`, `updatedAt`)
**Implements**: `IValidable`

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK, auto-generated | Primary key |
| name | varchar(100) | NOT NULL, UNIQUE | Basin name (e.g., "Cuenca del Tajo") |
| code | varchar(20) | NOT NULL, UNIQUE | Short code (e.g., "TAJO"). Validated via BasinCodeValueObject (trim, uppercase). |
| description | varchar(255) | nullable | Optional description |
| isActive | boolean | NOT NULL, default true | Active status flag |
| createdAt | timestamp | NOT NULL, default now() | Audit timestamp |
| updatedAt | timestamp | NOT NULL, default now() | Audit timestamp |

**Relationships**:
- `subBasins: SubBasin[]` — OneToMany (basin.id → subBasin.basinId)

**Validation** (`validate()` method):
- `name`: Validated via NameValueObject (trim, non-empty)
- `code`: Validated via BasinCodeValueObject (trim, uppercase, alphanumeric + hyphens, max 20 chars)

**Indexes**:
- UNIQUE on `name`
- UNIQUE on `code`

---

### SubBasin

**Table**: `sub_basins`
**Extends**: `BaseAuditEntity`
**Implements**: `IValidable`

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK, auto-generated | Primary key |
| name | varchar(100) | NOT NULL | Sub-basin name (e.g., "Arroyo de la Vega") |
| code | varchar(20) | NOT NULL, UNIQUE | Short code (e.g., "AVG"). Validated via BasinCodeValueObject. |
| basinId | UUID | NOT NULL, FK → basins(id) | Parent basin reference |
| description | varchar(255) | nullable | Optional description |
| isActive | boolean | NOT NULL, default true | Active status flag |
| createdAt | timestamp | NOT NULL, default now() | Audit timestamp |
| updatedAt | timestamp | NOT NULL, default now() | Audit timestamp |

**Relationships**:
- `basin: Basin` — ManyToOne (subBasin.basinId → basin.id, onDelete: RESTRICT)
- `stations: Station[]` — OneToMany (subBasin.id → station.subBasinId)

**Validation** (`validate()` method):
- `name`: Validated via NameValueObject
- `code`: Validated via BasinCodeValueObject
- `basinId`: Must be present (EntityError if missing)

**Indexes**:
- UNIQUE on `code`
- INDEX on `basinId` (FK lookup optimization)
- UNIQUE composite on (`name`, `basinId`) — name unique within basin

---

### Station

**Table**: `stations`
**Extends**: `BaseAuditEntity`
**Implements**: `IValidable`

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK, auto-generated | Primary key |
| name | varchar(100) | NOT NULL | Station display name |
| subBasinName | varchar(100) | NOT NULL, UNIQUE | External identifier used by ms-predictions-api as stationId/locationId |
| stationCode | varchar(50) | NOT NULL, UNIQUE | Unique station code. Validated via StationCodeValueObject. |
| umbral | double precision | nullable | Alert threshold value. Consumed by ms-predictions-api for notification generation. |
| stationType | enum | NOT NULL | HYDROLOGICAL, METEOROLOGICAL, or PLUVIOMETRIC |
| subBasinId | UUID | NOT NULL, FK → sub_basins(id) | Parent sub-basin reference |
| latitude | double precision | nullable | Geographic latitude |
| longitude | double precision | nullable | Geographic longitude |
| altitude | double precision | nullable | Geographic altitude (meters) |
| description | varchar(255) | nullable | Optional description |
| isActive | boolean | NOT NULL, default true | Active status flag |
| createdAt | timestamp | NOT NULL, default now() | Audit timestamp |
| updatedAt | timestamp | NOT NULL, default now() | Audit timestamp |

**Relationships**:
- `subBasin: SubBasin` — ManyToOne (station.subBasinId → subBasin.id, onDelete: RESTRICT)

**Validation** (`validate()` method):
- `name`: Validated via NameValueObject
- `stationCode`: Validated via StationCodeValueObject (trim, uppercase, alphanumeric + hyphens, max 50 chars)
- `subBasinName`: Must be non-empty string (trim)
- `subBasinId`: Must be present (EntityError if missing)
- `stationType`: Must be a valid StationType enum value

**Indexes**:
- UNIQUE on `subBasinName`
- UNIQUE on `stationCode`
- INDEX on `subBasinId` (FK lookup optimization)
- INDEX on `stationType` (filter optimization)

---

## Enum Types

### StationType

**PostgreSQL type**: `station_type_enum`
**Values**: `'HYDROLOGICAL'`, `'METEOROLOGICAL'`, `'PLUVIOMETRIC'`

```typescript
export enum StationType {
    HYDROLOGICAL = 'HYDROLOGICAL',
    METEOROLOGICAL = 'METEOROLOGICAL',
    PLUVIOMETRIC = 'PLUVIOMETRIC',
}
```

---

## Value Objects

### BasinCodeValueObject

**Purpose**: Validates and normalizes basin/sub-basin codes.

**Rules**:
- Required (non-empty)
- Trimmed and uppercased
- Alphanumeric + hyphens only (`/^[A-Z0-9-]+$/`)
- Max 20 characters
- Throws `EntityError` on invalid

### StationCodeValueObject

**Purpose**: Validates and normalizes station codes.

**Rules**:
- Required (non-empty)
- Trimmed and uppercased
- Alphanumeric + hyphens only (`/^[A-Z0-9-]+$/`)
- Max 50 characters
- Throws `EntityError` on invalid

---

## Migration Plan

### Migration 1: Create basins table

```sql
CREATE TABLE "basins" (
    "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "name" character varying(100) NOT NULL,
    "code" character varying(20) NOT NULL,
    "description" character varying(255),
    "isActive" boolean NOT NULL DEFAULT true,
    CONSTRAINT "PK_basins_id" PRIMARY KEY ("id"),
    CONSTRAINT "UQ_basins_name" UNIQUE ("name"),
    CONSTRAINT "UQ_basins_code" UNIQUE ("code")
);
```

### Migration 2: Create sub_basins table

```sql
CREATE TYPE "station_type_enum" AS ENUM ('HYDROLOGICAL', 'METEOROLOGICAL', 'PLUVIOMETRIC');

CREATE TABLE "sub_basins" (
    "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "name" character varying(100) NOT NULL,
    "code" character varying(20) NOT NULL,
    "basinId" uuid NOT NULL,
    "description" character varying(255),
    "isActive" boolean NOT NULL DEFAULT true,
    CONSTRAINT "PK_sub_basins_id" PRIMARY KEY ("id"),
    CONSTRAINT "UQ_sub_basins_code" UNIQUE ("code"),
    CONSTRAINT "UQ_sub_basins_name_basinId" UNIQUE ("name", "basinId"),
    CONSTRAINT "FK_sub_basins_basinId" FOREIGN KEY ("basinId") REFERENCES "basins"("id") ON DELETE RESTRICT
);

CREATE INDEX "IDX_sub_basins_basinId" ON "sub_basins" ("basinId");
```

### Migration 3: Create stations table

```sql
CREATE TABLE "stations" (
    "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "name" character varying(100) NOT NULL,
    "subBasinName" character varying(100) NOT NULL,
    "stationCode" character varying(50) NOT NULL,
    "umbral" double precision,
    "stationType" "station_type_enum" NOT NULL,
    "subBasinId" uuid NOT NULL,
    "latitude" double precision,
    "longitude" double precision,
    "altitude" double precision,
    "description" character varying(255),
    "isActive" boolean NOT NULL DEFAULT true,
    CONSTRAINT "PK_stations_id" PRIMARY KEY ("id"),
    CONSTRAINT "UQ_stations_subBasinName" UNIQUE ("subBasinName"),
    CONSTRAINT "UQ_stations_stationCode" UNIQUE ("stationCode"),
    CONSTRAINT "FK_stations_subBasinId" FOREIGN KEY ("subBasinId") REFERENCES "sub_basins"("id") ON DELETE RESTRICT
);

CREATE INDEX "IDX_stations_subBasinId" ON "stations" ("subBasinId");
CREATE INDEX "IDX_stations_stationType" ON "stations" ("stationType");
```

---

## Cache Keys

```typescript
export const BasinCacheKeys = {
    byId: (id: string) => `basin:${id}`,
    list: () => 'basins:list',
    pattern: () => 'basin*',
};

export const SubBasinCacheKeys = {
    byId: (id: string) => `sub-basin:${id}`,
    list: () => 'sub-basins:list',
    pattern: () => 'sub-basin*',
};

export const StationCacheKeys = {
    byId: (id: string) => `station:${id}`,
    bySubBasinName: (name: string) => `station:name:${name}`,
    threshold: (id: string) => `station:threshold:${id}`,
    list: () => 'stations:list',
    pattern: () => 'station*',
};
```
