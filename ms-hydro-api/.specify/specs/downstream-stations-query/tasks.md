# Tasks: Downstream Stations Query — ms-hydro-api

**Spec**: ms-hydro-api/.specify/specs/downstream-stations-query/spec.md
**Plan**: ms-hydro-api/.specify/specs/downstream-stations-query/plan.md
**Created**: 2026-06-19

---

## Phase 0: Setup

- [x] T001: Register `MvEstacionesAguasAbajo` ViewEntity in `GeoserverDatabaseProviderModule` (import + `TypeOrmModule.forFeature([..., MvEstacionesAguasAbajo], 'geoserver')`) `src/app/infrastructure/persistence/geoserver-database-provider.module.ts`

---

## Phase 1: Foundational

- [x] T010 [P]: Implement `MvEstacionesAguasAbajo` ViewEntity — `@ViewEntity({ name: 'mv_estaciones_aguas_abajo' })` con `@ViewColumn` para `codigoOrigen`, `codigoDestino`, `nombreDestino`, `tipoDestino` `src/app/domain/entities/mv-estaciones-aguas-abajo.entity.ts`
- [x] T011 [P]: Implement `IDownstreamStationsRepository` abstract port — `findDownstream(codes: string[]): Promise<{ codigoDestino: string; nombreDestino: string; tipoDestino: string }[]>` `src/app/domain/ports/downstream-stations-repository.port.ts`
- [x] T012 [P]: Implement `DownstreamStationItem` + `DownstreamStationsResult` `src/app/domain/results/downstream-stations.result.ts`
- [x] T013: Implement `DownstreamStationsRepository` — `@InjectRepository(MvEstacionesAguasAbajo, 'geoserver')`; raw query `SELECT DISTINCT codigo_destino, nombre_destino, tipo_destino FROM mv_estaciones_aguas_abajo WHERE codigo_origen = ANY($1)`; retorna array vacío si `codes` es vacío; wraps en `RepositoryError` en fallo `src/app/infrastructure/persistence/downstream-stations.repository.ts`
- [x] T014: Add `DownstreamStationsCacheKeys` to `cache-config.registry.ts` — `byCodes: (codes: string[]) => 'stations:downstream:' + codes.sort().join(',')` + `pattern: () => 'stations:downstream:*'`; entrada en `CACHE_REGISTRY` con TTL 600s `src/app/infrastructure/cache/cache-config.registry.ts`
- [x] T015: Update `infrastructure.module.ts` — bind `IDownstreamStationsRepository → DownstreamStationsRepository`; `GeoserverDatabaseProviderModule` ya importado `src/app/infrastructure/infrastructure.module.ts`

---

## Phase 2: User Story

### US1: GET /stations/downstream

- [x] T020 [TEST]: Write failing e2e test — `GET /stations/downstream?codes[]=X&codes[]=Y`: mock de `IDownstreamStationsRepository` retorna 2 items → 200 con `{ items: [...], count: 2 }`; sin `codes` → 400; `codes=[]` vacío → 400 `test/modules/stations/get-downstream-stations.e2e-spec.ts`
- [x] T021 [P]: Implement request/response DTOs — `GetDownstreamStationsRequestDto`, `DownstreamStationItemDto`, `GetDownstreamStationsResponseDto`; sección en `station.dtos.ts` `src/app/api/dtos/station.dtos.ts`
- [x] T022 [P]: Implement `GetDownstreamStationsQuery` + Handler — recibe `codes: string[]`; llama `downstreamStationsRepository.findDownstream(codes)`; retorna `DownstreamStationsResult`; registrado en `application.module.ts`; entrada en `CACHE_REGISTRY` TTL 600s `src/app/application/queries/station.queries.ts` + `src/app/infrastructure/cache/cache-config.registry.ts`
- [x] T023: Implement `GetDownstreamStationsMapper` — `toQuery(dto): GetDownstreamStationsQuery`, `toResponseDto(result): GetDownstreamStationsResponseDto` `src/app/application/mappers/station.mappers.ts`
- [x] T024: Add `GET /stations/downstream` endpoint to `StationController` — `@Get('downstream')` **antes** de `@Get(':id')`; maneja `codes[]` y `codes` query formats; `EntityError → 400`, else `500` `src/app/api/controllers/station.controller.ts`

---

## Phase 3: Integration & Polish

- [x] T030 [P]: Update `CLAUDE.md` — agregar `MvEstacionesAguasAbajo` ViewEntity + `IDownstreamStationsRepository` + `GET /stations/downstream` a Recent Changes `CLAUDE.md`
- [x] T031 [P]: Verify `@ApiEndpoint` Swagger decorator en el nuevo endpoint + `@ApiProperty` en DTOs nuevos `src/app/api/`

---

## Dependency Map

| Task | Depends On |
|------|-----------|
| T010 | T001 |
| T011 | — |
| T012 | — |
| T013 | T010, T011 |
| T014 | — |
| T015 | T013 |
| T020 | T015 |
| T021 | T012 |
| T022 | T020, T021 |
| T023 | T021, T022 |
| T024 | T022, T023 |
| T030 | T024 |
| T031 | T024 |

---

## MVP Scope

Todas las tareas son MVP — la feature es pequeña (1 endpoint, 0 migraciones).

Polish (T030–T031) diferible si hay time pressure.
