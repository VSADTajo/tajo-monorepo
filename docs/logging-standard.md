# Estándar de Logging — VSAD Tajo

> Estado: **PROPUESTA (Fase 0)** — pendiente de aprobación de Seba.
> Objetivo: garantizar consistencia de los logs del sistema (trace-id punta a punta, metadata útil, sin falsos positivos de alertas, sin fugas de datos sensibles).

## 1. Diagnóstico (estado actual, verificado)

Análisis sobre los 9 servicios NestJS + `tajo-toolkit` + `ms-logs-api`. Todo lo de abajo es reproducible con los comandos indicados.

| # | Hallazgo | Evidencia |
|---|----------|-----------|
| 1 | El remap `entity → meta.domain` **ya existe** en la toolkit (entity siempre = serviceName) | `tajo-toolkit/src/pino-logs-api-transport.ts:58-66` |
| 2 | **Trace roto en el ingreso**: el `correlationId` que se persiste es el `req.id` de pino-http, que en requests sin `x-trace-id` entrante **diverge** del `traceId` del CLS que se propaga a downstream | `trace.middleware.ts:32` (solo setea response, no reinyecta en req) + `pino-logs-api-transport.ts:47` |
| 3 | **Dos shippers de logs en paralelo** a ms-logs-api con ids distintos: el pino transport (`correlationId=req.id`) y `TraceMiddleware.shipLog` (`correlationId=traceId` del CLS) | `pino-logs-api-transport.ts:83` + `trace.middleware.ts:44-78` |
| 4 | Los requests **2xx no se persisten** (se loguean `debug` y el transport está fijo en `info`) | `customLogLevel` en cada `app.module.ts` + transport `level:'info'` |
| 5 | `'debug'` **no existe** en el enum del schema → logs debug rechazados en silencio | `ms-logs-api/src/collections/log.collection.ts:5` |
| 6 | Solo **2 de 9** servicios meten el trace-id en cada línea de log (`mixin`) | `rg -l mixin ms-*/src/app.module.ts` → model, predictions |
| 7 | `ms-sftp-api` usa header `x-correlation-id`; los otros 8 usan `x-trace-id` | `rg "CORRELATION_ID_HEADER = '" ms-*/src/app.module.ts` |
| 8 | **3 versiones distintas** de la toolkit corriendo en producción (causa raíz de la inconsistencia) | ver tabla abajo |

### Versiones de `tajo-toolkit` desplegadas

Comando: `rg -o 'tajo-toolkit.git#[a-f0-9]+' ms-*/package-lock.json | sort -u`

| Commit | Fecha | remap entity→domain | Servicios |
|--------|-------|---------------------|-----------|
| `6d4e0476` | 2026-05-24 18:57 | ✅ SÍ | gateway, user, authentication, sftp, hydro, meteo (6) |
| `b50c31bc` | 2026-05-25 12:04 | ✅ SÍ | predictions, model (2) |
| `11656caf` | 2026-05-24 16:49 | ❌ NO | **notifications (1) — versión vieja** |

> Pendiente de Seba: ¿en qué servicio/log vio `entity:'Auth'`? Si fue en `notifications`, es la versión vieja (`11656caf`). Si fue en gateway/auth, el transport ya lo remapea → el origen sería otro (exception filter o logs históricos).

## 2. El estándar

### 2.1 Identidad del log
- `entity` = **nombre del servicio** (`ms-gateway-api`). Nunca la ruta.
- El dominio funcional de la ruta (`auth`, `users`) va en `meta.domain`.
- `source` = mismo serviceName.

### 2.2 Trazabilidad (trace-id) — **una sola fuente de verdad**
- El `traceId` del CLS (`x-trace-id`) es el ÚNICO identificador.
- El middleware debe **reinyectar** `x-trace-id` en `req.headers` para que pino-http use el mismo id (elimina la divergencia del Hallazgo #2).
- `correlationId` persistido = `traceId` del CLS, siempre.
- **Un solo shipper** de logs hacia ms-logs-api (eliminar la duplicación del Hallazgo #3).
- Propagación obligatoria: HTTP (axios, ya lo hace `TracedHttpClient`) **y RabbitMQ** (hoy solo lo hace `ms-model-api`).

### 2.3 Niveles (anti falsos positivos)
- `5xx` o error → `error`
- `4xx` → `warn`
- `2xx/3xx` → `info`
- **DECISIÓN PENDIENTE**: ¿se persisten los 2xx en ms-logs-api? Recomendación: **sí, resumido** (method, path, status, duration, traceId) para poder monitorear tráfico normal, no solo errores.

### 2.4 Seguridad de la metadata
- **NUNCA** loguear el body crudo del request (choca con el commit `af05b9b` que justo lo removió: exponía passwords/PII).
- Metadata por **allowlist** (campos explícitamente permitidos).
- `redact` de pino sobre campos sensibles: `password`, `token`, `authorization`, `secret`, etc.

### 2.5 Schema / enum
- Alinear niveles del transport con el enum de `ms-logs-api`. O se agrega `debug` al enum, o el transport no emite `debug` al colector (consistente con 2.3).

### 2.6 Distribución de la toolkit (causa raíz)
- Versionar `tajo-toolkit` con **semver real + git tags** (hoy está clavada en `1.0.0`).
- Cada servicio **pinnea una versión/tag** en `package.json` (hoy usan `github:VSADTajo/tajo-toolkit` sin pin → deriva).

### 2.7 Centralización
- Toda la config de pino (mixin, customLogLevel, transport, redact, genReqId) vive en un **`TajoLoggerModule.forRoot()`** dentro de la toolkit.
- Cada servicio lo invoca; se elimina el copy-paste de los 9 `app.module.ts`.

## 3. Plan de implementación (fases)

| Fase | Qué | Riesgo |
|------|-----|--------|
| 1 | Toolkit: `TajoLoggerModule.forRoot()` (mixin + customLogLevel + transport único + redact + reinyección de header) + tests | Bajo |
| 2 | Piloto en `ms-gateway-api`, validación end-to-end real | Bajo |
| 3 | Roll-out paralelo a los otros 8 (SSP waves, `[P]`) — incluye fix de `sftp` (header) y `notifications` (versión) | Medio |
| 4 | Propagación de trace-id por RabbitMQ en todos | Medio |
| 5 | Verificación cross-service: un `correlationId` único atraviesa toda la cadena | — |

Más: versionar la toolkit (2.6) antes del roll-out, para que el pin tenga sentido.

## 4. Estado de implementación

Rama: `refactor/logging-consistency`.

| Fase | Estado | Detalle |
|------|--------|---------|
| 1 — Toolkit (`buildPinoOptions`) | ✅ hecho | mixin trace-id, niveles, redact, transport único; 17 unit tests |
| 2 — Piloto `ms-gateway-api` | ✅ hecho | typecheck limpio |
| 3 — Roll-out 9 servicios | ✅ hecho | sin config copy-pasteada; sftp normalizado |
| 4a — Trace saliente RMQ | ✅ hecho | 7/7 services attach `x-trace-id` en publish |
| 4b — Trace entrante RMQ | ✅ hecho | 4/4 consumers continúan el trace vía `runInContext` |
| 5 — Versionado toolkit | 🔶 parcial | bump a `1.1.0` hecho; **pin en servicios + publicación al repo = pendiente operativo (ver abajo)** |

### Verificado por
- Tipos (`tsc --noEmit`) en toolkit + 9 servicios.
- 17 unit tests de la toolkit (mapeo, niveles, correlationId, redact, mixin).

### Pendiente — operativo (requiere acceso a infra / Docker)
1. **Publicar la toolkit**: sincronizar `tajo-toolkit` al repo `VSADTajo/tajo-toolkit` y crear el tag `v1.1.0`.
2. **Pinnear** en los 9 `package.json`: `"tajo-toolkit": "github:VSADTajo/tajo-toolkit#v1.1.0"` + `npm install` para fijar el commit en cada lock.
3. **Verificación end-to-end** (levantar el stack): disparar un flujo que cruce gateway → hydro → (evento RMQ) → consumer, y confirmar en `ms-logs-api` que un único `correlationId` atraviesa toda la cadena, que los 4xx son `warn` y que no hay PII en los logs.

### Decisiones tomadas
- `2xx` se persisten como `info` (reversible si el volumen molesta).
- `entity` = serviceName; el dominio de la ruta va a `meta.domain`.
- `correlationId` = trace-id del CLS, único, propagado por HTTP y RabbitMQ.
