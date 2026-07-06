# Runbook — Flujo de simulación manual (con calculadora)

> On-call reference. Diagnóstico + acciones frecuentes. Última actualización: introducción del team `calculator-integration` (2026-07).

## TL;DR

- El flow pasa por 3 servicios: `ms-predictions-api` (crea simulación) → `ms-model-api` (poll SFTP output + calculator hop) → `ms-calculator-api` (compute balance) → `ms-predictions-api` (persist).
- Feature flag `USE_CALCULATOR_PIPELINE=true` en ms-model-api activa el hop del calculator. Rollback = flag OFF + restart de ms-model-api.
- Correlation ID de negocio = `simulationId`. Correlation ID técnico = `traceId`. Ambos en headers AMQP y logs.

## Trace de una simulación

Dado un `simulationId`:

```javascript
// En MongoDB de ms-logs-api
db.logs.find({ 'meta.simulationId': '<uuid>' })
       .sort({ ts: 1 })
       .limit(200)
```

Vas a ver la secuencia esperada, cronológica:

1. `ms-predictions-api` — `event: simulation.manual.created` con `Simulation` INSERT.
2. `ms-predictions-api` — `event: publisher.published`, routing key `simulation.manual.dispatched`.
3. `ms-model-api` — `event: consumer.message.received`, queue `model-simulation-dispatched`.
4. `ms-model-api` — `event: simulation_run.created` (SimulationRun WAITING_RESULT).
5. `ms-model-api` — `event: poller.polled` con `outputFolder` (repetido cada 5min hasta que aparecen los archivos).
6. `ms-model-api` — `event: result.fetched` cuando aparecen archivos.
7. **Con flag ON**:
    - `ms-model-api` — `event: vobs.fetched` (o warning `vobs.fetch_failed`).
    - `ms-model-api` — `event: publisher.published`, routing key `simulation.manual.output.fetched`.
    - `ms-calculator-api` — `event: consumer.message.received`, queue `calculator-simulation-manual-output`.
    - `ms-calculator-api` — `event: pipeline.completed`.
    - `ms-calculator-api` — `event: publisher.published`, routing key `simulation.manual.balance.computed`.
    - `ms-predictions-api` — `event: consumer.message.received`, queue `predictions-simulation-manual-balance`.
8. **Con flag OFF (legacy)**:
    - `ms-model-api` — `event: publisher.published`, routing key `timeseries.ingested`.
    - `ms-predictions-api` — `event: consumer.message.received`, queue `predictions-timeseries-processing`.
9. `ms-predictions-api` — múltiples `event: prediction.processed` (uno por serie).
10. `ms-predictions-api` — `event: simulation.finalized`, `Simulation` UPDATE status=`FINALIZED`.

## Diagnóstico común

### 1. La simulación nunca sale de `MODEL_PROCESSING`

Chequear en orden:

**a. ¿Se creó SimulationRun en model-api?**
```bash
docker exec infra-db-model psql -U postgres -d model \
  -c "SELECT id, simulation_id, status, started_at, error_message FROM simulation_runs \
      WHERE simulation_id = '<uuid>' ORDER BY started_at DESC;"
```
- Si **no hay fila** → el evento `simulation.manual.dispatched` no llegó a model-api. Verificar broker (queue `model-simulation-dispatched` en `http://infra-rabbitmq:15672`).
- Si **hay fila con status `WAITING_RESULT`** → esperando el output del proveedor en SFTP.

**b. ¿Están los archivos en SFTP output?**
```bash
curl -s "http://ms-sftp-api:3003/files?directory=tajo/SIMULATIONS/<simId>/output" \
  -H "x-internal-caller: runbook"
```
- Si **el folder está vacío** → el proveedor aún no procesó / falla del proveedor. Fuera del scope del monorepo. Verificar con equipo del proveedor.

**c. ¿El polling está corriendo?**
Buscar en logs de ms-model-api:
```javascript
db.logs.find({ service: 'ms-model-api', event: 'poller.polled' }).sort({ ts: -1 }).limit(5)
```
Debería haber al menos una entrada cada 5 minutos. Si no, ms-model-api puede estar caído (verificar `/health`).

### 2. Calculator no procesa (queue crece)

```bash
# Verificar depth de la queue
curl -s -u guest:guest \
  "http://infra-rabbitmq:15672/api/queues/%2F/calculator-simulation-manual-output" \
  | jq '{depth: .messages, consumers: .consumers}'
```

- Si `depth > 0` y `consumers = 0` → **ms-calculator-api caído**. Chequear:
  ```bash
  docker ps --filter name=ms-calculator-api
  docker logs --tail 200 ms-calculator-api
  ```
- Si `depth > 0` y `consumers > 0` pero no baja → los mensajes están fallando en validación pero se están nackeando indefinidamente. Buscar logs de fallos:
  ```javascript
  db.logs.find({ service: 'ms-calculator-api', level: 'error' }).sort({ ts: -1 }).limit(20)
  ```

### 3. Balances salen como -999.0 (missing)

Causa más común: `v.obs.t0` no llegó al calculator porque el WISKI CSV no se pudo fetchear.

Chequear:
```javascript
db.logs.find({
  service: 'ms-model-api',
  event: 'vobs.fetch_failed',
  'meta.simulationId': '<uuid>'
})
```

Si hay warning:
- `VOBS_CSV_SFTP_PATH` está vacío → configurar la env var.
- Archivo no existe en SFTP → verificar que el proveedor de v.obs esté depositando el CSV en la ruta correcta.
- Timeout → aumentar `VOBS_CSV_FETCH_TIMEOUT_MS`.

### 4. Predictions no llegan al DB

Verificar la queue nueva:
```bash
curl -s -u guest:guest \
  "http://infra-rabbitmq:15672/api/queues/%2F/predictions-simulation-manual-balance" \
  | jq '{depth: .messages, consumers: .consumers}'
```

Mismo patrón que el caso 2. Si `depth = 0` pero no hay predictions:
```sql
SELECT COUNT(*) FROM predictions WHERE simulation_id = '<uuid>';
```

Si es 0 pero el consumer ack-eó, revisar `ProcessTimeSeriesHandler` logs de errores.

### 5. Simulation quedó FINALIZED pero faltan datos

Ver logs de `pipeline.completed` en calculator — comparar `seriesCount` y `eventsCount` con lo esperado:

```javascript
db.logs.find({
  service: 'ms-calculator-api',
  event: 'publisher.published',
  'meta.simulationId': '<uuid>'
})
```

Si `seriesCount < 12` (harmonie + 5 EPS × 2 embalses de test), algo del pipeline no encontró parameterId. Revisar warnings `reservoir.skipped`.

## DLQ inspection

Cuando un mensaje se dropea (nack sin requeue) se envía al DLX si está configurado (ver `.claude/rules/08-observability.md`):

```bash
docker exec infra-rabbitmq rabbitmqadmin get \
  queue=simulation-events-dead-letters count=10 ackmode=ack_requeue_true
```

O UI: `http://infra-rabbitmq:15672` → Queues → `simulation-events-dead-letters`.

Si el DLX **no está configurado** (setup nuevo), aplicar la policy:
```bash
bash scripts/rabbitmq-setup-dlx.sh
```

## Playbook de rollback

Si el flow con calculator está fallando masivamente:

1. **Desactivar el hop del calculator**:
   ```bash
   ssh root@65.21.97.113
   cd /opt/infra   # o donde viva el .env de ms-model-api
   sed -i 's/USE_CALCULATOR_PIPELINE=true/USE_CALCULATOR_PIPELINE=false/' ms-model-api/.env
   docker compose restart ms-model-api
   ```
2. **Verificar** en logs:
   ```javascript
   db.logs.find({
     service: 'ms-model-api',
     event: 'poller.polled',
     ts: { $gte: <hora_del_restart> }
   })
   ```
   El siguiente publish debería ser a `timeseries.ingested` (routing key legacy), no a `simulation.manual.output.fetched`.
3. **Simulaciones in-flight**: cualquier mensaje que ya estaba en la queue del calculator sigue procesándose. Nuevas simulaciones vuelven al path legacy. Zero pérdida.
4. **Consumer nuevo en predictions-api** sigue vivo pero sin tráfico — inofensivo.

## Playbook de activación (cuando estamos listos para prod)

1. Verificar que ms-calculator-api esté deployed y su `/health` responda 200:
   ```bash
   curl http://ms-calculator-api:3011/health
   ```
2. Verificar DLX config:
   ```bash
   docker exec infra-rabbitmq rabbitmqctl list_policies | grep simulation-events-dlx
   ```
   Si no aparece → correr `bash scripts/rabbitmq-setup-dlx.sh`.
3. Configurar env vars en ms-model-api:
   ```
   USE_CALCULATOR_PIPELINE=true
   VOBS_CSV_SFTP_PATH=/simulations/wiski/Tagus_FlowCast.csv  # ajustar al path real
   VOBS_CSV_TIMEZONE=Europe/Madrid
   VOBS_CSV_FETCH_TIMEOUT_MS=30000
   ```
4. Restart ms-model-api:
   ```bash
   docker compose restart ms-model-api
   ```
5. Trigger una simulación manual de prueba desde el backoffice (`POST /simulations/manual` con datos de test) y seguir el trace en logs.

## Contactos

- Owner del team: definir.
- Escalation: on-call actual.
