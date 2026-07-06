# Observability Conventions

## Correlation IDs

Dos identificadores conviven en cada log/mensaje. **Ambos deben propagarse cross-service**.

| ID | Origen | Alcance | Header AMQP | Header HTTP | Log field |
|---|---|---|---|---|---|
| **`traceId`** | Generado por request/mensaje. Fuente única = CLS del middleware `TraceMiddleware`. | Uno por request HTTP o mensaje AMQP consumido. | `x-trace-id` | `x-trace-id` | `traceId` |
| **`simulationId`** | Business ID de una simulación manual (uuid). Set explícito en `POST /simulations/manual`. | Comparte valor entre TODOS los mensajes/logs del mismo ciclo de simulación. | `x-simulation-id` | — | `simulationId` |

**Regla de propagación (obligatoria)**:
- Todo consumer AMQP LEE `x-trace-id` (y `x-simulation-id` si aplica) del header y los bindea al logger context (CLS) al inicio del handler. Todos los logs producidos durante el handler llevan ambos IDs.
- Todo publisher AMQP incluye los headers apropiados en el mensaje que publica.
- Todo cliente HTTP downstream (axios via `TracedHttpClient`) propaga `x-trace-id` (y `x-simulation-id` cuando esté en contexto).

Ver también [`docs/logging-standard.md`](../../docs/logging-standard.md) que describe el estándar de `traceId` en detalle.

## Structured logging (JSON)

Cada línea de log DEBE ser JSON con estos campos mínimos:

- `ts` — timestamp ISO-8601 UTC.
- `level` — `error | warn | info | debug`.
- `service` — nombre del servicio (`ms-model-api`, `ms-calculator-api`, ...).
- `event` — evento discreto (`consumer.message.received`, `publisher.published`, `pipeline.completed`, ...).
- `traceId` — cuando exista contexto.
- `simulationId` — cuando exista contexto.
- `msg` — mensaje humano.

Servicios NestJS: usar `nestjs-pino` con `nestjs-cls` (patrón existente).
Servicios Python (ms-calculator-api): usar `structlog` con `contextvars` (`bind_contextvars(simulation_id=..., trace_id=...)`).

**Prohibido**: `console.log`, `print()`, tracebacks crudos sin `event`.

## Naming convention de eventos AMQP

Formato: `<dominio>.<subdominio>.<verbo_en_pasado>`.

Ejemplos válidos:
- `simulation.manual.dispatched`
- `simulation.manual.output.fetched`
- `simulation.manual.balance.computed`
- `simulation.manual.balance.failed`
- `timeseries.ingested`

Sub-scoping por routing key. Un solo exchange topic por dominio (ej: `simulation-events`, `model-events`).

## Queues y bindings

- Toda queue tiene `durable=true`.
- Todo consumer usa `manual ack` (no auto-ack).
- Prefetch controlable via `RABBITMQ_PREFETCH` env (default 10).
- Nombres de queue son propietarios del consumer: `<serviceName-shortened>-<subject>` (ej: `predictions-simulation-manual-balance`, `calculator-simulation-manual-output`).

## Dead Letter Exchange (DLX)

Para queues involucradas en flujos críticos (todo el pipeline de simulación manual), configurar DLX:

**Policy a aplicar en `infra-rabbitmq`** (ejecutar una vez por ambiente):

```bash
docker exec infra-rabbitmq rabbitmqctl set_policy simulation-events-dlx \
  '^(calculator-simulation-manual-output|predictions-simulation-manual-balance)$' \
  '{"dead-letter-exchange":"simulation-events-dlx","message-ttl":86400000}' \
  --apply-to queues
```

Además crear el exchange DLX + queue catch-all:

```bash
docker exec infra-rabbitmq rabbitmqadmin declare exchange \
  name=simulation-events-dlx type=topic durable=true

docker exec infra-rabbitmq rabbitmqadmin declare queue \
  name=simulation-events-dead-letters durable=true

docker exec infra-rabbitmq rabbitmqadmin declare binding \
  source=simulation-events-dlx destination=simulation-events-dead-letters routing_key='#'
```

Un script convenience está en [`scripts/rabbitmq-setup-dlx.sh`](../../scripts/rabbitmq-setup-dlx.sh) — idempotente, se puede correr en cualquier ambiente.

**Inspección de la DLQ**:

```bash
# Ver mensajes en la DLQ
docker exec infra-rabbitmq rabbitmqadmin get \
  queue=simulation-events-dead-letters count=10 ackmode=ack_requeue_true

# O via management UI
open http://infra-rabbitmq:15672   # → Queues → simulation-events-dead-letters
```

## Alertas propuestas (roadmap)

- **DLQ depth > 0** sostenido más de 5 min → escalar a on-call.
- **Queue depth > 20** en `calculator-simulation-manual-output` o `predictions-simulation-manual-balance` → posible consumer caído.
- **Error rate > 1%** publicando `simulation.manual.balance.failed` → problema sistemático en el calculator.
- **Latencia end-to-end > 10 min** (dispatch → predictions persistidas) → SLA breach.
- **Health check falla > 3 min** en `ms-calculator-api` → paged.

Implementación queda como TODO (fuera del scope del feature original — depende de infra de monitoring).

## Trazabilidad de una simulación específica

Query en `ms-logs-api` (MongoDB):
```javascript
db.logs.find({ 'meta.simulationId': '<uuid>' })
       .sort({ ts: 1 })
       .limit(100)
```

Devuelve todos los logs de todos los servicios, cronológicamente, para esa simulación. Ver el [runbook](../../docs/runbooks/manual-simulation-runbook.md#trace-de-una-simulacion) para más detalle.
