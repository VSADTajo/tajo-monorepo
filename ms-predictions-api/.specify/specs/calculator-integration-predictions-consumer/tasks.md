# Tasks: Calculator Integration — Predictions Consumer

**Input**: `spec.md` + `plan.md` from `.specify/specs/calculator-integration-predictions-consumer/`
**Service**: `ms-predictions-api`
**Ordering rule**: TDD strict — every implementation task is preceded by its `[TEST]` task. `[P]` marks tasks that can be worked on in parallel because they touch disjoint files.

## Legend
- `[P]` parallelizable with sibling `[P]` tasks (different files, no interdep)
- `[TEST]` test task — MUST be red before its paired implementation task runs
- `US<N>` maps to the user stories in `spec.md`

---

## Phase 1 — Setup & Foundational

**Purpose**: registry + bootstrap wiring so the new queue exists in RabbitMQ before any code depends on it. No behavior yet; this is the plumbing every subsequent task consumes.

- [x] **T001** [P] Add the new constants to `src/app/infrastructure/messaging/messaging.registry.ts`:
  - `Queues.PREDICTIONS_SIMULATION_MANUAL_BALANCE = 'predictions-simulation-manual-balance'`
  - `Topics.SIMULATION_EVENTS.routingKeys.MANUAL_BALANCE_COMPUTED = 'simulation.manual.balance.computed'`
  - New entry in `TopicSubscriptions` binding the new queue to the `simulation-events` exchange on the new routing key.
  - Do NOT rename, reorder, or delete existing entries.

- [x] **T002** Update `src/main.ts` to add a third `connectMicroservice()` block (inside the existing `if (rabbitmqConfig.enabled)` guard) for `Queues.PREDICTIONS_SIMULATION_MANUAL_BALANCE`. Mirror the two existing blocks (`durable: true`, `x-dead-letter-exchange: ''`, `prefetchCount`, `noAck: false`). Update the "RabbitMQ consumers listening on: ..." log line to include the new queue.
  - Depends on: T001

**Checkpoint**: `npm run build` compiles. `npm run start:dev` starts and logs the three queues. No functional behavior yet.

---

## Phase 2 — User Story 1 (P1): Persist Balance Series & Auto-Finalize

**Goal**: end-to-end happy path — event in → predictions persisted → simulation finalized.

**Independent Test**: e2e — publish 6 balance series for an existing manual simulation via a direct consumer invocation, then `GET /simulations/manual/:id` returns `status='FINALIZED'` and predictions count matches.

### Fixtures & test scaffolding

- [x] **T003** [P] [TEST] Create factory `test/factories/simulation-manual-balance-computed.factory.ts` exporting `buildBalanceComputedPayload(overrides?)`. Returns a well-formed `SimulationBalanceComputedEvent` with one `timeSeries` entry per parameter in the confirmed contract (`harmonie`, `eps.10`, `eps.25`, `eps.50`, `eps.75`, `eps.90`), each with a small number of events including one `missVal='-999.0'` sample.

- [x] **T004** [P] [TEST] Author the failing unit spec `src/app/application/consumers/simulation-manual-balance-computed.consumer.spec.ts` with:
  - Happy path: 3 series, `MODEL_PROCESSING` sim → `commandBus.execute` called 3× with `ProcessTimeSeriesCommand`; sim `finalize()` invoked; `simulationRepository.update` called; `delByPattern('simulations:*')` and `delByPattern('manual-simulation:*')` invoked; `ack` called once.
  - Assert each dispatched `ProcessTimeSeriesCommand` carries `.simulationId` from payload and `.providerName === 'volume-calculator'`.
  - Assert `traceContext.runInContext` is called once with the traceId extracted from the AMQP headers.
  - This file MUST fail (module not implemented yet).

### Implementation

- [x] **T005** Implement `src/app/application/consumers/simulation-manual-balance-computed.consumer.ts` following the sketch in `plan.md` §5:
  - `@Controller()` + `@EventPattern(Topics.SIMULATION_EVENTS.routingKeys.MANUAL_BALANCE_COMPUTED)`.
  - DI: `Logger`, `CommandBus`, `ISimulationRepository`, `ICacheService`, `TraceContext`.
  - Wrap handler body in `traceContext.runInContext(extractTraceId(msg.properties?.headers), async () => { ... })`.
  - Loop `payload.timeSeries[]` and dispatch one `ProcessTimeSeriesCommand({ series: toTimeSeriesData(...), providerName: payload.providerName ?? 'volume-calculator', simulationId: payload.simulationId })` each.
  - After loop: `simulationRepository.findById(simulationId)`; if `status !== FINALIZED`, call `.finalize()`, `simulationRepository.update(...)`, then invalidate `SIMULATION_STATE_CACHE_PATTERNS`.
  - Ack on success.
  - Define `toTimeSeriesData()` and the payload interfaces as private helpers inside the same file (see plan §3 & §4).
  - Depends on: T003, T004
  - Blocks: T007

- [x] **T006** Register `SimulationManualBalanceComputedConsumer` in the `controllers: [...]` array of `src/app/application/application.module.ts`. Do NOT touch the existing entries.
  - Depends on: T005

### E2E test

- [x] **T007** [TEST] Add `test/modules/manual-simulation/consume-balance-computed.e2e-spec.ts` covering US1 acceptance scenario #1 & #2:
  - `beforeAll` builds a test module via `createTestApp` with real repositories (Testcontainer Postgres) and no-op `IMessageBroker` / `ICacheService`.
  - Seed a manual simulation by calling `POST /simulations/manual` and then transitioning it to `MODEL_PROCESSING` via the repository (mirror the shortcut used in `create-manual-simulation.e2e-spec.ts`).
  - Invoke `consumer.handle(buildBalanceComputedPayload({ simulationId }), mockRmqContext)` directly.
  - Assert: `GET /simulations/manual/:id` returns `status='FINALIZED'`; `GET /predictions?simulationId=...` (or equivalent) returns 6 predictions with the expected `parameterId → PredictionType.name` mapping, `percentile=null` for `harmonie`, `percentile=10|25|50|75|90` for `eps.*`, and units `hm3`.
  - Depends on: T005, T006

**Checkpoint US1**: MVP delivered. Balance events materialize as predictions and the simulation finalizes.

---

## Phase 3 — User Story 3 (P1): Reject Malformed Events

**Goal**: resilience — no crash, no requeue loop on bad input.

**Independent Test**: e2e — publish payloads that lack `simulationId` / reference an unknown simulation / carry `timeSeries=[]`; assert nack/ack behavior and structured logs.

- [x] **T008** [P] [TEST] Extend the unit spec from T004 with cases:
  - Missing `simulationId` → nack (requeue=false), commandBus untouched.
  - `simulationRepository.findById` throws → nack (requeue=false), commandBus untouched.
  - `commandBus.execute` throws mid-batch → nack (requeue=false), no partial finalize.
  - `timeSeries=[]` → ack, warning log, commandBus untouched, no finalize.
  - `missVal='-999.0'` event → adapted to `{ isMissing: true, value: 0 }`.
  - `simulation.status === FINALIZED` already → ack, no `update`, no `delByPattern`.

- [x] **T009** Refine the consumer implementation (from T005) as needed to make T008 green. Expected small deltas (guards, error branches) — no structural rework should be required if T005 followed the plan.
  - Depends on: T008

- [x] **T010** [TEST] Extend the e2e spec (from T007) with US3 scenarios:
  - Unknown `simulationId` → after `consumer.handle(...)`, no new predictions in DB, seeded simulation unchanged, mock `nack` was called with `(msg, false, false)`.
  - Empty `timeSeries` → seeded simulation still in `MODEL_PROCESSING`, `ack` called.
  - Duplicate delivery → invoke `handle` twice with the same payload; assert final DB state has 6 predictions (not 12), simulation `FINALIZED`, no exception.
  - Depends on: T009

**Checkpoint US3**: consumer survives bad input, docs and logs surface the failure clearly.

---

## Phase 4 — User Story 2 (P1): Legacy Consumer Non-Regression

**Goal**: prove the legacy `TimeSeriesIngestedConsumer` is untouched and still processes `timeseries.ingested` payloads correctly.

**Independent Test**: run the pre-existing `timeseries-ingested.consumer.spec.ts` and an added mixed-consumer e2e assertion.

- [x] **T011** [TEST] In the same e2e file from T007, add an `it(...)` block that:
  - Instantiates `TimeSeriesIngestedConsumer` in the test module (already covered by the injection graph).
  - Feeds a canonical `timeseries.ingested` payload (build via a shared factory OR inline literal) for a **different** simulation id.
  - Asserts `ack` was called on the legacy consumer's mock channel and that the corresponding predictions appear via GET.

- [x] **T012** Run `npm run test -- --testPathPattern=timeseries-ingested.consumer.spec` and verify all pre-existing legacy tests pass without change. No file edit expected. If any test fails, STOP and escalate to TL — the plan mandates zero-touch on the legacy consumer.
  - Depends on: T011

**Checkpoint US2**: legacy pipeline unchanged, mixed-consumer e2e green.

---

## Phase 5 — User Story 4 (P1): Auto-Finalization & Idempotency

**Goal**: verify the finalize + cache-invalidate contract in depth.

**Independent Test**: e2e — reproduce the finalize scenario twice and observe idempotency + cache invalidation calls.

- [x] **T013** [TEST] In the e2e spec, add an `it(...)` block that:
  - Uses a `jest.spyOn(cacheService, 'delByPattern')` (or the equivalent probe on the injected mock) to assert both `'simulations:*'` and `'manual-simulation:*'` are invalidated exactly once during the happy-path run.
  - After finalization, invokes `consumer.handle(...)` with the same payload again and asserts `delByPattern` is NOT called a second time (already-FINALIZED short-circuit).
  - Depends on: T007

- [x] **T014** If T013 exposes a gap in the implementation, fix it. Otherwise mark done.
  - Depends on: T013

**Checkpoint US4**: finalize semantics identical to the legacy consumer, cache invalidation coherent.

---

## Phase 6 — Validation Gate

- [x] **T015** `npm run lint` from `ms-predictions-api/` — must be clean.
- [x] **T016** `npm run test` — unit suite green (includes new spec + legacy specs unchanged).
- [x] **T017** `npm run test:e2e` — integration suite green (includes new e2e + all pre-existing e2e). Requires Docker running.
- [x] **T018** `npm run build` — TypeScript compiles under `strict`.
- [ ] **T019** Smoke check (manual, documented in the PR description): start the service against local infra, connect to RabbitMQ management UI at `http://localhost:15672`, verify that the queue `predictions-simulation-manual-balance` exists and is bound to exchange `simulation-events` with routing key `simulation.manual.balance.computed`.

**Checkpoint gate**: all green → notify TL for `/speckit-implement` approval or, if already implemented, ready for PR review.

---

## Dependency Graph (concise)

```
T001 ─┬─▶ T002 ────────────────────────────────▶ T015-T019
      │
T003 ─┼─▶ T005 ─▶ T006 ─▶ T007 ─▶ T011 ─▶ T012
T004 ─┘        └─▶ T008 ─▶ T009 ─▶ T010
                                  └─▶ T013 ─▶ T014
```

`[P]` tasks (T001/T003/T004/T008) can start concurrently; the merge points are T002 (bootstrap needs T001), T005 (consumer needs the failing test T004 + factory T003), and the sequential test/impl chain thereafter.

## Notes

- **Do NOT modify** `ProcessTimeSeriesCommand`, `ProcessTimeSeriesHandler`, `TimeSeriesIngestedConsumer`, or `SimulationStatusUpdatedConsumer` under any task. If a test suggests otherwise, STOP and escalate.
- **No migration** is created in this feature; if any task appears to require a schema change, STOP — that's a sign the plan drifted.
- **Path aliases** (`@application`, `@domain`, `@infrastructure`) must be used in `src/`. Tests use relative imports (matches the pattern in `test/modules/**`).
