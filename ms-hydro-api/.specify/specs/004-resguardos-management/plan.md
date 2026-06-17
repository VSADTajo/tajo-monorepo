# Plan: Gestión de Resguardos por Estación (004-resguardos-management)

## Summary

La mayor parte del dominio de resguardos ya existe en `ms-hydro-api` (entidad `StationResguardo`, repositorio, import XLS, queries por estación y por fecha, command de update, cache Redis). Esta feature se compone de **un cambio quirúrgico de backend** y **el grueso de trabajo en el frontend del backoffice React** (`ms-logs-api/ui`).

- **Backend (`ms-hydro-api`)**: extender la respuesta del endpoint `GET /resguardos/:stationCode/:date` para devolver, además del valor resuelto (`resolved`), los bloques crudos `original` (read-only) y `edited` (nullable). El `GetResguardoByDateHandler` ya carga la entidad completa vía `findByStationIdAndDate`; hoy descarta los crudos al resolver. Solo hay que propagarlos por Result → Mapper → DTO. **Sin migración, sin tocar la entidad ni el repositorio.**
- **Frontend (`ms-logs-api/ui`)**: agregar una pestaña "Resguardos" en `HydroPanel`, espejando el patrón visual y de interacción de `StationsTab` (React Query + Axios al gateway). La tabla por fecha consume `GET /resguardos/:stationCode` (resueltos); el modal de edición consume el `GET by-date` extendido para mostrar Original vs Editado y persiste con `PUT /resguardos/:stationCode/:date`.

Cross-service: la feature toca dos servicios (`ms-hydro-api` backend + `ms-logs-api/ui` frontend). Como `ms-logs-api/ui` no es un servicio NestJS speckit-managed, este plan único cubre ambos, con secciones separadas.

## Technical Context

- **Service (primario)**: `ms-hydro-api` (NestJS 11, hexagonal + CQRS).
- **Service (consumidor)**: `ms-logs-api/ui` (backoffice React 18 + Vite + TailwindCSS + TanStack React Query + Axios).
- **New dependencies**: ninguna (ni backend ni frontend).
- **Storage**: sin cambios de esquema. Tabla `station_resguardos` existente (columnas `original*` inmutables, `reserve*/minimumVolume` editables, unique `(stationId, date)`). Sin migración.
- **Cache**: claves de resguardo existentes en `cache-config.registry.ts` (`ResguardoCacheKeys.byStation`, `.pattern`). El `UpdateResguardoHandler` ya invalida `byStation(stationCode)` + `pattern()` → cubre FR-010 (sin caché obsoleta). Verificar que la clave de la query by-date cae bajo `pattern()`.
- **Events**: no aplica (sin RabbitMQ en esta feature).

## Architecture

### Directory Structure

**Backend — `ms-hydro-api/src/` (MODIFICAR, 4 archivos):**

```
app/domain/results/resguardo.results.ts        # MOD: GetResguardoByDateResult suma original + edited
app/api/dtos/resguardo.dtos.ts                  # MOD: nuevo RawResguardoValuesDto + GetResguardoByDateResponseDto extendido
app/application/queries/resguardo.queries.ts    # MOD: GetResguardoByDateHandler arma original/edited desde la entidad
app/application/mappers/resguardo.mappers.ts    # MOD: GetResguardoByDateMapper propaga original/edited
```

> El controller NO cambia (sigue devolviendo `GetResguardoByDateResponseDto`, solo con más campos). La query, el repo y la entidad NO cambian su lógica de fetch.

**Backend — test (AGREGAR/MODIFICAR):**

```
test/modules/resguardos/get-resguardo-by-date.e2e-spec.ts   # ADD o MOD: assert original + edited + resolved
```

**Frontend — `ms-logs-api/ui/src/` (1 MOD + 3 ADD/MOD):**

```
types/hydro.ts                                  # MOD: interfaces Resguardo / ResguardoByDate / RawResguardoValues
components/hydro/api.ts                          # MOD: getResguardosByStation, getResguardoByDate, updateResguardo
components/hydro/ResguardosTab.tsx               # ADD: tab espejo de StationsTab (tabla + modal edición)
components/hydro/HydroPanel.tsx                  # MOD: 4ta tab 'resguardos'
```

### Component Diagram (backend, by-date)

```
GET /resguardos/:stationCode/:date
  → ResguardoController.getByStationAndDate
    → GetResguardoByDateMapper.toQuery
      → CachingQueryBus.execute(GetResguardoByDateQuery)
        → GetResguardoByDateHandler
          → IStationRepository.findByStationCode
          → IStationResguardoRepository.findByStationIdAndDate   (entidad completa)
          → arma { original, edited, resolved }
        → GetResguardoByDateResult { stationCode, stationName, original, edited, resolved }
    → GetResguardoByDateMapper.toResponseDto → GetResguardoByDateResponseDto
```

## Data Model

Sin cambios. Entidad `StationResguardo` ya existente:

- `id` uuid PK, `stationId` uuid FK→Station (CASCADE), `date` date, `organismo` enum.
- Originales (inmutables): `originalReserveVolume`, `originalReserveLevel`, `originalMinimumVolume` (double precision, nullable).
- Editables: `reserveVolume`, `reserveLevel`, `minimumVolume` (double precision, nullable).
- Unique `(stationId, date)`.

**Migrations**: ninguna.

## API Contracts

### MODIFICADO — `GET /resguardos/:stationCode/:date`

Respuesta actual:
```json
{ "stationCode": "E_01", "stationName": "ENTREPEÑAS",
  "entry": { "minimumVolume": 51.15, "reserveVolume": 802.563, "reserveLevel": 718 } }
```

Respuesta nueva (extendida, retrocompatible — se mantiene `resolved`, se agregan `original` y `edited`):
```json
{
  "stationCode": "E_01",
  "stationName": "ENTREPEÑAS",
  "date": "2025-10-01",
  "original": { "reserveVolume": 802.563, "reserveLevel": 718, "minimumVolume": 51.15 },
  "edited":   { "reserveVolume": null,    "reserveLevel": null, "minimumVolume": null },
  "resolved": { "reserveVolume": 802.563, "reserveLevel": 718,  "minimumVolume": 51.15 }
}
```

- Nuevo DTO `RawResguardoValuesDto { reserveVolume, reserveLevel, minimumVolume: number | null }`.
- `GetResguardoByDateResponseDto`: agrega `date: string`, `original: RawResguardoValuesDto`, `edited: RawResguardoValuesDto`. Se renombra/duplica `entry` → `resolved` (mantener `resolved` como nombre claro; `entry` puede deprecarse o conservarse — decisión menor, ver Open Questions).
- Status: 200 OK; 404 si estación o fecha no existen (sin cambios).

### SIN CAMBIOS (usados por el frontend)

- `GET /resguardos/:stationCode?from&to&year` → tabla por fecha (resueltos). Lo consume la tabla.
- `PUT /resguardos/:stationCode/:date` body `{ reserveVolume?, reserveLevel?, minimumVolume? }` (number | null). Lo consume el guardar del modal. Ya invalida caché.

## Frontend (ms-logs-api/ui)

- **types/hydro.ts**: `RawResguardoValues { reserveVolume, reserveLevel, minimumVolume: number | null }`; `ResguardoByDate { stationCode, stationName, date, original, edited, resolved }`; `ResguardosByStation { stationCode, stationName, entries: Record<string, RawResguardoValues>, total }`.
- **api.ts** (sobre el `gatewayClient` existente):
  - `getResguardosByStation(stationCode, { from?, to? })` → `GET /resguardos/${stationCode}`.
  - `getResguardoByDate(stationCode, date)` → `GET /resguardos/${stationCode}/${date}`.
  - `updateResguardo(stationCode, date, payload)` → `PUT /resguardos/${stationCode}/${date}`.
- **ResguardosTab.tsx** (espejo de `StationsTab`):
  - Selector de estación obligatorio (reusar `listStations` + `SearchableSelect`). Query habilitada solo con estación elegida.
  - Header con conteo, filtro de rango de fecha (desde/hasta) opcional, búsqueda.
  - Tabla/lista por fecha mostrando `resolved` (minimumVolume, reserveVolume, reserveLevel).
  - Acción **única**: Editar (pencil). NO toggle, NO crear, NO borrar.
  - Modal de edición: al abrir, `getResguardoByDate` → muestra `original.*` como solo lectura y `edited.*` como inputs; guardar con `updateResguardo`. Vaciar un input envía `null`.
  - Invalidar `queryKey ['resguardos', stationCode]` tras guardar (React Query) además de la invalidación de caché del backend.
- **HydroPanel.tsx**: agregar `'resguardos'` al type `Tab`, a `TAB_LABELS` ('Resguardos'), al array de tabs y al render condicional.

## Cache

- Query `GetResguardoByDateQuery`: cacheada por `CachingQueryBus`. La extensión de la respuesta no cambia la clave, solo el payload cacheado.
- Invalidación: `UpdateResguardoHandler` ya ejecuta `delByPattern(ResguardoCacheKeys.byStation(stationCode))` + `delByPattern(ResguardoCacheKeys.pattern())`. **Verificar** que la clave de la query by-date cae bajo `pattern()` (`resguardo:*`); si no, agregar invalidación específica de by-date al handler. Esto satisface FR-010 / SC-003.

## Constitution Compliance

| Principle | Status | Notes |
|-----------|--------|-------|
| Hexagonal layers | ✅ | El cambio respeta api → application → domain; el handler ya está en application, el DTO en api, el Result en domain. |
| Ports as abstract classes | ✅ | Sin nuevos ports; se reutilizan `IStationResguardoRepository`, `IStationRepository`. |
| Entity validate() | ✅ (n/a) | No se crea ni persiste entidad nueva en el cambio by-date (es read). El update existente ya valida vía repo. |
| Tests via endpoints | ✅ | e2e con Testcontainers Postgres sobre `GET by-date`, verificando original/edited/resolved por HTTP. |
| Type safety & strictness | ✅ | DTOs y Result tipados, `number | null` explícito. |
| Structured error hierarchy | ✅ | 404 vía `ApiError` ya existente; sin cambios. |
| Cache invalidation manual | ✅ | Reutiliza `ResguardoCacheKeys`; se verifica cobertura by-date. |

Sin desviaciones → no se requiere sección "Complexity Justification".

## Migration Plan (orden de despliegue seguro)

1. **Backend**: mergear el cambio del `GET by-date` (retrocompatible: solo agrega campos). Deploy de `ms-hydro-api`. Como el monorepo sincroniza por subtree a `VSADTajo/ms-hydro-api` en push a `main`, el deploy lo dispara Jenkins.
2. **Frontend**: mergear `ms-logs-api/ui` con la tab Resguardos apuntando al contrato extendido. Deploy de `ms-logs-api`.
3. Orden recomendado: backend primero (el frontend depende del contrato extendido para el modal). El listado por estación funciona aun sin el cambio backend, pero el modal Original/Editado requiere el by-date extendido.
4. Sin backfill (no hay cambios de datos).

## Open Questions

1. **`entry` vs `resolved`**: ¿deprecamos el campo `entry` del by-date o lo mantenemos como alias de `resolved` por retrocompatibilidad? Como ningún cliente actual consume by-date, se puede renombrar limpio a `resolved`. **Propuesta: renombrar a `resolved`** (sin clientes que romper).
2. **Filtro de fecha en la tabla**: ¿filtrado client-side sobre las `entries` ya traídas, o re-fetch con `from/to` al backend? Para volúmenes de un año, client-side alcanza; el backend ya soporta `from/to` si se prefiere server-side. **Propuesta: server-side con `from/to`** (consistente con el contrato existente).
3. **Validación de valores editables**: ¿se exige rango (p. ej. ≥ 0) en el modal, o se delega al backend (`IsNumber`)? **Propuesta: validación mínima client-side (numérico) + confiar en backend.**
