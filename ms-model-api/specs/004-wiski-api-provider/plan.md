# Plan: proveedor WISKI API (observados) en ms-model-api

Estado: **implementado**. Fecha: 2026-08-25.

> Lo que sigue era el plan original; queda como registro del diseño. **Dos cosas cambiaron
> durante la implementación**, y esta nota manda sobre el resto del documento:
>
> 1. **No hay catálogo.** La §4.2 proponía una tabla `wiski_variable_catalog` sembrada desde el
>    CSV. Al validar contra el `Tagus_FlowCast.csv` real resultó innecesaria: el corte de la
>    variable se deduce con una regla (cortar antes del primer código de instrumento conocido:
>    `FICT`, `VICT`, `WI__`, `FI__`) que acierta **389 de 389** series solapadas, y la unidad se
>    deduce del mismo código (`WI__`→mm, `FICT`/`FI__`→m³/s, `VICT`→Hm3, sin excepciones en los
>    429 bloques del CSV). Se fueron la tabla, la migración, el repositorio, el servicio de
>    sincronización, los endpoints y la pestaña del backoffice. Queda una única migración: la del
>    CHECK del enum, que era inevitable.
> 2. **`stationName`, `lat` y `lon` van vacíos.** Nadie aguas abajo los usa: `ms-predictions-api`
>    solo lee `locationId`, `parameterId` y `units`.
>
> Entregado: `ProviderType.WISKI_API` + `WiskiApiProviderService` + `wiski-json.mapper` +
> `MockWiskiController`, `VOBS_SOURCE=SFTP_CSV|WISKI_API` para el v.obs de la simulación manual,
> proxy `/model/*` en `ms-gateway-api` y pantalla «Proveedores» en el backoffice.
>
> Verificado: 163 unitarios + 30 e2e en ms-model-api, 32 + 36 en el gateway, backoffice compila.
> El `response.json` real (267.510 lecturas) pasa entero: 456 series, 0 descartadas, 0 timestamps
> inválidos, 6,3 s, **22,1 MB en un solo mensaje AMQP**.
>
> **No verificado**: el endpoint real (su host no resuelve fuera de su red) y la pantalla contra
> el stack levantado. Las preguntas de la §7 siguen abiertas, y dos ya tienen datos: el endpoint
> trae 67 series que el CSV no, y el CSV trae 40 que el endpoint no — **no es un reemplazo 1 a 1**.
Endpoint objetivo: `https://apisaih.saihchtajo.es/wiski/tagus_flowcast_observado/`
Muestra analizada: `response.json` (23,7 MB, 267.510 registros, 456 series, ventana 2026-08-11 → 2026-08-21).

---

## 1. Dónde vive hoy la integración (hallazgos del repo)

Todo lo relevante está en **`ms-model-api`**. Hay dos ejes independientes que conviene no mezclar:

### Eje 1 — Ingestión de datos (de dónde entran las series)

`ProviderConfig` (tabla `provider_configs`) + `ProviderType` + `DataProviderFactoryService`:

| ProviderType | Servicio | Origen |
|---|---|---|
| `FEWS_API` | `fews-api-provider.service.ts` | GET PI-JSON al PI REST de FEWS |
| `SFTP_FILE` | `sftp-file-provider.service.ts` | JSON en el SFTP (`Q_mod_input_*.json`) |
| `CSV_FILE` | `csv-file-provider.service.ts` | **CSV WISKI en el SFTP (`Tagus_FlowCast*.csv`)** ← lo que sustituye el endpoint nuevo |

Flujo: `ProviderSchedulerService` (intervalo por config) → `ExecuteIngestionCommand` → `factory.getProvider(type).fetch(config)` → `NormalizedTimeSeriesResult[]` → publica `model-events / timeseries.ingested` → lo consume `ms-predictions-api` (`TimeSeriesIngestedConsumer`). Cada corrida queda en `ingestion_runs`.

Activación/desactivación en caliente: `PATCH /provider-configs/:id/toggle` → `registerJob` / `removeJob` en el scheduler. **No hace falta desplegar para suplantar el SFTP: se apaga el `CSV_FILE` y se enciende el `WISKI_API`.**

### Eje 2 — Enriquecimiento v.obs de la simulación manual

`SimulationResultFetcher.fetchVobsSeries()` baja el CSV WISKI del SFTP (`VOBS_CSV_SFTP_PATH`), lo parsea con `wiski-csv-parser.ts` (`parseWiskiCsv`, luxon, tz `VOBS_CSV_TIMEZONE=Europe/Madrid`) y `SimulationRunPoller.toCalculatorPayloadShape()` mezcla esas series con la salida del modelo en el payload que va a `ms-calculator-api`. Requisito duro ya documentado en el código: **el `parameterId` va verbatim**, nunca reconstruido.

Este eje también depende hoy del SFTP y también puede pasar al endpoint.

### Cómo se hizo la conexión con FEWS (patrón a replicar)

Commits `aa0a6a7` (cliente PI REST) y `4a4c3e6` (cablearlo como tercer `modelSource`), más `218794a`/`d774b72`/`3b38770` (correcciones del contrato). Lo que dejaron establecido y aquí se copia tal cual:

1. **Config tipada y propia** (`src/configuration/fews-api/`): base URL, paths configurables por env, credenciales opcionales, timeouts. Falta de configuración → error explícito **antes** de la primera llamada HTTP, nunca cuelgue.
2. **Cliente HTTP aislado** (`fews-task-client.service.ts`) con unit test que mockea `axios`. Estado no documentado = error, jamás "éxito asumido".
3. **Mapper compartido** (`pi-json.mapper.ts`): los dos caminos (fichero y API) leen el mismo payload con el mismo código, para que no diverjan.
4. **Doble de test dentro del proceso** (`MockFewsController` + `MockFewsTaskStoreService`, `@ApiExcludeController`) porque no había instancia real accesible. Ejercita el cliente real sobre HTTP real.
5. **Selector explícito** (`ModelSource = 'SFTP' | 'MOCK' | 'FEWS_API'`) persistido en la corrida, con default `SFTP` y migración idempotente.

### Tests existentes (estado de partida)

- 14 specs unitarios en `src/` (`wiski-csv-parser.spec.ts`, `fews-task-client.service.spec.ts`, `simulation-run-poller.service.spec.ts`, `mock-fews-roundtrip.spec.ts`, …). Estilo: `jest.mock('axios')`, fixtures inline, sin red.
- e2e con Testcontainers en `test/modules/{provider-config,ingestion-run,simulation-run}`; `csv-ingestion.e2e-spec.ts` es el molde exacto para el nuevo proveedor (crea config → dispara ingesta → verifica publicación en el broker mockeado).
- Factories en `test/factories/provider-config.factory.ts` (`buildCreateCsvProviderConfigDto`).

---

## 2. Qué trae (y qué no trae) el JSON de WISKI

```json
[{"variable":"A005WI__01.Total.Horario","lastchange":"2026-08-21T10:00:00","value":0.0}, ...]
```

Medido sobre la muestra:

| Hecho | Valor |
|---|---|
| Registros | 267.510 |
| Series distintas (`variable`) | 456 |
| Cadencia | 223 series a 15 min, 233 series horarias |
| Ventana | ~10 días móviles (2026-08-11 → 2026-08-21) |
| Orden | descendente por `lastchange` dentro de cada serie |
| Tamaño | 23,7 MB por respuesta completa |
| Familias de nombre | `WI__01.Horario` (203), `FICT98.Validado` (72), `VICT01.Validado` (52), `FICT95.Validado` (51), `FICT99.Validado` (28), `WI__01.Total.Horario` (24), `FICT99_Calculado` (19), + variantes `MD/MI/IIB/IIIB/A/B` |

**`variable` = `<Número de la estación>` + `<Nombre de la serie temporal>` concatenados sin separador.** Verificado contra el CSV: `E_08` + `VICT01.Validado` → `E_08VICT01.Validado`; `AR35` + `FICT98.Validado` → `AR35FICT98.Validado`.

Lo que el JSON **no** trae y el CSV sí: `Nombre de la estación`, `Unidad de la serie temporal`, `Latitud/Longitud`, `LocalX/LocalY`, y la separación estación/serie. Tampoco trae zona horaria ni marca de dato ausente (`---` en el CSV).

**Este es el riesgo central del feature.** Si el `locationId`/`parameterId` no salen idénticos a los del camino CSV, la calculadora no casa las señales y la simulación termina "OK" sin v.obs — exactamente el fallo silencioso que ya se pagó antes en esta cadena.

---

## 3. Bloqueante de red (hay que resolverlo fuera del código)

`apisaih.saihchtajo.es` **no resuelve en DNS público** (comprobado). No es solo filtrado por IP: el nombre solo existe en su red. La VM de producción es Hetzner (65.21.97.113), fuera de esa red.

Opciones, por orden de preferencia:

1. Que publiquen el host en DNS público y hagan whitelist de la IP de la VM.
2. Túnel/VPN desde la VM a su red (WireGuard/IPsec), con el host resuelto por DNS interno.
3. Un salto dentro de su red que reexponga el endpoint (si ya hay un equipo suyo que empuja al SFTP, sirve el mismo).

Mientras no exista ninguna, el proveedor se desarrolla y valida contra el **mock local** (paso 4.4) y en local con VPN. El código no cambia después: solo cambia `baseUrl`.

---

## 4. Diseño

### 4.1 Nuevo `ProviderType.WISKI_API`

`WiskiApiProviderService implements IDataProvider` — misma firma que los otros tres, entra por la factory, no toca ni el scheduler ni el comando de ingestión ni el evento publicado.

`settings` (JSONB) de la `ProviderConfig`:

```json
{
  "endpointPath": "/wiski/tagus_flowcast_observado/",
  "sourceTimezone": "Europe/Madrid",
  "sinceHours": 48,
  "variablePrefixes": [],
  "onUnknownVariable": "skip"
}
```

`baseUrl` = `https://apisaih.saihchtajo.es`. Timeout, reintentos y tamaño máximo por env (`WISKI_API_*`), igual que `FEWS_*`.

### 4.2 Catálogo de variables (la pieza que decide si esto funciona)

Tabla nueva `wiski_variable_catalog`:

| Columna | Origen |
|---|---|
| `variable` (PK lógica, unique) | `A005WI__01.Total.Horario` |
| `locationId` | `Número de la estación` del CSV |
| `parameterId` | `Nombre de la serie temporal` del CSV (verbatim) |
| `stationName`, `units`, `lat`, `lon`, `x`, `y` | cabecera del CSV |
| `timeStepUnit`, `timeStepMultiplier` | cadencia observada / tipo de parámetro |

Se siembra **una vez** desde el `Tagus_FlowCast.csv` que ya recibimos por SFTP (comando interno `POST /wiski-catalog/sync-from-csv`, reutilizando `parseWiskiCsv`), y se refresca con el mismo comando cuando ellos añadan estaciones. Así la paridad con el camino CSV es por construcción, no por heurística.

`onUnknownVariable`:
- `skip` (default): la serie no catalogada se descarta con WARN y se cuenta en la corrida. Nunca se inventa un `locationId`.
- `heuristic`: corte por gramática de nombres (`(FICT|VICT|WI__)\d+`) como red de emergencia, marcando la serie como derivada.

Lo ideal es no necesitar nada de esto: **pedir a Idrica que el endpoint devuelva `estacion` y `serie` en campos separados, o exponga un endpoint de metadatos.** Si lo hacen, el catálogo queda solo para units/coords.

### 4.3 Mapeo → `NormalizedTimeSeriesResult`

Un único mapper `wiski-json.mapper.ts` (espejo de `pi-json.mapper.ts`), usado por los dos consumidores:

- agrupa por `variable`, ordena ascendente por `lastchange`;
- `lastchange` se interpreta en `sourceTimezone` y se convierte a UTC (luxon, como el parser CSV);
- `value` `null`/`NaN`/`-999` → `isMissing: true`, `flag: 8` (idéntico a `CsvEvent`);
- `locationId`, `parameterId`, `stationName`, `units`, coords y `timeStep` salen del catálogo;
- `startDate`/`endDate` del primer y último evento; `forecastDate` = `startDate` (como hace `CSV_FILE`).

Y `toWiskiTimeSeriesResults()` para el eje 2, que devuelve la misma forma que `parseWiskiCsv` (`date`/`time`/`value` string/`flag`), de modo que el poller y la calculadora no se enteran del cambio de origen.

### 4.4 Doble de test: `MockWiskiController`

`@ApiExcludeController`, ruta `/__mock-wiski/tagus_flowcast_observado`, sirviendo un recorte del `response.json` real (2 estaciones × 2 series × 48 h, ~40 KB, versionado como fixture). Permite un roundtrip HTTP real sin su red, igual que `MockFewsController`. `baseUrl` de la config apunta al propio servicio.

### 4.5 Eje 2: selector de origen para v.obs

`VOBS_SOURCE = SFTP_CSV | WISKI_API` (default `SFTP_CSV`). `SimulationResultFetcher.fetchVobsSeries()` elige cliente según el valor. Se mantiene el comportamiento tolerante actual: cualquier fallo → WARN y `null`, la simulación sigue sin enriquecimiento.

---

## 5. Tareas (orden TDD; `[P]` = paralelizable)

**Fase 0 — contrato**
- T001 Confirmar con Idrica/CHTajo las preguntas de la §7 (bloquea T010 y la puesta en producción, no el desarrollo).

**Fase 1 — catálogo**
- T002 `[TEST]` unit: `wiski-variable-catalog` — resolución exacta, variable desconocida, modo heurístico.
- T003 Entidad `WiskiVariableCatalogEntry` + `validate()` + puerto `IWiskiVariableCatalogRepository` + repositorio TypeORM.
- T004 Migración `create-wiski-variable-catalog-table`.
- T005 `[TEST]` e2e: `POST /wiski-catalog/sync-from-csv` siembra el catálogo desde un CSV de fixture.
- T006 Comando `SyncWiskiCatalogFromCsvCommand` + endpoint + registro en módulos.

**Fase 2 — mapper**
- T007 `[TEST]` unit `wiski-json.mapper.spec.ts`: agrupación, orden ascendente, tz Madrid verano/invierno, `-999`/`null` → missing, `parameterId` verbatim, serie sin catálogo descartada.
- T008 `wiski-json.mapper.ts` (`toNormalized` + `toWiskiTimeSeriesResults`).

**Fase 3 — proveedor**
- T009 `[TEST]` unit `wiski-api-provider.service.spec.ts` con `jest.mock('axios')`: 200 feliz, 401/500 → `ProviderError`, timeout, respuesta vacía, payload no-array.
- T010 `WiskiApiProviderService` + `src/configuration/wiski-api/` (config, type, service) con fallo explícito si falta `baseUrl`.
- T011 `ProviderType.WISKI_API` + migración del CHECK de `provider_configs.type` (patrón `1771553100000`) + alta en `DataProviderFactoryService` + `infrastructure.module.ts`.
- T012 `[P]` `MockWiskiController` + fixture recortada + `mock-wiski-roundtrip.spec.ts`.
- T013 `[TEST]` e2e `wiski-ingestion.e2e-spec.ts` (molde: `csv-ingestion.e2e-spec.ts`): crear config `WISKI_API` → `POST /:id/trigger` → publica `timeseries.ingested` con los contadores correctos; toggle on/off.
- T014 `[P]` `buildCreateWiskiProviderConfigDto` en la factory.

**Fase 4 — v.obs**
- T015 `[TEST]` unit: `fetchVobsSeries` con `VOBS_SOURCE=WISKI_API` devuelve la misma forma que el CSV; error → `null` + WARN.
- T016 `VOBS_SOURCE` en `app-config` + rama en `SimulationResultFetcher`.

**Fase 5 — cierre**
- T017 `[P]` `.env.example`, `docker-compose.apps.yml`, `README.md` de ms-model-api, `docs/flows/manual-simulation.md`.
- T018 Runbook de corte: sembrar catálogo → crear config inactiva → `trigger` manual → comparar series/eventos contra la última corrida `CSV_FILE` → toggle WISKI on / CSV off.

---

## 6. Configuración nueva

```
## WISKI API (observados) — suplanta al CSV por SFTP
WISKI_API_BASE_URL=https://apisaih.saihchtajo.es
WISKI_API_PATH=/wiski/tagus_flowcast_observado/
WISKI_API_TIMEZONE=Europe/Madrid
WISKI_API_REQUEST_TIMEOUT_MS=120000
WISKI_API_MAX_RESPONSE_BYTES=52428800
WISKI_API_USERNAME=
WISKI_API_PASSWORD=

## Origen del enriquecimiento v.obs de la simulación manual
VOBS_SOURCE=SFTP_CSV   # SFTP_CSV | WISKI_API
```

Migraciones: `create-wiski-variable-catalog-table`, `add-wiski-api-provider-type` (ambas idempotentes, `IF NOT EXISTS` / drop+add del CHECK).

---

## 7. Preguntas abiertas para Idrica / CH Tajo

1. **Acceso**: ¿publican el host en DNS público + whitelist de `65.21.97.113`, o montamos VPN? Hoy el nombre no resuelve fuera de su red.
2. **Filtro temporal**: ¿acepta `?desde=/hasta=` o `?ultimas_horas=`? Sin filtro cada consulta baja 23,7 MB de ventana completa.
3. **Zona horaria de `lastchange`**: ¿hora local peninsular o UTC? Un error aquí desplaza todo 1–2 h sin dar ningún síntoma.
4. **Estación y serie separadas**: ¿pueden devolver `estacion` + `serie` en campos propios, o un endpoint de catálogo con nombre de estación, unidades y coordenadas? Ahorra toda la tabla de catálogo.
5. **Dato ausente**: ¿cómo viaja? (`null`, `-999`, ausencia de registro). En la muestra no aparece ninguno.
6. **Autenticación y límites**: ¿token/basic auth? ¿rate limit? ¿frecuencia de poll aceptable?
7. **Cobertura**: ¿las 456 series del endpoint son exactamente las del `Tagus_FlowCast.csv`? Si no, cuáles sobran o faltan.

---

## 8. Criterio de aceptación

Con el `CSV_FILE` y el `WISKI_API` apuntando al mismo periodo, una corrida de cada uno produce el **mismo conjunto de `(locationId, parameterId)`** y los mismos valores por timestamp (tolerancia 0). Mientras eso no se demuestre en una comparación real, el `WISKI_API` no se activa en producción.
