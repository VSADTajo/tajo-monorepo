# Análisis — Sección de Predicciones y Types en el Backoffice

> **Estado:** análisis previo a implementación (sin código todavía).
> **Rama:** `feature/backoffice-predictions-section`
> **Fecha:** 2026-06-23

## Ticket

> Implementar en backoffice una sección que nos permita ver **todos los datos de las
> predicciones** y **todos los types disponibles**.
>
> Nota de Sebastian: *"creo que podríamos usar lo que ya hay en el gateway"*.

## Conclusión rápida

- El **backend ya cubre el ticket**: el gateway expone los endpoints de predicciones y de
  prediction-types (verificado en prod). Sebastian tiene razón.
- La sección de frontend **ya existe pero está deshabilitada** (comentada) en el backoffice.
- El trabajo real es **frontend** + una **decisión de arquitectura** sobre la fuente de datos.

## Dónde es el "backoffice"

`ms-logs-api/ui` — la app React 18 servida en `:3005` (la "Logs UI", el mismo panel donde
validamos las PRs en prod: http://65.21.97.113:3005).

- Navegación por estado `activePanel` en `ms-logs-api/ui/src/App.tsx` (no react-router para los
  paneles internos).
- Sidebar: `ms-logs-api/ui/src/components/Sidebar.tsx`.
- Paneles **activos** hoy: `logs` (Dashboard), `alerts`, `administration`, `hydro`.

## Hallazgo #1 — La sección ya está construida, pero apagada

En `App.tsx` están **comentados** los imports y los `case` de varios paneles, con el comentario:

> `// Solo se muestra la sección de Logs; el resto comentado para no romper nada`

Archivos ya existentes (deshabilitados):

- `ms-logs-api/ui/src/components/predictions-data/PredictionsDataPanel.tsx` (~25 KB)
- `ms-logs-api/ui/src/components/predictions-data/PredictionResultsTable.tsx`
- `ms-logs-api/ui/src/components/predictions-data/api.ts`
- `ms-logs-api/ui/src/components/forecasts/` (panel de forecasts completo)

## Hallazgo #2 — El backend ya cubre el ticket (vía gateway)

`ms-gateway-api/src/app/api/controllers/predictions-proxy.controller.ts` proxea a
`ms-predictions-api`:

| Endpoint (gateway) | Para qué |
|---|---|
| `GET /prediction-types` | **Todos los types disponibles** (cacheado) |
| `GET /predictions/available-dates` | Fechas disponibles |
| `GET /predictions/max-and-latest-values` | Máximos y últimos valores |
| `GET /predictions/historical` | Histórico |
| `GET /predictions/forecast` | Pronóstico |
| `POST /prediction-types` | Alta de type |

Entidades en `ms-predictions-api`: `prediction_types` (`name`, `unit`), `prediction_results`,
`predictions`.

**Verificado en prod (2026-06-23):**

- `GET /prediction-types` → `P.ens.forecast`, `P.harmonie.forecast`, `Q.NAM.harmonie`,
  `I.NAM.harmonie`, `Q.NAM.ens`, `I.NAM.ens(.medio)`, `FICT98.historical`, ... (cada uno con
  `id`, `name`, `unit`).
- `GET /predictions/available-dates` → `200` (fechas en formato `YYYYMMDDHHmmss`).

## El nudo — dos fuentes de datos distintas

El panel existente **no** usa el gateway. Esta es la diferencia que hay que resolver:

| | Panel actual (apagado) | Propuesta de Sebastian (gateway) |
|---|---|---|
| Pega a | `apiClient` (ms-logs-api `:3004` `/api`) → router `/api/predictions-data` → **API Python externa** `http://37.27.133.251:8000/api/v1/*` (env `PREDICTIONS_SIMULATIONS_API_URL`) | `ms-predictions-api` vía gateway |
| Types | **Hardcodeados**: `Discharge_forecast`, `resultType` ∈ `wrf`/`ecmwf`/`historical` | **Dinámicos** vía `GET /prediction-types` |
| Modelo de datos | `sub_basin`, `percentile`, `discharge`, `station_name` | `name`/`unit`, `available-dates`, `forecast`, `max-and-latest-values` |

Son **dos backends con modelos de datos diferentes**. Reapuntar el panel al gateway **no** es
cambiar una URL: cambian estructuras, filtros y el render de la tabla.

Dato útil: en el UI **ya existe un cliente hacia el gateway** —
`ms-logs-api/ui/src/components/administration/api.ts` usa `VITE_URL_API_GATEWAY`
(`http://65.21.97.113`). Ese patrón se reutiliza para pegarle al gateway desde esta sección.

## Decisiones pendientes (del usuario)

1. **Fuente de datos:** ¿la sección consume el **gateway/ms-predictions-api** (propuesta de
   Seba, dejando de lado la API Python externa), se **mantiene la API Python**, o es **híbrido**?
2. **Reuso vs. nuevo:** ¿se **adapta** el `PredictionsDataPanel` existente, o se hace uno
   **nuevo** con selector de types **dinámico** alimentado por `GET /prediction-types`?

## Próximos pasos (una vez decidido el rumbo)

1. Reactivar el panel en `App.tsx` + entrada en `Sidebar.tsx`.
2. Cliente de datos según la fuente elegida (reusar `gatewayClient` si es gateway).
3. Selector de types dinámico desde `GET /prediction-types`.
4. Tabla/visor de datos de predicciones (filtros por type, fecha, estación/cuenca).
5. Verificación en prod contra los endpoints reales.
