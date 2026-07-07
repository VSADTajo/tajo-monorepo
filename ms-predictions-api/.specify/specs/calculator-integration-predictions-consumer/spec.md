# Feature Specification: Calculator Integration — Predictions Consumer

**Feature Branch**: `calculator-integration-predictions-consumer`
**Created**: 2026-07-05
**Status**: Draft — pending TL approval (plan-first)
**Umbrella spec**: `.specify/specs/calculator-integration/` (root, cross-service)
**Service scope**: `ms-predictions-api`
**Depends on**: teammate `calculator-service` (contract confirmed, see below), teammate `model-hook` (routing decision only, no data dependency)

---

## Overview

The volume-balance calculator (new Python microservice built by teammate `calculator-service`) publishes an AMQP event with the computed balance time series for a manual simulation. ms-predictions-api MUST consume that event and persist the resulting predictions against the corresponding `Simulation`, then auto-finalize the simulation — the same terminal step that today closes the automatic flow.

The delivery is **strictly additive**: a new consumer, its own queue, its own binding. The existing `TimeSeriesIngestedConsumer` (which today services the automatic pipeline via `timeseries.ingested`) stays intact so that automatic providers keep working while the calculator integration is dark-launched behind the model-hook feature flag.

The new consumer reuses `ProcessTimeSeriesCommand` — the same handler that already persists predictions for the automatic flow and for the pre-calculator manual flow. No changes to the domain model, no changes to the command, no new prediction fields.

---

## User Scenarios & Testing

### User Story 1 — Persist Balance Time Series from Calculator (Priority: P1) MVP

**As** the predictions service
**I want** to consume `simulation.manual.balance.computed` events emitted by the balance calculator
**So that** the operator sees the calculator's output as regular `Prediction` records attached to the manual `Simulation`, and the simulation auto-finalizes.

**Why this priority**: This is the whole point of the integration. Without it, the calculator's output is lost and the manual simulation never leaves `MODEL_PROCESSING`.

**Independent Test**: Publish a `simulation.manual.balance.computed` event to the `simulation-events` exchange with N series for an existing `Simulation`. Verify (through the GET manual simulation endpoint) that N predictions appear, their `PredictionResult` rows carry the expected values, and the simulation status transitions to `FINALIZED`.

**Acceptance Scenarios**:

1. **Given** a `Simulation` with `type=MANUAL` and `status=MODEL_PROCESSING` exists,
   **When** a `simulation.manual.balance.computed` event with that `simulationId` and 6 `timeSeries` (one per parameter: `harmonie`, `eps.10`, `eps.25`, `eps.50`, `eps.75`, `eps.90`) is published to the `simulation-events` exchange,
   **Then** 6 `Prediction` rows are persisted linked to that simulation, each with its own `PredictionResult` rows, the simulation transitions to `FINALIZED`, and all cached simulation views are invalidated.

2. **Given** the same event as above,
   **When** the consumer processes it,
   **Then** the message is acknowledged exactly once (no requeue, no duplicate processing on restart).

3. **Given** a payload with a `parameterId` that doesn't end in `.\d+` (e.g. `v.balance.q.in.for.harmonie`),
   **When** the handler runs,
   **Then** a `PredictionType` named `v.balance.q.in.for.harmonie` (units `hm3`) is auto-created or reused, and the prediction is stored with `percentile=null`.

4. **Given** a payload with a `parameterId` that ends in `.eps.<N>` (e.g. `v.balance.q.in.for.eps.75`),
   **When** the handler runs,
   **Then** a `PredictionType` named `v.balance.q.in.for.eps` is auto-created or reused, and the prediction is stored with `percentile=75`.

---

### User Story 2 — Isolate the New Consumer from the Legacy One (Priority: P1)

**As** the operations team
**I want** the calculator's events to flow through a dedicated queue and consumer, without touching the existing `timeseries.ingested` consumer
**So that** rollout is reversible (disable the calculator's queue → no side effect on the automatic pipeline).

**Why this priority**: Regression risk on the automatic providers (HARMONIE, EPS ingest via ms-model-api) is unacceptable. The two flows must be observable and stoppable in isolation.

**Independent Test**: Run the existing `TimeSeriesIngestedConsumer` test suite unchanged. Publish a `timeseries.ingested` event and observe: exactly one processing path (the old one), the new queue receives nothing.

**Acceptance Scenarios**:

1. **Given** the new consumer is deployed, **When** a `timeseries.ingested` event is published, **Then** it is consumed and processed by the existing `TimeSeriesIngestedConsumer` — the new consumer receives nothing, no test in the existing suite regresses.
2. **Given** the RabbitMQ new queue is drained/disabled at runtime, **When** the service continues to run, **Then** the legacy consumer keeps working normally.

---

### User Story 3 — Reject Malformed Events without Crashing (Priority: P1)

**As** the predictions service
**I want** malformed calculator events (missing `simulationId`, unknown simulation, empty `timeSeries[]`, undecodable JSON) to be discarded with a structured error log, without requeue
**So that** a poison message doesn't loop forever and doesn't crash the consumer.

**Why this priority**: Basic broker hygiene. A single bad publish must not stop the manual flow for everybody else.

**Independent Test**: Publish a payload with an unknown `simulationId`. Verify the consumer nacks (requeue=false), logs an error with the failing `simulationId`, and continues to accept subsequent valid events.

**Acceptance Scenarios**:

1. **Given** an event whose `simulationId` does not correspond to any row in the DB,
   **When** the consumer processes it,
   **Then** the message is nacked (requeue=false), an error is logged with the offending id, and the consumer stays alive.

2. **Given** an event with `timeSeries=[]` (empty array),
   **When** the consumer processes it,
   **Then** the message is acked, no predictions are created, and a warning-level structured log is emitted for observability.

3. **Given** an event with a mandatory field missing (no `simulationId`, no `timeSeries`),
   **When** the consumer processes it,
   **Then** the message is nacked (requeue=false) with an explanatory error log.

---

### User Story 4 — Auto-Finalize the Simulation (Priority: P1)

**As** the operator
**I want** the manual simulation to move to `FINALIZED` after the calculator's results are stored
**So that** the GET endpoints stop showing `MODEL_PROCESSING` and downstream consumers know the run is done.

**Why this priority**: The status machine is the operator's only signal that the pipeline finished. This is the same behavior the automatic flow already exhibits — the new consumer must not regress it.

**Independent Test**: After US1's scenario, GET the manual simulation by id and assert `status=FINALIZED`. Publish a second `simulation.manual.balance.computed` for the same simulation and assert the second event is a no-op (already finalized) — no new predictions, no error.

**Acceptance Scenarios**:

1. **Given** a `Simulation` in `MODEL_PROCESSING` and the calculator publishes the event with N series,
   **When** the consumer finishes processing all N series successfully,
   **Then** the simulation transitions to `FINALIZED` and every simulation cache namespace (both general and manual) is invalidated so subsequent GETs reflect the new status.

2. **Given** a `Simulation` already in `FINALIZED`,
   **When** a second `simulation.manual.balance.computed` event arrives for it,
   **Then** the handler processes each series idempotently (existing predictions are not duplicated, per `ProcessTimeSeriesHandler`'s built-in uniqueness check) and the simulation stays in `FINALIZED`.

---

### Edge Cases

- **Duplicate delivery** (broker redelivers the same event): the underlying `findByUniqueConstraint(simulationId, stationId, predictionTypeId, percentile)` in `ProcessTimeSeriesHandler` skips the second write. Consumer must still ack.
- **`missVal="-999.0"` events**: today `ITimeSeriesData.events[i].isMissing` filters those out; the calculator publishes numeric strings that will be JSON-parsed. Consumer MUST map events with `value == missVal` to `isMissing=true` before enqueuing the command. (Same shape as the current auto flow — verify no drift.)
- **`timeStep.multiplier` string vs number**: the shape defines it as `string`; the consumer must not assume a numeric type. It is metadata only — not consumed by `ProcessTimeSeriesCommand`, so passthrough is fine.
- **`endDate < startDate`** in header: consumer MUST NOT re-validate the window (already validated at the calculator). If mismatched, the resulting `Prediction.predictionEndDate` will be < `predictionStartDate`, which is a data-quality issue upstream — logged, not blocked.
- **Consumer down during publish**: durable queue + `noAck: false` guarantees the message survives until an ack.

---

## Requirements

### Functional Requirements

- **FR-001**: The service MUST bind a durable queue named `predictions-simulation-manual-balance` to the topic exchange `simulation-events` with routing key `simulation.manual.balance.computed`.
- **FR-002**: The service MUST expose a new consumer that reads from that queue and processes each incoming event by dispatching one `ProcessTimeSeriesCommand` per element of `payload.timeSeries[]`, passing `simulationId` and `providerName` (`volume-calculator`) verbatim.
- **FR-003**: The consumer MUST NOT modify `ProcessTimeSeriesCommand` or its handler. It reuses the existing command surface as-is.
- **FR-004**: The consumer MUST detect completion (all series processed for the referenced simulation in this batch) and transition the simulation to `FINALIZED` if it isn't already, following the exact pattern used today by `TimeSeriesIngestedConsumer`.
- **FR-005**: On successful auto-finalization, the consumer MUST invalidate every simulation cache namespace via `ICacheService.delByPattern()` using the constants in `SIMULATION_STATE_CACHE_PATTERNS`.
- **FR-006**: On any thrown error (parse error, unknown simulation, downstream failure), the consumer MUST nack the message with `requeue=false` and log a structured error at `error` level with the offending `simulationId` (or `undefined`) so it can be discovered in Coralogix.
- **FR-007**: The consumer MUST ack the message on the happy path exactly once.
- **FR-008**: The consumer MUST propagate the incoming `traceId` (from the AMQP headers) through `TraceContext.runInContext(...)` for the whole handler execution, matching the pattern used by `TimeSeriesIngestedConsumer` today.
- **FR-009**: The existing `TimeSeriesIngestedConsumer` MUST NOT be modified. The single source of truth for who publishes what stays with the model-hook flag: when the flag is ON, ms-model-api routes to the calculator only; when OFF, it routes to the legacy path. There is no runtime filter inside ms-predictions-api. *(See "Filter decision" below.)*
- **FR-010**: The new queue + binding MUST be registered in `src/app/infrastructure/messaging/messaging.registry.ts` and the queue MUST be created at bootstrap via `main.ts` (mirroring the two existing queues), so the binding exists in RabbitMQ even before the calculator publishes its first message.

### Key Entities (no changes to persistence schema)

- **`Simulation`** *(existing)* — target of the finalization. This feature only reads and updates its `status`. No new columns.
- **`Prediction`** *(existing)* — created via the existing command. No shape change.
- **`PredictionResult`** *(existing)* — bulk-created via the existing command. No shape change.
- **`PredictionType`** *(existing)* — auto-created via `findOrCreateByName(name, unit)` when a new balance parameter arrives (e.g. `v.balance.q.in.for.eps` with unit `hm3`). No shape change.

### Contract (confirmed by teammate `calculator-service`)

- **Exchange**: `simulation-events`
- **Routing key**: `simulation.manual.balance.computed`
- **Queue** (owned by ms-predictions-api): `predictions-simulation-manual-balance`
- **Payload shape** (JSON):

```jsonc
{
  "simulationId": "uuid",
  "providerName": "volume-calculator",
  "seriesCount": 6,
  "eventsCount": 240,
  "computedAt": "2026-07-05T12:00:00Z",
  "timeSeries": [
    {
      "header": {
        "type": "instantaneous",
        "moduleInstanceId": "volume_calculator",
        "locationId": "E_08",
        "parameterId": "v.balance.q.in.for.harmonie",
        "timeStep": { "unit": "second", "multiplier": "3600" },
        "startDate": { "date": "2026-07-05", "time": "00:00:00" },
        "endDate":   { "date": "2026-07-15", "time": "00:00:00" },
        "forecastDate": { "date": "2026-07-05", "time": "00:00:00" },
        "missVal": "-999.0",
        "stationName": "Reservoir E_08",
        "units": "hm3",
        "creationDate": "2026-07-05",
        "creationTime": "12:00:00",
        "approvedDate": { "date": "2026-07-05", "time": "12:00:00" }
      },
      "events": [
        { "date": "2026-07-05", "time": "01:00:00", "value": "12.5",   "flag": "0" },
        { "date": "2026-07-05", "time": "02:00:00", "value": "-999.0", "flag": "8" }
      ]
    }
  ]
}
```

The payload is shape-compatible with the current `TimeSeriesIngestedPayload` interface — the same shape flows through `ProcessTimeSeriesCommand` after a lightweight adapter step (see plan.md).

---

## Success Criteria

- **SC-001**: After publishing one representative event with 6 series × 40 events for an existing manual simulation, calling GET `/simulations/manual/:id` returns `status=FINALIZED` within 3 seconds (p95, single-consumer prefetch=10).
- **SC-002**: The count of persisted predictions equals `payload.seriesCount`. The count of persisted `PredictionResult` rows equals the number of non-missing events across all series.
- **SC-003**: Publishing a malformed event (unknown `simulationId`) produces exactly one nack (requeue=false) and one structured error log. No queue backlog. The consumer continues to process valid events.
- **SC-004**: The existing e2e suite for `TimeSeriesIngestedConsumer` and every existing `ms-predictions-api` test passes unchanged.
- **SC-005**: The new queue is visible in `docker exec infra-rabbitmq rabbitmqctl list_queues name durable` after bootstrap, before any event is published.

---

## Assumptions

- The upstream calculator publishes the payload in the shape above, matching the `ITimeSeriesData` fields ms-predictions-api already consumes.
- The `Simulation` referenced by `simulationId` already exists in `MODEL_PROCESSING` (created earlier in the flow by `CreateManualSimulationHandler`). If it doesn't, the message is a broker artifact and MUST be nacked (requeue=false).
- `PredictionType.name` (varchar(100)) accepts strings up to ~28 chars — `v.balance.q.in.for.harmonie` and `v.balance.q.in.for.eps` both fit.
- No new migration is required. No new domain entity is required. No new port is required.
- Feature flag semantics live in ms-model-api (`model-hook` teammate). This service is blind to the flag.

---

## Out of Scope

- Changing `ProcessTimeSeriesCommand` or `ProcessTimeSeriesHandler`.
- Publishing new events from ms-predictions-api (the calculator flow reuses the existing `simulation.status.updated` failure event if failures happen, which is model-hook's responsibility, not this feature's).
- Retry policies beyond the platform-default `noAck: false` — DLQ configuration is a separate infra concern.
- Any change to the manual simulation endpoints (`POST /simulations/manual`, `GET /simulations/manual/:id`) — they observe the new predictions transparently.
- Filtering the legacy `TimeSeriesIngestedConsumer` on `providerName='manual-simulation'`. *(See filter decision.)*

---

## Filter decision (`TimeSeriesIngestedConsumer` untouched)

The rollout strategy is **single-source-of-truth per feature flag in ms-model-api**:

- Flag OFF → model-hook publishes `timeseries.ingested` for manual simulations as it does today → legacy consumer processes it. Calculator does not run. New queue receives nothing.
- Flag ON → model-hook publishes `simulation.manual.dispatched` (calculator subscribes there) instead of `timeseries.ingested` for manual simulations → calculator computes → publishes `simulation.manual.balance.computed` → new consumer processes it. Legacy queue receives no manual traffic.

Consequence: there is **no runtime overlap**. Adding a `providerName='manual-simulation'` filter to `TimeSeriesIngestedConsumer` would be defense-in-depth against a bug in model-hook that publishes to both, which we prefer to catch at the source rather than hide behind a silent drop. **We do not modify `TimeSeriesIngestedConsumer` in this feature.** The runbook (teammate `observability-runbook`) documents how to spot double-publishing (both queues receive traffic simultaneously for the same simulationId).

---

## Test Strategy Summary

- **Unit test** for the new consumer (mirroring `timeseries-ingested.consumer.spec.ts`): mock `CommandBus`, `ISimulationRepository`, `ICacheService`, `TraceContext`. Assert ack/nack behavior, cache invalidation, and traceId propagation.
- **E2E test** with Testcontainers PostgreSQL: build the NestJS module with real repositories, a mock `IMessageBroker` (no-op publish), and drive the consumer directly (call `handle(payload, ctx)`) with a synthetic RmqContext. Assert DB state via GET endpoints (`/simulations/manual/:id`, `/predictions` where applicable). Cover: happy path (6 series, auto-finalize), unknown simulation (nack), empty series (ack + warn), duplicate delivery (idempotent), FINALIZED-already (no-op).
- **Non-regression**: keep and re-run the existing `timeseries-ingested.consumer.spec.ts` unchanged. Add a smoke assertion that the legacy handler still ends in ack when fed a canonical `timeseries.ingested` payload.
