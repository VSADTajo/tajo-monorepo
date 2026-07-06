# Tasks: Calculator Integration — Model Hook

**Feature Branch**: `calculator-integration-model-hook`
**Service**: `ms-model-api`
**TDD**: strict. `[TEST]` tasks always land before the implementation task they cover.
**Parallelization**: `[P]` marks tasks that touch independent files and can run in parallel.

Legend:
- `[TEST]` — test task (must be written and failing before the implementation task it covers).
- `[P]` — safe to run in parallel with other `[P]` tasks in the same block.
- No marker — sequential; blocks subsequent tasks until done.

---

## Phase 0 — Preflight (no code changes)

- [ ] **T001** Read the spec (`.specify/specs/calculator-integration-model-hook/spec.md`) and the plan (`.specify/specs/calculator-integration-model-hook/plan.md`) end-to-end. Confirm the outgoing message contract in Section 9 of the plan matches the calculator's schema in `ms-calculator-api/src/api/schemas/simulation_input.py`. If it does not, STOP and escalate to the TL.

- [ ] **T002** Verify existing tests pass on `main` before starting: `npm run test`, `npm run test:e2e`, `npm run lint`, `npm run build`. Record baseline. Any red before the feature branch invalidates any red after.

- [ ] **T003** Pick and install a timezone library. Preference order: (1) `date-fns-tz` if already present in `package.json` of any monorepo service; (2) `luxon` otherwise. If neither is welcome, write a minimal DST-aware helper for `Europe/Madrid`. Update `package.json` if a new dep is added, and document the choice in the top of `wiski-csv-parser.ts`.

---

## Phase 1 — Messaging registry (small, isolated)

- [ ] **T004** `[TEST]` Add a unit test that verifies `Topics.SIMULATION_EVENTS.routingKeys.MANUAL_OUTPUT_FETCHED === 'simulation.manual.output.fetched'`. Location: co-locate as a small `messaging.registry.spec.ts` next to the registry, OR add the assertion inside the poller spec as a single expectation. Prefer the co-located spec — one file, one assertion.

- [ ] **T005** Update `src/app/infrastructure/messaging/messaging.registry.ts` to add `MANUAL_OUTPUT_FETCHED: 'simulation.manual.output.fetched'` under `SIMULATION_EVENTS.routingKeys`. Ensure T004 goes green.

---

## Phase 2 — Configuration surface (four env vars)

- [ ] **T006** `[TEST]` Add unit tests for `AppConfigService`: assert `useCalculatorPipeline` reads `USE_CALCULATOR_PIPELINE` as `true` only when the env var is exactly the string `'true'`, else `false`. Also cover `vobsCsvSftpPath` (empty by default), `vobsCsvTimezone` (default `'Europe/Madrid'`), and `vobsCsvFetchTimeoutMs` (default 30000). Location: `src/configuration/app/app-config.service.spec.ts` (create if missing).

- [ ] **T007** `[P]` Update `src/configuration/app/app-config.type.ts` — add four fields to `AppConfig`.

- [ ] **T008** `[P]` Update `src/configuration/app/app-config.ts` — add validator decorators and the `registerAs` factory body.

- [ ] **T009** Update `src/configuration/app/app-config.service.ts` — add four getters. Run T006 → green.

- [ ] **T010** `[P]` Update `.env.example` — append the four new env vars with comments (per Section 2.4 of the plan).

---

## Phase 3 — Message-broker port headers (backwards-compatible extension)

- [ ] **T011** `[TEST]` Add a unit test in `src/app/infrastructure/messaging/rabbitmq.service.spec.ts` (create if missing — mocks `amqplib.connect` via a factory and asserts on the mocked channel) covering:
   - `publishToTopic('x', 'y', {}, { 'x-simulation-id': 'sim-1' })` → the mocked `channel.publish` receives an options object where `headers` includes both `x-trace-id` (from `TraceContext`) and `x-simulation-id: 'sim-1'`.
   - `publishToTopic('x', 'y', {})` (no custom headers) → same as today; `headers` contains only the trace id if present, otherwise the option is omitted.
   - The existing behavior (trace id from `TraceContext`) is preserved when custom headers are omitted.

- [ ] **T012** Update `src/app/domain/ports/message-broker.port.ts` — add `AmqpHeaders` type and the optional `headers` parameter to `publishToTopic`.

- [ ] **T013** Update `src/app/infrastructure/messaging/rabbitmq.service.ts` `publishToTopic` implementation to merge trace id + custom headers. Do NOT change `publish` or `subscribeToTopic`. Run T011 → green.

- [ ] **T014** `[P]` Manual regression sweep of all `publishToTopic` call-sites in `ms-model-api`. Confirm none pass 4 arguments (they don't — verified in the plan). No code change; note in commit message.

---

## Phase 4 — WISKI CSV parser (pure function, unit-tested)

- [ ] **T015** `[TEST]` `[P]` Write `src/app/infrastructure/services/wiski-csv-parser.spec.ts` with these cases (all fixtures inline as template strings):
   - Single-block CSV with two events, `sourceTimezone: 'UTC'` → one `NormalizedTimeSeriesResult`, two events, `date`/`time` unchanged.
   - Same fixture with `sourceTimezone: 'Europe/Madrid'` in July (DST) → events shifted -2h into UTC.
   - Same fixture with `sourceTimezone: 'Europe/Madrid'` in January → events shifted -1h into UTC.
   - Multi-block CSV → two entries, correct `locationId`/`parameterId` per block.
   - Header uses tab separator (`Número de la estación\tE_08`) and colon separator (`Nombre de la serie temporal: E_08_v.obs`) — both are parsed.
   - Row with malformed date (`31/02/2026;10:00:00;12.3`) is skipped, subsequent valid row is kept.
   - Comma decimal `12,34` becomes `"12.34"` in the output event.
   - Empty CSV (only whitespace) → returns `[]`.

- [ ] **T016** Implement `src/app/infrastructure/services/wiski-csv-parser.ts` per Section 5.1 of the plan. Public API: `parseWiskiCsv(csvText, options?)`. Run T015 → green.

---

## Phase 5 — SimulationResultFetcherService v.obs fetch

- [ ] **T017** `[TEST]` `[P]` Add unit tests to (create if missing) `src/app/infrastructure/services/simulation-result-fetcher.service.spec.ts`. Cases:
   - `fetchVobsSeries('sim-1')` returns `null` when `vobsCsvSftpPath` is empty; axios is not called; a warning is logged.
   - Happy path: axios returns a CSV buffer; the mocked `parseWiskiCsv` (or the real one on an inline fixture) yields a series; the method returns it.
   - Axios rejects (network error) → returns `null`, logs a warning with `simulationId`.
   - Buffer decodes but parser throws → returns `null`, logs warning.
   - Custom timeout is passed to axios (`axios.get` mock verifies `timeout` param equals the configured value).

- [ ] **T018** Extend `SimulationResultFetcherService` with `fetchVobsSeries(simulationId)` and `decodeCsvBuffer(buffer)` per Section 6 of the plan. Inject `AppConfigService`. Do NOT touch `fetchFromFolder`. Run T017 → green.

---

## Phase 6 — SimulationRunPollerService flag branch

- [ ] **T019** `[TEST]` Extend `src/app/infrastructure/services/simulation-run-poller.service.spec.ts`:
   - Update the shared `beforeEach` to inject a mock `AppConfigService` with `useCalculatorPipeline: false` — existing cases `(a)`, `(b)`, `(c)` MUST remain green with zero change to their assertions.
   - Add `(d)`: flag ON + `fetchVobsSeries` returns `null` → publishes to `SIMULATION_EVENTS.exchange` / `MANUAL_OUTPUT_FETCHED` with `{ 'x-simulation-id': run.simulationId }` header; payload contains only the model series; no publish to the legacy topic.
   - Add `(e)`: flag ON + `fetchVobsSeries` returns a non-empty array → payload's `timeSeries` is `[...modelSeries, ...vobs]`; `seriesCount` and `eventsCount` reflect the merged content.
   - Add `(f)`: flag ON + `fetchVobsSeries` rejects (theoretically shouldn't, but defensive) → the method is wrapped so the exception does NOT propagate; publish still happens without v.obs; a warning is logged.
   - Add `(g)`: flag OFF, `fetchVobsSeries` MUST NOT be called at all (verify `mockSimulationResultFetcher.fetchVobsSeries` has zero calls).

- [ ] **T020** Update `SimulationRunPollerService`:
   - Inject `AppConfigService`.
   - Replace the single `publishToTopic` call in `processSingleRun` with the branch from Section 7.2 of the plan.
   - Wrap the `fetchVobsSeries` call in a `try/catch` (defensive, though the service itself returns `null` on failure).
   - Do NOT modify the failure path (existing `catch` that publishes `MODEL_FAILED`).
   Run T019 → green.

---

## Phase 7 — Module wiring

- [ ] **T021** `[P]` Verify `infrastructure.module.ts` — since `AppConfigModule` is registered globally in `app.module.ts` (via `ConfigModule.forRoot({ isGlobal: true })`), `AppConfigService` is available as a provider. If a boot-time DI error appears, add `AppConfigModule` to the `imports` of `InfrastructureModule`. Otherwise no change.

- [ ] **T022** `[P]` No changes to `application.module.ts` or `main.ts`. Confirm by grepping — this task is a checkpoint, not an edit.

---

## Phase 8 — Integration / e2e

- [ ] **T023** `[TEST]` Write `test/modules/simulation-run/calculator-integration.e2e-spec.ts`:
   - Setup: `createTestApp({ entities: [SimulationRun, ProviderConfig, IngestionRun], providers: [SimulationRunPollerService, SimulationResultFetcherService, { provide: IMessageBroker, useValue: mockBroker }, { provide: AppConfigService, useValue: mockAppConfig }, ...] })`.
   - Stub the SFTP HTTP layer with `axios-mock-adapter` (check what existing e2e specs use; keep parity).
   - Case A: flag OFF, valid result file → asserts `mockBroker.publishToTopic` was called once with `('model-events', 'timeseries.ingested', payload)`, and the axios mock never received `VOBS_CSV_SFTP_PATH`.
   - Case B: flag ON, valid result file + valid CSV → asserts publish to `('simulation-events', 'simulation.manual.output.fetched', payload, headers)` with v.obs merged.
   - Case C: flag ON, valid result file + CSV 404 → asserts publish to the calculator topic without v.obs; warning log captured.
   - Non-regression: run the whole existing `test/modules/simulation-run/*.e2e-spec.ts` suite to prove the branch doesn't leak.

- [ ] **T024** Implementation-side adjustments to satisfy T023 if any behavior gaps appear during the e2e run. Should be a no-op if unit tests were faithful.

---

## Phase 9 — Verification & polish

- [ ] **T025** Run the full quality gate:
   ```
   cd ms-model-api
   npm run lint
   npm run test
   npm run test:e2e
   npm run build
   ```
   All four MUST pass. The existing case `(b) should publish timeseries.ingested and mark run COMPLETED when result file is valid` must still be green without modification of its assertions.

- [ ] **T026** Manual smoke (only if a local docker compose stack is available). Steps:
   1. `cd infra/infra && docker compose up -d`.
   2. Set `USE_CALCULATOR_PIPELINE=true` in the ms-model-api `.env` (or use the exported compose env).
   3. Restart ms-model-api container.
   4. Publish a `simulation.manual.dispatched` event manually (via RabbitMQ management UI or a curl to ms-predictions-api).
   5. Drop a valid result JSON in the SFTP output folder.
   6. Watch the RabbitMQ management UI: message MUST appear on queue `calculator-simulation-manual-output`, headers MUST include `x-simulation-id`.
   7. Toggle flag OFF, repeat: message MUST appear on the queue bound to `timeseries.ingested` instead.

- [ ] **T027** Update the top of `CLAUDE.md` `Recent Changes` section (or the service's `README.md`) with a one-liner: "Added USE_CALCULATOR_PIPELINE flag and WISKI CSV enrichment for manual-simulation output routing to ms-calculator-api." Do NOT touch anything else in those docs.

- [ ] **T028** Prepare a conventional-commit message per commit (grouped logically): e.g. `feat(model): add USE_CALCULATOR_PIPELINE flag`, `feat(model): parse WISKI CSV for v.obs enrichment`, `refactor(messaging): allow custom headers on publishToTopic`.

---

## Parallelization map (which `[P]` tasks can run together)

- **Config surface**: `T007`, `T008`, `T010` are independent files — run in parallel after `T006` is red.
- **Registry** (`T005`) is independent of the config phase; can run in parallel with the whole of Phase 2 once T004 is red.
- **WISKI parser test + impl** (`T015`, `T016`) can run in parallel with Phase 5 (`T017`, `T018`) up until Phase 6 needs both to be green.
- **Post-verification** `T021` and `T022` are independent quick checks.

---

## Definition of Done

- All tasks above checked off.
- `npm run lint && npm run test && npm run test:e2e && npm run build` green.
- No changes outside `ms-model-api/`.
- No changes to `src/app/application/commands/ingestion.commands.ts` (automatic path untouched).
- No new migration files.
- Flag OFF is byte-for-byte compatible with today's outgoing message.
- Rollback tested manually or documented as a one-line env change.
