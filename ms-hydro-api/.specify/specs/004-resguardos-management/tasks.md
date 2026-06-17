# Tasks: Gestión de Resguardos por Estación (004-resguardos-management)

> Convención: IDs T0xx. `[TEST]` precede a la implementación que cubre. `[P]` = paralelizable.
> Servicio backend: `ms-hydro-api`. Frontend: `ms-logs-api/ui`.
> **Sin migración** (no hay cambios de esquema).

## Phase 0: Investigación / Setup

- [x] **T001**: ✅ RESUELTO. La query by-date cachea con `resguardo:station:${code}:${date}` y `pattern()` = `resguardo:*`. El `UpdateResguardoHandler` ya invalida `delByPattern('resguardo:*')` → cubre la clave by-date. **T015 NO es necesaria.** FR-010 satisfecho.
  - File: `/home/tony/proyectos/tajo-monorepo/ms-hydro-api/src/app/infrastructure/cache/cache-config.registry.ts`

## Phase 1: Backend — Extender contrato `GET /resguardos/:stationCode/:date` (habilita US-02)

> Orden TDD: el e2e primero (RED), luego la cadena Result → DTO → Handler → Mapper (GREEN).

- [x] **T010**: `[TEST]` Escribir/actualizar e2e del by-date asertando `original`, `edited` y `resolved` por HTTP.
  - File: `/home/tony/proyectos/tajo-monorepo/ms-hydro-api/test/modules/resguardos/get-resguardo-by-date.e2e-spec.ts`
  - Casos: (a) resguardo con editables null → `edited` todo null, `resolved == original`; (b) resguardo con un editable cargado → `resolved` toma el editado en ese campo y el original en los otros; (c) fecha inexistente → 404.
  - Factory si hace falta: `/home/tony/proyectos/tajo-monorepo/ms-hydro-api/test/factories/resguardo.factory.ts`
- [x] **T011**: Extender `GetResguardoByDateResult`: reemplazar `entry` por `resolved` y agregar `date`, `original`, `edited` (tipo crudo `{ reserveVolume, reserveLevel, minimumVolume: number | null }`).
  - File: `/home/tony/proyectos/tajo-monorepo/ms-hydro-api/src/app/domain/results/resguardo.results.ts`
- [x] **T012**: Agregar `RawResguardoValuesDto` y extender `GetResguardoByDateResponseDto` con `date`, `original`, `edited`, `resolved` (renombrando `entry`→`resolved`). `@ApiProperty` en cada campo.
  - File: `/home/tony/proyectos/tajo-monorepo/ms-hydro-api/src/app/api/dtos/resguardo.dtos.ts`
- [x] **T013**: En `GetResguardoByDateHandler`, construir `original` y `edited` desde la entidad cargada (ya disponible vía `findByStationIdAndDate`) y mantener `resolved` con la regla `editado ?? original`. Devolver el Result extendido.
  - File: `/home/tony/proyectos/tajo-monorepo/ms-hydro-api/src/app/application/queries/resguardo.queries.ts`
- [x] **T014**: Actualizar `GetResguardoByDateMapper.toResponseDto` para propagar `date`, `original`, `edited`, `resolved`.
  - File: `/home/tony/proyectos/tajo-monorepo/ms-hydro-api/src/app/application/mappers/resguardo.mappers.ts`
- [~] **T015**: ❌ NO NECESARIA (ver T001). La invalidación `delByPattern('resguardo:*')` del `UpdateResguardoHandler` ya cubre la clave by-date.
  - File: `/home/tony/proyectos/tajo-monorepo/ms-hydro-api/src/app/application/commands/resguardo.commands.ts`
- [x] **T016**: Verificar que T010 pasa: `cd ms-hydro-api && npm run test:e2e -- --testPathPattern=get-resguardo-by-date`
- [x] **T017**: Actualizar contrato público en doc del servicio si corresponde (nuevo shape del by-date). ✅ NO aplica: el contrato del by-date no estaba documentado en CLAUDE.md ni en ningún README de resguardos.
  - File: `/home/tony/proyectos/tajo-monorepo/ms-hydro-api/CLAUDE.md` (o README de resguardos si existe)

## Phase 2: Frontend — Tab Resguardos en el backoffice (`ms-logs-api/ui`)

### US-03 + base: tipos y capa HTTP

- [x] **T020**: `[P]` Agregar interfaces de resguardo en types.
  - File: `/home/tony/proyectos/tajo-monorepo/ms-logs-api/ui/src/types/hydro.ts`
  - `RawResguardoValues { reserveVolume, reserveLevel, minimumVolume: number | null }`
  - `ResguardoByDate { stationCode, stationName, date, original, edited, resolved }`
  - `ResguardosByStation { stationCode, stationName, entries: Record<string, RawResguardoValues>, total }`
- [x] **T021**: Agregar métodos al cliente HTTP (sobre el `gatewayClient` existente).
  - File: `/home/tony/proyectos/tajo-monorepo/ms-logs-api/ui/src/components/hydro/api.ts`
  - `getResguardosByStation(stationCode, { from?, to? })` → `GET /resguardos/${stationCode}`
  - `getResguardoByDate(stationCode, date)` → `GET /resguardos/${stationCode}/${date}`
  - `updateResguardo(stationCode, date, payload)` → `PUT /resguardos/${stationCode}/${date}`

### US-01: Consultar resguardos por estación (tabla por fecha)

- [x] **T022**: Crear `ResguardosTab.tsx` — estructura base espejando `StationsTab`: header con conteo, selector de estación obligatorio (reusar `listStations` + `SearchableSelect`), filtro de rango de fecha (desde/hasta), búsqueda. Query React Query habilitada solo con estación seleccionada (`getResguardosByStation`).
  - File: `/home/tony/proyectos/tajo-monorepo/ms-logs-api/ui/src/components/hydro/ResguardosTab.tsx`
- [x] **T023**: En `ResguardosTab`, renderizar la tabla/lista por fecha mostrando `resolved` (minimumVolume, reserveVolume, reserveLevel) + estado vacío ("No hay resguardos" / "Seleccioná una estación"). Filtro de fecha server-side (`from/to`).
  - File: `/home/tony/proyectos/tajo-monorepo/ms-logs-api/ui/src/components/hydro/ResguardosTab.tsx`

### US-02: Editar el resguardo de una fecha (modal Original vs Editado)

- [x] **T024**: Acción Editar (pencil) por fila → abre modal. Al abrir, `getResguardoByDate(stationCode, date)`: mostrar `original.*` como **solo lectura** y `edited.*` como inputs numéricos. Sin toggle, sin crear, sin borrar.
  - File: `/home/tony/proyectos/tajo-monorepo/ms-logs-api/ui/src/components/hydro/ResguardosTab.tsx`
- [x] **T025**: Guardar con `updateResguardo`: input vacío → enviar `null`; validación numérica mínima client-side. `onSuccess`: invalidar `queryKey ['resguardos', stationCode]`. Manejo de error de guardado.
  - File: `/home/tony/proyectos/tajo-monorepo/ms-logs-api/ui/src/components/hydro/ResguardosTab.tsx`

### US-03: Integración en el panel

- [x] **T026**: Registrar la 4ta tab en `HydroPanel`: agregar `'resguardos'` al type `Tab`, a `TAB_LABELS` ('Resguardos'), al array de tabs y al render condicional `{activeTab === 'resguardos' && <ResguardosTab />}`.
  - File: `/home/tony/proyectos/tajo-monorepo/ms-logs-api/ui/src/components/hydro/HydroPanel.tsx`
- [x] **T027**: Actualizar el subtítulo del panel si aplica ("Gestion de cuencas, subcuencas, estaciones y resguardos").
  - File: `/home/tony/proyectos/tajo-monorepo/ms-logs-api/ui/src/components/hydro/HydroPanel.tsx`

## Phase 3: Verificación & Polish

- [ ] **T030**: Backend — `cd ms-hydro-api && npm run lint && npm run test:e2e -- --testPathPattern=resguardo`
- [ ] **T031**: Frontend — `cd ms-logs-api/ui && npm run build` (type check + bundle) y revisión visual contra la tab Estaciones (consistencia de diseño).
- [ ] **T032**: Smoke manual: seleccionar estación → ver tabla → editar una fecha → confirmar que el valor vigente se actualiza sin recargar (FR-010 / SC-003); vaciar un editable → confirmar fallback al original (SC-005).

## Dependency Map

```
T001 → T015 (condicional)
T010 (TEST, RED) → T011 → T012 → T013 → T014 → T016 (GREEN)
T013, T014 → T017
T020, T021 → T022 → T023 (US-01)
T021, T012(contrato by-date) → T024 → T025 (US-02)
T022 → T026 → T027 (US-03)
Phase 1 + Phase 2 → T030, T031, T032
```

## MVP Scope

- **MVP mínimo (US-01)**: T020, T021, T022, T023, T026 → tab que lista resguardos por estación (solo lectura). Entrega valor de auditoría sin tocar backend.
- **Feature completa**: + Phase 1 (backend by-date) + T024, T025 (edición Original/Editado) + Phase 3.

## Notas de paralelización

- **Backend (Phase 1)** y **Frontend tipos/HTTP (T020, T021)** pueden ir en paralelo: el front puede mockear el shape del by-date hasta que el backend mergee. El modal de edición (T024) sí depende del contrato real del by-date (T012).
- T020 y T021 son `[P]` entre sí (archivos distintos).
