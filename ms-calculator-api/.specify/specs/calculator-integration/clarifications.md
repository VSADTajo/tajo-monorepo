# Clarifications — Calculator Integration

This document captures the ambiguities detected in `spec.md` and the resolutions applied. All resolutions follow the guidance in the team brief; any deviation is called out explicitly.

## Resolved during spec drafting

### C1. Source of `v.obs.t0` when input event does not carry observed volume

**Question**: The current CLI pipeline reads `v.obs` from a WISKI CSV on disk. In the event-driven flow, does the AMQP payload carry `v.obs` time-series, or does the calculator have to fetch it from elsewhere?

**Decision**: The AMQP payload carries `v.obs` as part of the `timeSeries[]` array (one series per reservoir with the configured `v.obs` parameterId — e.g. `VICT01.Validado`). The calculator groups by `parameterId` from `reservoir_parameters.json` and derives `v.obs.t0` in-memory.

If a reservoir has no `v.obs` series in the payload, the balance formula degrades gracefully: `v.obs.t0` is treated as `NaN`, resulting in `-999.0`/`flag=8` output events for that reservoir's balance columns (existing pipeline behavior). A `WARN` log is emitted with the `simulationId` and reservoir id.

**Rationale**: Keeps the service pure/stateless and avoids a synchronous dependency on any storage service. The producer (ms-model-api) already fetches all four signal families (Q.in.for, Q.out.for, v.obs) from SFTP for manual simulations, so the input already contains v.obs.

**Deviation from brief**: The brief suggests optionally accepting a separate `observedVolumeAtT0` field or falling back to reading a CSV. Both alternatives were rejected: the former is redundant with the already-present v.obs series, the latter is not compatible with a stateless container. If v.obs is missing operationally, the fix is upstream (ms-model-api must include the WISKI CSV in the fetch), not here.

### C2. One event vs multiple events per simulation for harmonie/eps

**Question**: The current CLI runs the pipeline twice (once for harmonie, once for eps). Should the calculator publish two events (one per model) or one event with all 6 columns?

**Decision**: **One event** with all 6 columns (`v.balance.q.in.for.harmonie`, `v.balance.q.in.for.eps.{10,25,50,75,90}`) — one `timeSeries` entry per (reservoir, balance column), all in the same message.

**Rationale**: Atomicity — a downstream consumer sees the full result set of a simulation as one unit. Reduces fan-out. Matches the input event's shape (which also carries all series in one payload).

### C3. Idempotency and duplicate delivery

**Question**: RabbitMQ can deliver the same message twice. Does the calculator need to deduplicate?

**Decision**: **No.** The service is stateless and the computation is deterministic; publishing the same balance event twice is acceptable. Deduplication is the downstream (`ms-predictions-api`) responsibility.

**Rationale**: Simplifies the calculator; keeps concerns single-purpose.

### C4. Failure semantics: nack requeue vs dead-letter vs failed event

**Question**: When calculation fails, what happens to the input message?

**Decision**:
- **Business/validation failures** (invalid payload, config mismatch, computation error): publish `simulation.manual.balance.failed` event, then **ack** the original message. Not retryable.
- **Infrastructure failures** (broker down mid-publish, out-of-memory): **nack with requeue=false**. The broker's DLX (if configured) picks it up; otherwise the message is lost. Nack-with-requeue-true is rejected because it causes poison-message loops.

**Rationale**: Aligns with the `TimeSeriesIngestedConsumer` pattern in `ms-predictions-api` which already does `nack(msg, false, false)` on error.

### C5. Config source for `reservoir_parameters.json`

**Question**: The config file is currently in `tajo-volume_calculator/config/`. Should the calculator bundle it, fetch it from another service, or receive it via env var?

**Decision**: **Bundle** the config as `src/config/reservoir_parameters.json` inside the container. Tests may override the config path via `RESERVOIR_CONFIG_PATH` env var to inject fixtures.

**Rationale**: Small file (< 10KB), rarely changes, and coupling to config lifecycle keeps deploys atomic. If it ever needs to change without a redeploy, a follow-up feature can add a config-fetch pattern.

### C6. Python version and framework choice

**Question**: Which Python version and web framework?

**Decision**: **Python 3.12** + **FastAPI** + **uvicorn** (dev, `--reload`) / **gunicorn+uvicorn workers** (prod). AMQP client: **aio-pika** (async, Pythonic, compatible with FastAPI's asyncio loop). Structured logging: **structlog** with JSON renderer.

**Rationale**: Explicit ask from the brief. FastAPI gives auto-OpenAPI, native pydantic validation, and async which pairs well with aio-pika.

### C7. HTTP port

**Question**: Which port does the service listen on?

**Decision**: **3011**, following the monorepo registry series (last assigned was ms-meteo-api on 3010).

### C8. Service name for logging and provider identification

**Question**: What is the identifier used in the `providerName` output field and in logs?

**Decision**:
- Logs: `service: "ms-calculator-api"` (matches deployment container name).
- Output event `providerName`: `"volume-calculator"` (matches the existing `moduleInstanceId` in the CLI's balance header).

**Rationale**: `ms-calculator-api` is the operational identifier; `volume-calculator` is the domain identifier consistent with the ported package name.

## Deferred to plan / implementation

### D1. Reload of reservoir config at runtime

Not required by any acceptance scenario. If needed later, the plan can add a SIGHUP handler or an admin endpoint.

### D2. Metrics / Prometheus

Out of scope for this feature. If observability-runbook teammate needs it, that is a follow-up.

### D3. Dead-letter queue configuration on the RabbitMQ side

Out of scope. The broker-level DLX policy is infra concern.
