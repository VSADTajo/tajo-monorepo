# Plan: Downstream Stations Query — ms-hydro-api

**Spec**: ms-hydro-api/.specify/specs/downstream-stations-query/spec.md
**Created**: 2026-06-19
**Stack**: NestJS 11 + TypeScript 5.7+ + TypeORM 0.3 (dual DB: hydro + geoserver)

---

## Summary

Se agrega un endpoint `GET /stations/downstream` que recibe un array de códigos de estación origen y retorna las estaciones y embalses aguas abajo. La fuente de datos es la vista materializada `mv_estaciones_aguas_abajo` en la base de datos GIS (PostGIS). Se reutiliza el patrón `@ViewEntity` ya establecido en el servicio (`mv_cht_unificada`) y la conexión TypeORM named `'geoserver'`. El resultado se cachea en Redis. No hay nuevas migraciones ni cambios de esquema.

---

## Technical Context

| Aspect | Detail |
|--------|--------|
| Language / Version | TypeScript 5.7+ / NestJS 11 |
| Primary Dependencies | `@nestjs/cqrs`, `typeorm`, `class-validator`, `ioredis`, `nestjs-pino` |
| Storage | GIS DB (PostGIS 17) via TypeORM named connection `'geoserver'` — solo lectura |
| Messaging | ninguno |
| Testing | Jest + Supertest + `@testcontainers/postgresql` |
| Target Environment | Docker Compose (local) / Hetzner prod |

---

## Architecture

Operación de solo lectura sin side-effects. Flujo estándar CQRS:

```
GET /stations/downstream?codes[]=X&codes[]=Y
  → StationController
  → GetDownstreamStationsMapper.toQuery(dto)
  → CachingQueryBus.execute(GetDownstreamStationsQuery)
    → cache HIT  → return cached result
    → cache MISS → GetDownstreamStationsHandler
                    → IDownstreamStationsRepository.findDownstream(codes)
                      → raw SQL sobre mv_estaciones_aguas_abajo (GIS DB)
                    → return DownstreamStationsResult[]
```

`IDownstreamStationsRepository` usa la conexión TypeORM `'geoserver'` (igual que `GeoDataRepository`). La view entity `MvEstacionesAguasAbajo` se registra en `GeoserverDatabaseProviderModule`.

### Directory Structure

```
src/app/
├── api/
│   ├── controllers/
│   │   └── station.controller.ts           MODIFY — agregar GET /stations/downstream
│   └── dtos/
│       └── station.dtos.ts                 MODIFY — agregar sección GetDownstreamStations
│
├── application/
│   ├── queries/
│   │   └── station.queries.ts              MODIFY — agregar GetDownstreamStationsQuery + Handler
│   ├── mappers/
│   │   └── station.mappers.ts              MODIFY — agregar GetDownstreamStationsMapper
│   └── application.module.ts              MODIFY — registrar GetDownstreamStationsHandler
│
├── domain/
│   ├── entities/
│   │   └── mv-estaciones-aguas-abajo.entity.ts  NEW — @ViewEntity para la GIS DB
│   ├── ports/
│   │   └── downstream-stations-repository.port.ts  NEW — IDownstreamStationsRepository
│   └── results/
│       └── downstream-stations.result.ts   NEW — DownstreamStationItem + DownstreamStationsResult
│
└── infrastructure/
    ├── persistence/
    │   ├── downstream-stations.repository.ts  NEW — raw SQL query sobre GIS DB
    │   └── geoserver-database-provider.module.ts  MODIFY — registrar nueva entity
    ├── cache/
    │   └── cache-config.registry.ts        MODIFY — agregar DownstreamStationsCacheKeys
    └── infrastructure.module.ts            MODIFY — bind IDownstreamStationsRepository
```

---

## Data Model

### Sin migraciones nuevas

La vista `mv_estaciones_aguas_abajo` ya existe en la GIS DB (gestionada por el equipo GIS). No se crea ni modifica ninguna tabla.

### ViewEntity: `MvEstacionesAguasAbajo`

```typescript
@ViewEntity({ name: 'mv_estaciones_aguas_abajo' })
export class MvEstacionesAguasAbajo {
    @ViewColumn({ name: 'codigo_origen' })  codigoOrigen: string;
    @ViewColumn({ name: 'codigo_destino' }) codigoDestino: string;
    @ViewColumn({ name: 'nombre_destino' }) nombreDestino: string;
    @ViewColumn({ name: 'tipo_destino' })   tipoDestino: string;
}
```

### Query SQL

```sql
SELECT DISTINCT codigo_destino, nombre_destino, tipo_destino
FROM mv_estaciones_aguas_abajo
WHERE codigo_origen = ANY($1)
```

Ejecutada via TypeORM `getRepository(MvEstacionesAguasAbajo, 'geoserver').createQueryBuilder(...)` o raw query sobre la conexión `'geoserver'`.

---

## API Contracts

### `GET /stations/downstream`

**Query params:** `codes` — array de códigos origen (requerido, mínimo 1)

Ejemplo: `GET /stations/downstream?codes[]=E001&codes[]=E002`

**Response 200:**
```json
{
  "items": [
    {
      "codigoDestino": "E010",
      "nombreDestino": "Estación Aguas Abajo 1",
      "tipoDestino": "aforo"
    },
    {
      "codigoDestino": "EMBALSE_001",
      "nombreDestino": "Embalse del Tranco",
      "tipoDestino": "embalse"
    }
  ],
  "count": 2
}
```

**Errors:**
- `400` — `codes` vacío o no provisto

---

## Cache

```typescript
export const DownstreamStationsCacheKeys = {
    byCodes: (codes: string[]) => `stations:downstream:${codes.sort().join(',')}`,
    pattern: () => 'stations:downstream:*',
};

// CACHE_REGISTRY:
CACHE_REGISTRY.set('GetDownstreamStationsQuery', {
    ttl: 600,  // 10 min — la view es actualizada por el equipo GIS, no en tiempo real
    key: (q: GetDownstreamStationsQuery) => DownstreamStationsCacheKeys.byCodes(q.codes),
});
```

---

## Events

Ninguno. Endpoint de solo lectura.

---

## Constitution Compliance

| Principle | Status | Notes |
|-----------|--------|-------|
| Hexagonal Architecture | ✅ | `IDownstreamStationsRepository` port en domain; impl en infrastructure usa conexión GIS |
| CQRS | ✅ | `GetDownstreamStationsQuery` + Handler; pasa por `CachingQueryBus` |
| Ports como abstract classes | ✅ | `IDownstreamStationsRepository` es abstract class |
| Sin migraciones | ✅ | La view ya existe en GIS DB — solo se registra como ViewEntity |
| Dual DB | ✅ | Repositorio usa `@InjectRepository(..., 'geoserver')` igual que `GeoDataRepository` |
| Cache | ✅ | TTL 600s, clave basada en códigos ordenados (determinista) |
| Tests via HTTP | ✅ | E2E via `GET /stations/downstream`; mock de `IDownstreamStationsRepository` (GIS DB no disponible en Testcontainers) |

---

## Open Questions

Ninguna — la spec, la query SQL y el formato de response están completamente definidos.
