# Data Model: Aerial Precipitation

**Plan**: `.specify/specs/aerial-precipitation/plan.md`
**DB**: PostgreSQL 16 — `ms_meteo` on `infra-db-meteo`
**Migration**: raw SQL, `synchronize: false`

Two new tables. All timestamps are `TIMESTAMP` (no timezone) — FEWS payloads declare `timeZone: 0.0` (UTC) and events carry `date + time` strings that we normalize to UTC before insert.

---

## Table 1: `aerial_precipitation_series`

One row per unique `(locationId, parameterId, forecastDate)`. Holds every field of the FEWS `header` we need to preserve, plus the four derived fields extracted by the parameter-id parser.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | `uuid_generate_v4()` | PK |
| `locationId` | `varchar(100)` | NO | — | FEWS location code (e.g. `Cuenca.NAM.E_08`, `Sistema.Tajo.3`, `Cuenca.AEMET.1`) |
| `parameterId` | `varchar(100)` | NO | — | Full FEWS parameter (e.g. `P.areal.ens.subcNAM.Med.24h`) |
| `forecastDate` | `timestamp` | NO | — | The `header.forecastDate` combined date + time, UTC |
| `provider` | `varchar(20)` | NO | — | Derived: `ens` \| `harmonie` \| `obs` |
| `layer` | `varchar(20)` | NO | — | Derived: `sistema` \| `aemet` \| `subcNAM` |
| `stat` | `varchar(10)` | YES | NULL | Derived: `Med` \| `Max` (only for EPS); NULL for Harmonie/SAIH |
| `accumulation` | `varchar(10)` | NO | — | Derived, normalized lowercase: `1h` \| `12h` \| `24h` |
| `moduleInstanceId` | `varchar(100)` | YES | NULL | e.g. `Processing_Catchment_EPS` |
| `stationName` | `varchar(100)` | YES | NULL | Polygon-friendly name from FEWS (e.g. `CABECERA`) |
| `lat` | `double precision` | YES | NULL | Centroid latitude (WGS84) |
| `lon` | `double precision` | YES | NULL | Centroid longitude (WGS84) |
| `startDate` | `timestamp` | YES | NULL | Header `startDate` combined UTC |
| `endDate` | `timestamp` | YES | NULL | Header `endDate` combined UTC |
| `units` | `varchar(20)` | NO | `'mm'` | From `header.units` |
| `missVal` | `double precision` | NO | `-999` | Preserved for round-trip audit |
| `timeStepSeconds` | `integer` | NO | `3600` | From `header.timeStep.multiplier` (always 3600 in current data but preserved) |
| `creationDate` | `timestamp` | YES | NULL | From header |
| `approvedDate` | `timestamp` | YES | NULL | From header |
| `sourceFileName` | `varchar(200)` | NO | — | Basename of the JSON that produced this series (auditability) |
| `createdAt` | `timestamp` | NO | `now()` | `BaseAuditEntity` |
| `updatedAt` | `timestamp` | NO | `now()` | `BaseAuditEntity` |

### Constraints & indexes

```sql
CONSTRAINT "PK_aerial_precipitation_series_id" PRIMARY KEY ("id")

CONSTRAINT "UQ_aerial_precip_series_natural_key"
    UNIQUE ("locationId", "parameterId", "forecastDate")

CREATE INDEX "IDX_aerial_precip_series_forecastDate"
    ON aerial_precipitation_series ("forecastDate")
    -- feeds the retention cleanup DELETE

CREATE INDEX "IDX_aerial_precip_series_lookup"
    ON aerial_precipitation_series ("layer", "provider", "accumulation", "stat", "forecastDate" DESC)
    -- feeds the "latest per polygon per layer/provider" query

CREATE INDEX "IDX_aerial_precip_series_locationId"
    ON aerial_precipitation_series ("locationId")
    -- feeds /by-location/:id
```

---

## Table 2: `aerial_precipitation_events`

Hourly events. Composite PK avoids duplicates at the DB layer; cascade delete keeps events consistent with parent series.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `seriesId` | `uuid` | NO | — | FK → `aerial_precipitation_series(id)` `ON DELETE CASCADE` |
| `eventDate` | `timestamp` | NO | — | Combined UTC from `event.date + event.time` |
| `value` | `double precision` | NO | — | Numeric (already filtered out `missVal` at ingest) |
| `flag` | `smallint` | NO | — | FEWS quality flag (only `2` currently persisted; others filtered at ingest) |
| `createdAt` | `timestamp` | NO | `now()` | audit — inserted-at |

### Constraints & indexes

```sql
CONSTRAINT "PK_aerial_precip_events" PRIMARY KEY ("seriesId", "eventDate")

CONSTRAINT "FK_aerial_precip_events_series"
    FOREIGN KEY ("seriesId") REFERENCES aerial_precipitation_series("id") ON DELETE CASCADE
```

No secondary indexes needed — the PK index is a covering `(seriesId, eventDate)` btree, and the natural query pattern is "give me the events of series X ordered by eventDate", which uses the PK directly.

---

## Value objects (in-code, not persisted)

- **`ParameterIdValueObject`** — parses `P.areal.{provider}.{layer}[.{stat}][.{accum}]`.
  - Provider: `ens` \| `harmonie` \| `obs` — anything else throws `EntityError`.
  - Layer: `sis10` \| `aemet` \| `subcNAM` — mapped to persisted `layer` values `sistema` \| `aemet` \| `subcNAM`.
  - Stat: `Med` \| `Max` — only permitted when provider is `ens`.
  - Accumulation: optional trailing `.1h` \| `.12h` \| `.24h` (case-insensitive input). Normalized to lowercase. Missing suffix → `1h` (the base timestep per FEWS convention).
- **`LocationIdValueObject`** — validates that the string prefix matches one of `Sistema.`, `Cuenca.NAM.`, `Cuenca.AEMET.`. Anything else throws `EntityError` (the ingester catches and skips the series).

---

## Cardinality estimate

Using the customer's sample payloads and assuming one full run of all three providers per day:

- Series per run: `10 (Sistemas) + 27 (AEMET) + 137 (NAM)` polygons × `18 (EPS) + 3 (Harmonie) + 3 (SAIH) = 24` parameters = **~4176 series/run** across all providers.
  - Note: SAIH covers 3d past (72 events); EPS/Harmonie cover 3d forward (72 events).
- Events per series: ~72 valid entries after `missVal` filter (some series have ≤ 24 events for the 24h-accumulated variants; take ~48 average).
- Events per run: ~200 k rows / run.
- Retention 30 days × 1 run/day: ~125 k series + ~6 M events steady-state. Both PK indexes stay well under 1 GB.

---

## Migration outline

```typescript
// src/migrations/<ts>-create-aerial-precipitation.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAerialPrecipitation<TS> implements MigrationInterface {
    name = 'CreateAerialPrecipitation<TS>';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "aerial_precipitation_series" (
                "createdAt"        TIMESTAMP        NOT NULL DEFAULT now(),
                "updatedAt"        TIMESTAMP        NOT NULL DEFAULT now(),
                "id"               uuid             NOT NULL DEFAULT uuid_generate_v4(),
                "locationId"       varchar(100)     NOT NULL,
                "parameterId"      varchar(100)     NOT NULL,
                "forecastDate"     TIMESTAMP        NOT NULL,
                "provider"         varchar(20)      NOT NULL,
                "layer"            varchar(20)      NOT NULL,
                "stat"             varchar(10),
                "accumulation"     varchar(10)      NOT NULL,
                "moduleInstanceId" varchar(100),
                "stationName"      varchar(100),
                "lat"              double precision,
                "lon"              double precision,
                "startDate"        TIMESTAMP,
                "endDate"          TIMESTAMP,
                "units"            varchar(20)      NOT NULL DEFAULT 'mm',
                "missVal"          double precision NOT NULL DEFAULT -999,
                "timeStepSeconds"  integer          NOT NULL DEFAULT 3600,
                "creationDate"     TIMESTAMP,
                "approvedDate"     TIMESTAMP,
                "sourceFileName"   varchar(200)     NOT NULL,
                CONSTRAINT "PK_aerial_precipitation_series_id" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_aerial_precip_series_natural_key"
                    UNIQUE ("locationId", "parameterId", "forecastDate")
            )
        `);

        await queryRunner.query(`
            CREATE INDEX "IDX_aerial_precip_series_forecastDate"
                ON "aerial_precipitation_series" ("forecastDate")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_aerial_precip_series_lookup"
                ON "aerial_precipitation_series"
                ("layer", "provider", "accumulation", "stat", "forecastDate" DESC)
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_aerial_precip_series_locationId"
                ON "aerial_precipitation_series" ("locationId")
        `);

        await queryRunner.query(`
            CREATE TABLE "aerial_precipitation_events" (
                "createdAt"  TIMESTAMP        NOT NULL DEFAULT now(),
                "seriesId"   uuid             NOT NULL,
                "eventDate"  TIMESTAMP        NOT NULL,
                "value"      double precision NOT NULL,
                "flag"       smallint         NOT NULL,
                CONSTRAINT "PK_aerial_precip_events" PRIMARY KEY ("seriesId", "eventDate"),
                CONSTRAINT "FK_aerial_precip_events_series"
                    FOREIGN KEY ("seriesId")
                    REFERENCES "aerial_precipitation_series"("id")
                    ON DELETE CASCADE
            )
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "aerial_precipitation_events"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_aerial_precip_series_locationId"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_aerial_precip_series_lookup"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_aerial_precip_series_forecastDate"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "aerial_precipitation_series"`);
    }
}
```
