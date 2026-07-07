# Feature Specification: Calculator Integration — Volume Balance Service

**Feature Branch**: `calculator-integration`
**Created**: 2026-07-05
**Status**: Draft
**Input**: Bootstrap of a new microservice (`ms-calculator-api`) that ports the volume-balance pipeline from `tajo-volume_calculator/` and inserts a computation step between `ms-model-api` (model output fetcher) and `ms-predictions-api` (predictions persistence) for the manual-simulation path.

## Context

Today the manual-simulation flow works as:

```
ms-model-api  --(publishes `timeseries.ingested` on `model-events`)-->  ms-predictions-api
```

The predictions API consumes the raw model output (Q.in.forecast + Q.out.forecast) and persists it as predictions. The team needs to inject a computed volume-balance series between the two, so downstream dashboards can show `v.balance = max(0, v.obs.t0 + q.in.accumulated - q.out.accumulated)` per reservoir, per model (harmonie deterministic + 5 EPS percentiles).

The volume-balance logic already exists as a standalone Python package (`tajo-volume_calculator/`) but is currently CLI-only and file-based (WISKI CSV + JSON glob patterns). This feature wraps it as an event-driven microservice that:

- Consumes model output from AMQP.
- Runs the balance calculation on the payload in-memory (no filesystem input).
- Publishes the resulting balance time-series to AMQP so `ms-predictions-api` can ingest it via the same `timeSeries` shape it already handles.
- Exposes the same computation via HTTP for debug/testing.

The change is scoped strictly to the **manual-simulation path** (`providerName='manual-simulation'`); the automated data-provider pipelines that use `ms-model-api` for other purposes are not affected.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Automatic balance calculation on manual simulation output (Priority: P1)

**As** the manual-simulation event pipeline
**I want** a calculator service that consumes the raw manual-simulation output event, computes the `v.balance.*` time-series per reservoir/model, and republishes the enriched payload
**So that** `ms-predictions-api` can persist both the raw forecast series and the derived balance series without needing to know about volume-balance math.

**Why this priority**: This is the core of the feature; without it the calculator has no reason to exist. All other stories build on it.

**Independent Test**: Publish a synthetic `simulation.manual.output.fetched` event with a known Q.in/Q.out/v.obs payload to the local RabbitMQ. Subscribe an inspector consumer to the output topic and confirm the emitted `simulation.manual.balance.computed` message contains one `timeSeries` entry per (reservoir, model) with a `parameterId` starting with `v.balance.` and events computed by the pipeline.

**Acceptance Scenarios**:

1. **Given** a valid input event containing Q.in.forecast.harmonie, Q.in.forecast.eps (5 percentiles), Q.out.forecast, and v.obs series for at least one reservoir with an initial observed volume at t0, **When** the calculator consumes the event, **Then** it publishes exactly one `simulation.manual.balance.computed` event carrying the same `simulationId`, with 6 balance series per reservoir (`v.balance.q.in.for.harmonie`, `v.balance.q.in.for.eps.{10,25,50,75,90}`).
2. **Given** an input event where a reservoir has Q.in.forecast but no v.obs values, **When** the calculator processes it, **Then** the balance columns for that reservoir are emitted with `-999.0` / `flag=8` for missing values (matching the current pipeline behavior), and the event is still published successfully.
3. **Given** an input event that references a reservoir not present in `reservoir_parameters.json`, **When** the calculator processes it, **Then** the service does not crash: reservoirs it cannot resolve are skipped and a warning log is emitted with `simulation_id`, but any resolvable reservoirs are still computed and published.
4. **Given** an input event that has zero resolvable reservoirs (all missing config), **When** the calculator processes it, **Then** it publishes a `simulation.manual.balance.failed` event with a non-retryable reason and does not publish a `computed` event.

---

### User Story 2 - Synchronous HTTP calculation for debug and tests (Priority: P2)

**As** an operator or developer troubleshooting a failed simulation
**I want** to POST the same payload the AMQP consumer accepts to a `POST /calculate` endpoint and receive the balance payload synchronously
**So that** I can reproduce and inspect the computation without touching RabbitMQ.

**Why this priority**: Critical for observability and TDD (integration tests can hit HTTP directly). Not required for the production event flow but essential for the team's ability to operate and evolve the service.

**Independent Test**: Send `POST /calculate` with a fixture payload from `tajo-volume_calculator/`. Assert the HTTP 200 body has the same structure the AMQP publisher would emit (same `timeSeries` shape, same `parameterId` conventions).

**Acceptance Scenarios**:

1. **Given** a valid JSON payload in the request body matching the AMQP input shape, **When** the client POSTs `/calculate`, **Then** the response is HTTP 200 with a body carrying the computed `timeSeries`.
2. **Given** a request body missing the required `timeSeries` field, **When** the client POSTs `/calculate`, **Then** the response is HTTP 400 with an error listing the missing field(s).
3. **Given** a valid payload with `simulationId`, **When** the client POSTs `/calculate`, **Then** the response echoes the same `simulationId` in the output — no persistence, no side-effects.

---

### User Story 3 - Observability and correlation across services (Priority: P2)

**As** a platform operator debugging a manual simulation that produced wrong predictions
**I want** every log line from ms-calculator-api tagged with the `simulation_id` in structured JSON
**So that** I can grep across ms-model-api → ms-calculator-api → ms-predictions-api logs by a single ID.

**Why this priority**: Required for the observability-runbook teammate to build cross-service log queries. Without it, the runbook cannot resolve traces.

**Independent Test**: Send an event with a known `simulationId`. Tail the calculator's stdout and confirm every JSON line for that request contains `"simulation_id": "<id>"` in the same position, plus `service`, `event`, `level`, `ts`.

**Acceptance Scenarios**:

1. **Given** any inbound AMQP message with `simulationId`, **When** the calculator processes it, **Then** every log line emitted while handling that message includes `simulation_id: <id>`, `service: ms-calculator-api`, and an `event` label describing the phase (`consumed`, `computed`, `published`, `failed`).
2. **Given** an inbound message without `simulationId`, **When** the calculator processes it, **Then** it rejects the message with a validation error and logs `simulation_id: null` explicitly (not omitted).

---

### User Story 4 - Health and API discoverability (Priority: P3)

**As** the platform infra layer (docker-compose healthcheck, load balancer, Jenkins CI/CD)
**I want** the service to expose `GET /health` and `GET /docs`
**So that** it can be monitored, restarted, and its API documented alongside the rest of the microservices.

**Why this priority**: Non-negotiable for deployment but not part of the calculator logic itself; low priority relative to the actual computation.

**Independent Test**: Boot the service, `curl /health` returns 200 with a payload including `{status: "ok"}`, `curl /docs` returns 200 with the Swagger UI HTML.

**Acceptance Scenarios**:

1. **Given** the service is running with RabbitMQ reachable, **When** the client hits `GET /health`, **Then** the response is HTTP 200 with `{status: "ok", checks: {amqp: "ok"}}`.
2. **Given** the service is running but RabbitMQ is unreachable, **When** the client hits `GET /health`, **Then** the response is HTTP 503 with `{status: "degraded", checks: {amqp: "down"}}`.
3. **Given** the service is running, **When** the client hits `GET /docs`, **Then** the OpenAPI/Swagger UI is served describing `POST /calculate` and `GET /health`.

---

### Edge Cases

- **Missing v.obs.t0 in payload**: If neither the input event nor any configured fallback provides an observed volume at t0 for a reservoir, the balance formula degrades to `max(0, q.in.accumulated - q.out.accumulated)` (i.e., initial volume is treated as 0) and a warning log is emitted. This preserves the current pipeline behavior where missing v.obs produces NaN cascaded to `-999.0`.
- **Reservoir configured but no matching series in input**: Skip silently; do not fail the whole message. Emit a debug log.
- **Duplicate messages (same simulationId processed twice)**: The service is idempotent at the message level (no persistence). Re-publishing the computed event is acceptable; downstream `ms-predictions-api` is responsible for its own idempotency.
- **Payload larger than RabbitMQ frame limit (128 MB default)**: Not expected in normal operation (a typical simulation has < 50 reservoirs × 6 signals × ~10k events ≈ a few MB). If exceeded, the publish call fails and a `simulation.manual.balance.failed` event is emitted with `reason: payload_too_large`.
- **AMQP broker unreachable at startup**: The service does not become "ready" until it can subscribe. Health check reflects this.
- **AMQP broker becomes unreachable mid-flight**: The consumer nacks the current message with `requeue=false` (to avoid poison loops), the connection self-heals via aio-pika reconnect, and the message returns via dead-letter policy at the broker level (out of scope for this service).
- **Malformed payload (e.g., `timeSeries` not a list)**: nack with `requeue=false`, publish `simulation.manual.balance.failed` with `errorType: invalid_payload`.
- **Timezone edge cases**: The pipeline already normalizes all inputs to UTC. The service must preserve that; input events with timestamps missing timezone info are assumed UTC (matching the current pipeline's default).

## Requirements *(mandatory)*

### Functional Requirements

**Input handling**

- **FR-001**: Service MUST subscribe to a dedicated queue bound to the exchange `simulation-events` with routing key `simulation.manual.output.fetched` and process each message as one simulation.
- **FR-002**: Service MUST accept the same payload shape currently published by `ms-model-api` (fields: `simulationId`, `providerName`, `outputFolder`, `seriesCount`, `eventsCount`, `timeSeries[]` where each series has `header` with `locationId`/`parameterId`/... and `events[]` with `date`/`time`/`value`/`flag`).
- **FR-003**: Service MUST validate the payload before processing; specifically `simulationId` (non-empty string), `timeSeries` (list, non-empty), and each series has a `header.locationId` and `header.parameterId`.
- **FR-004**: Service MUST expose the same accepted shape as JSON body on `POST /calculate` and return the same output shape it would have published to AMQP.
- **FR-005**: Service MUST NOT persist any input, output, or intermediate state to a database. The service is stateless.

**Business logic (ported from `tajo-volume_calculator`)**

- **FR-006**: Service MUST group the input `timeSeries` by reservoir (locationId) and by signal family (`q.in.for.harmonie`, `q.in.for.eps.{10..90}`, `q.out.for`, `v.obs`), using `reservoir_parameters.json` to map from `parameterId` to signal family.
- **FR-007**: Service MUST compute cumulative volume in hm3 per reservoir per Q signal (`_accumulate_flow_as_hm3` current logic: integrate m3/s over elapsed seconds, cumsum from 0 at t0).
- **FR-008**: Service MUST determine `v.obs.t0` per reservoir as the observed-volume value with timestamp closest to `t0` (the earliest forecast timestamp). If no `v.obs` values exist for a reservoir, `v.obs.t0` is treated as `NaN`.
- **FR-009**: Service MUST compute `v.balance.<signal>` per reservoir per Q.in signal as `max(0, v.obs.t0 + <signal>.accumulated - q.out.for.accumulated)`, matching `add_forecast_balance_columns` in the current pipeline.
- **FR-010**: Service MUST emit balance series for all 6 model columns (`v.balance.q.in.for.harmonie` + 5 EPS percentiles) if both harmonie and EPS Q.in inputs are present. If only harmonie is present, only its balance is emitted. If only EPS is present, only EPS balances are emitted.

**Output publishing**

- **FR-011**: On successful computation, service MUST publish exactly one AMQP event to exchange `simulation-events` with routing key `simulation.manual.balance.computed` carrying:
  - `simulationId` — pass-through from input.
  - `providerName` — `"volume-calculator"`.
  - `seriesCount`, `eventsCount` — count of emitted balance series and total events.
  - `computedAt` — ISO-8601 UTC timestamp of when the calculation finished.
  - `timeSeries[]` — one entry per (reservoir, balance column) with the header shape produced by `_build_balance_time_series_header` (locationId, parameterId, timeStep, startDate/endDate/forecastDate, missVal, units='hm3', moduleInstanceId='volume_calculator') and events array in the same `date/time/value/flag` shape as the input.
- **FR-012**: The published event MUST be compatible with the existing `TimeSeriesIngestedConsumer` in `ms-predictions-api` (i.e., a `predictions-consumer` teammate can subscribe with minimal changes to its own consumer).
- **FR-013**: On failure that is not retryable (validation error, config error), service MUST publish exactly one AMQP event with routing key `simulation.manual.balance.failed` on the same exchange, carrying `simulationId`, `reason` (human-readable), `errorType` (machine-readable enum: `invalid_payload` | `config_error` | `computation_error` | `publish_error`), `retryable: false`, `occurredAt`.
- **FR-014**: The consumer MUST ack the input message ONLY after successful publish (success or failure event), not before. On unexpected internal errors (e.g., broker unreachable during publish), the consumer nacks with `requeue=false` to avoid infinite loops; the input message is lost. (Deferring to a dead-letter policy on the broker side is out of scope for this feature.)

**HTTP API**

- **FR-015**: Service MUST expose `POST /calculate` accepting the same payload as the AMQP consumer, returning HTTP 200 with the computed output on success, HTTP 400 on invalid input, HTTP 500 on internal errors.
- **FR-016**: Service MUST expose `GET /health` returning HTTP 200 when AMQP is reachable, HTTP 503 otherwise. Response body includes `status`, per-dependency `checks`.
- **FR-017**: Service MUST expose `GET /docs` serving an OpenAPI/Swagger UI describing all HTTP endpoints and their request/response schemas.

**Observability**

- **FR-018**: Service MUST emit structured JSON logs (one JSON object per line) with the following mandatory fields on every log entry: `ts` (ISO-8601 UTC), `level`, `service` (constant `"ms-calculator-api"`), `event` (short label), `message` (human text), plus `simulation_id` on any log line emitted during processing of a specific simulation.
- **FR-019**: Service MUST log at least these events with `INFO` level: `consumer.message_received`, `calculation.started`, `calculation.completed`, `publisher.event_sent`, `http.request_completed`. Errors at `ERROR` level, config/validation warnings at `WARN`.
- **FR-020**: Service MUST NOT emit any log via `print()`, `sys.stdout.write`, or unstructured logging. All log lines go through the structured logger.

**Configuration**

- **FR-021**: All infrastructure endpoints (`RABBITMQ_HOST`, `RABBITMQ_PORT`, `RABBITMQ_USER`, `RABBITMQ_PASSWORD`, `RABBITMQ_VHOST`, `APP_PORT`, `APP_LOG_LEVEL`) MUST be loadable from environment variables with sensible defaults, matching the naming used elsewhere in the monorepo.
- **FR-022**: The reservoir configuration (`reservoir_parameters.json`) MUST be bundled with the service (not read from an external volume) but loadable from a configurable path so tests can override it with fixture configs.

**Packaging & deployment**

- **FR-023**: Service MUST ship a multi-stage Dockerfile with a `dev` target (hot reload) and a `prod` target (minimal image).
- **FR-024**: Service MUST ship a standalone `docker-compose.yml` that joins the `infra-network` external network so it can reach `infra-rabbitmq` in local dev.
- **FR-025**: Service MUST be registered in `/.claude/rules/01-global.md` under the Monorepo Service Registry with port `3011`.
- **FR-026**: Service MUST ship a `Jenkinsfile` following the monorepo pattern (checkout → install → lint → test → build → docker build → docker run deploy on the Hetzner VM).

### Key Entities

The service is stateless, so there are no persisted entities. The domain-level in-memory concepts are:

- **SimulationOutput** — input payload wrapping one manual-simulation's raw model output (`simulationId`, `timeSeries[]`).
- **ReservoirBalanceResult** — per-reservoir intermediate result carrying `v.obs.t0`, the accumulated Q signals, and the derived `v.balance.*` columns. Not exposed via API; internal only.
- **BalanceTimeSeriesPayload** — output payload with the same `timeSeries` shape as the input but with `v.balance.*` `parameterId`s.
- **ReservoirParametersConfig** — the JSON config describing which `parameterId` codes map to each signal per reservoir. Loaded at startup; cached in memory; reloadable on SIGHUP if the operator wants (nice-to-have, not required).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: When a valid `simulation.manual.output.fetched` event is published to the local RabbitMQ, the service publishes a matching `simulation.manual.balance.computed` event within **10 seconds** for a payload of up to 50 reservoirs × 6 signals × 10,000 events each (worst-case current dataset).
- **SC-002**: The output payload structure is **byte-identical** to what the reference CLI (`python -m volume_calculator.reservoir_timeseries`) produces today for the same input data — verified by a fixture comparison test.
- **SC-003**: `POST /calculate` produces the same JSON as the AMQP publisher would for the same input, verified in an integration test that runs both paths on the same fixture.
- **SC-004**: **Zero** unstructured log lines are emitted during a successful simulation cycle (verified by grep for lines not starting with `{`).
- **SC-005**: The `predictions-consumer` teammate can subscribe to `simulation.manual.balance.computed` and successfully persist the payload with **≤ 1 hour** of integration work (i.e., the shape is compatible enough that only a topic-name change is required).
- **SC-006**: The service `docker compose up`s from a clean state in **< 30 seconds** including image build (first build may take longer for pip install).
- **SC-007**: All e2e tests (unit + integration + HTTP e2e) run in **< 3 minutes** on a developer laptop.
- **SC-008**: The `simulation_id` field is present on **100%** of log lines emitted during simulation processing (verified by a log-shape test on a fixture run).
