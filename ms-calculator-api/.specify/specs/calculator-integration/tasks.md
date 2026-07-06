---
description: "Task list for ms-calculator-api — calculator-integration feature"
---

# Tasks: Calculator Integration (`ms-calculator-api`)

**Input**: `spec.md`, `clarifications.md`, `plan.md` in this directory.
**Tests**: TDD is mandatory (see brief). Every implementation task has a preceding test task marked `[TEST]`.

## Format: `[ID] [P?] [TEST?] [Story] Description`

- **[P]**: Can run in parallel with other `[P]` tasks in the same phase (different files, no dependencies).
- **[TEST]**: Test task. MUST fail before its implementation counterpart runs.
- **[Story]**: `US1..US4` = the user story from `spec.md` it belongs to. `FN` = foundational, `SU` = setup, `PO` = polish.

## Path Conventions

Paths are absolute relative to the service root `ms-calculator-api/`. All test paths under `tests/`, all production paths under `src/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Repository scaffolding — nothing product-facing yet. Everything here is prerequisite.

- [ ] **T001** [SU] Create `pyproject.toml` with project metadata (`name=ms-calculator-api`, `version=0.1.0`, `python>=3.12`), runtime deps (`fastapi`, `uvicorn[standard]`, `aio-pika`, `pydantic`, `pydantic-settings`, `structlog`, `pandas`, `pytz`, `gunicorn`), and dev deps under `[project.optional-dependencies].dev` (`pytest`, `pytest-asyncio`, `httpx`, `testcontainers[rabbitmq]`, `ruff`, `mypy`). Include `[tool.ruff]`, `[tool.mypy]`, `[tool.pytest.ini_options]` sections.
- [ ] **T002** [P] [SU] Create `.env.example` listing every env var from `plan.md` §7 with default values.
- [ ] **T003** [P] [SU] Create `README.md` with: one-paragraph purpose, `Quickstart` (docker compose up, curl /health), env vars table, links to spec/plan/tasks.
- [ ] **T004** [P] [SU] Create `entrypoint.sh` for prod (dumb-init already ENTRYPOINTs the container; the script only runs the CMD via `exec "$@"`), `chmod +x`.
- [ ] **T005** [P] [SU] Create `src/__init__.py`, `src/api/__init__.py`, `src/api/routes/__init__.py`, `src/api/schemas/__init__.py`, `src/application/__init__.py`, `src/domain/__init__.py`, `src/infrastructure/__init__.py`, `src/infrastructure/amqp/__init__.py`, `src/infrastructure/logging/__init__.py`, `src/config/__init__.py`.
- [ ] **T006** [P] [SU] Create `tests/__init__.py`, `tests/unit/__init__.py`, `tests/integration/__init__.py`, `tests/e2e/__init__.py`, `tests/fixtures/` directory.
- [ ] **T007** [SU] Copy `tajo-volume_calculator/volume_calculator/` (all four `.py` files) verbatim into `src/domain/volume_calculator/`. Copy `tajo-volume_calculator/config/reservoir_parameters.json` into `src/config/reservoir_parameters.json`. Verify by importing: `python -c "from src.domain.volume_calculator import reservoir_timeseries"` runs without error (after `pip install -e .`).

**Checkpoint**: `pip install -e .[dev]` succeeds; `pytest --collect-only` returns 0 tests without error; the ported package imports cleanly.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Cross-cutting infrastructure that every user story depends on: settings loader, structured logging, and the shared FastAPI app factory.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Tests

- [ ] **T008** [P] [TEST] [FN] Write `tests/unit/test_settings.py` covering: (a) all defaults from `plan.md` §7 loaded when no env is set, (b) explicit env override wins over default, (c) invalid types raise ValidationError, (d) `RESERVOIR_CONFIG_PATH` resolves relative paths against `src/config/`.
- [ ] **T009** [P] [TEST] [FN] Write `tests/unit/test_structlog_config.py` covering: (a) `configure_logging()` produces JSON output on stdout, (b) every log line has `ts`, `level`, `service`, `event`, `message`, (c) after `bind_contextvars(simulation_id=...)`, subsequent logs include `simulation_id`, (d) `clear_contextvars()` removes it.

### Implementation

- [ ] **T010** [FN] Implement `src/config/settings.py` with pydantic-settings `Settings` class exposing all env vars from `plan.md` §7. Provide a `get_settings()` cached factory. Make `T008` pass.
- [ ] **T011** [FN] Implement `src/infrastructure/logging/structlog_config.py` with `configure_logging(level: str) -> None` that installs structlog processors (timestamper, add_log_level, add constants `service='ms-calculator-api'`, contextvars processor, JSON renderer). Export `get_logger()`. Make `T009` pass.
- [ ] **T012** [FN] Implement `src/main.py` with a `create_app()` factory returning `FastAPI(title='ms-calculator-api', ...)`. Include app lifespan (empty for now; the AMQP consumer plugs into it in later phases). Register a global exception handler that returns `ErrorResponse` JSON on all uncaught exceptions and logs via structlog. Export `app = create_app()` for uvicorn/gunicorn.

**Checkpoint**: `uvicorn src.main:app` starts on port 3011 and responds 404 to `/`. `pytest tests/unit/test_settings.py tests/unit/test_structlog_config.py` passes.

---

## Phase 3: User Story 1 — Automatic balance calculation on AMQP (Priority: P1) 🎯 MVP

**Goal**: End-to-end AMQP path — consume `simulation.manual.output.fetched`, run the pipeline, publish `simulation.manual.balance.computed` (or `.failed`).

**Independent Test**: Spin up RabbitMQ via testcontainers, publish a fixture message, subscribe an inspector to the output queue, assert one `computed` message arrives with 6 balance series per reservoir in the fixture.

### Fixtures

- [ ] **T013** [P] [US1] Create `tests/fixtures/reservoir_parameters_test.json` — a trimmed config with only `E_08` and `E_09` reservoirs (matches `TEST_RESERVOIRS` in the pipeline). Ensure it references realistic parameterIds.
- [ ] **T014** [P] [US1] Create `tests/fixtures/simulation_output_e08_e09.json` — a synthetic input event carrying Q.in.for.harmonie + 5 EPS percentiles + Q.out.for + v.obs series for E_08 and E_09, with realistic timestamps and values. Values should be picked so the expected balance output is predictable (e.g., known cumulative volumes).
- [ ] **T015** [P] [US1] Create `tests/fixtures/expected_balance_output.json` — the golden output for the input in T014. Generate initially by manually running the ported pipeline against T014's data (via a one-off script during implementation of T017); commit as the reference.

### Tests

- [ ] **T016** [P] [TEST] [US1] Write `tests/unit/test_payload_source.py` covering `AmqpPayloadSource` (the adapter in `src/infrastructure/payload_source.py`): given a `SimulationOutputPayload` (pydantic model instance), it exposes the timeSeries in the shape the ported pipeline expects (a payload dict with `timeSeries: [...]` array of `{header, events}` dicts). Test: extraction preserves headers verbatim, extraction preserves events verbatim, extraction handles empty timeSeries.
- [ ] **T017** [P] [TEST] [US1] Write `tests/unit/test_calculator_service.py`: with a `FakeBalanceEventPublisher` (in-memory list of published payloads), a `FrozenClock`, and the T014 fixture as input:
  - (a) `execute(payload)` runs and calls `publisher.publish_computed` exactly once with a payload whose `timeSeries[]` matches T015's golden output.
  - (b) When the input has zero reservoirs resolvable in the config, `publisher.publish_failed` is called instead with `errorType='config_error'`.
  - (c) When the input has invalid shape (e.g., `timeSeries` is `None`), `publish_failed` is called with `errorType='invalid_payload'`.
  - (d) `simulation_id` is bound to structlog context during `execute()` and cleared after.
- [ ] **T018** [P] [TEST] [US1] Write `tests/integration/test_calculator_pipeline.py`: run the ported pipeline directly on the T014 fixture (through `AmqpPayloadSource`) and assert byte-identical output vs T015. This is the "contract" test — proves the port did not alter math.
- [ ] **T019** [TEST] [US1] Write `tests/integration/test_amqp_consumer_publisher.py`: uses `testcontainers[rabbitmq]` to spin up a real broker.
  - (a) The service's consumer binds to `calculator-simulation-manual-output` queue on `simulation-events` exchange with routing key `simulation.manual.output.fetched`.
  - (b) Publishing the T014 fixture to that routing key causes the consumer to publish exactly one message to `simulation.manual.balance.computed` within 5 seconds.
  - (c) The output message payload matches T015 (fields: `simulationId`, `providerName='volume-calculator'`, `seriesCount`, `eventsCount`, `computedAt`, `timeSeries[]`).
  - (d) Publishing a malformed payload (e.g., missing `timeSeries`) causes exactly one `simulation.manual.balance.failed` message with `errorType='invalid_payload'`.
  - (e) The input message is acked in both cases (verified by checking queue depth after processing).

### Implementation

- [ ] **T020** [P] [US1] Implement `src/api/schemas/simulation_input.py`: pydantic v2 models `TimeSeriesEvent`, `TimeSeriesHeader`, `TimeSeriesEntry`, `SimulationOutputPayload`. Use `model_config = ConfigDict(extra='allow')` at every level.
- [ ] **T021** [P] [US1] Implement `src/api/schemas/balance_output.py`: pydantic models `BalanceTimeSeriesHeader`, `BalanceTimeSeriesEntry`, `BalanceComputedPayload`, `BalanceFailedPayload`.
- [ ] **T022** [P] [US1] Implement `src/api/schemas/errors.py`: `ErrorResponse` pydantic model with `error`, `message`, `details` fields.
- [ ] **T023** [US1] Implement `src/infrastructure/payload_source.py`: `AmqpPayloadSource` adapter — takes a `SimulationOutputPayload`, exposes `to_pipeline_payload() -> dict[str, Any]` that returns the `{ "timeSeries": [...] }` shape the pipeline's `find_optional_time_series` iterates. Make T016 pass.
- [ ] **T024** [US1] Implement `src/application/ports.py`: Python `Protocol` classes `BalanceEventPublisherPort`, `ClockPort`.
- [ ] **T025** [US1] Implement `src/application/calculator_service.py`: `CalculatorService` class with constructor `__init__(config_path: Path, publisher: BalanceEventPublisherPort, clock: ClockPort)`. Method `async execute(payload: SimulationOutputPayload) -> None`:
  1. Bind `simulation_id` to structlog context.
  2. Log `calculation.started`.
  3. Validate: if `timeSeries` empty or None → publish failed with `invalid_payload`, return.
  4. Adapt payload via `AmqpPayloadSource`.
  5. Modified pipeline invocation: because the current pipeline reads from `file_pattern`, we need a helper `run_pipeline_from_payload(config, payload_dict, pipeline='harmonie'|'eps')` that mirrors `run_reservoir_pipeline` but skips `load_signal_payloads` and instead uses the provided payload dict as the single "payload" for **all** data sources. Implement this helper here (not in the pure `domain/volume_calculator/` package). It internally routes signals by parameterId lookup, exactly as the pipeline does with file-loaded payloads.
  6. Run twice: once with `pipeline='harmonie'`, once with `pipeline='eps'`. Merge the two `forecast` DataFrames on `(reservoir, timestamp)` so the resulting timeSeries payload has all 6 balance columns.
  7. Build `BalanceComputedPayload` via `build_balance_time_series_payload` + wrap with the required top-level fields (`simulationId`, `providerName`, etc.).
  8. Log `calculation.completed`, publish via `publisher.publish_computed`, log `publisher.event_sent`, clear context.
  9. On config/pipeline exceptions, publish `failed` with the right `errorType`; on unexpected exceptions, re-raise (the consumer nacks).
  Make T017 and T018 pass.
- [ ] **T026** [US1] Implement `src/infrastructure/amqp/registry.py`: constants for `EXCHANGE_SIMULATION_EVENTS`, `ROUTING_KEY_OUTPUT_FETCHED`, `ROUTING_KEY_BALANCE_COMPUTED`, `ROUTING_KEY_BALANCE_FAILED`, `QUEUE_CALCULATOR_INPUT`.
- [ ] **T027** [US1] Implement `src/infrastructure/amqp/connection.py`: async `AmqpConnection` class managing a robust `aio_pika.RobustConnection` and a shared publisher channel. Exposes `connect()`, `close()`, `channel()`, `is_open()` for health checks.
- [ ] **T028** [US1] Implement `src/infrastructure/amqp/publisher.py`: `AmqpBalanceEventPublisher` implements `BalanceEventPublisherPort`. Declares the exchange (idempotent), publishes with `content_type=application/json`, `delivery_mode=2`, sets header `x-simulation-id`. Uses publisher confirms.
- [ ] **T029** [US1] Implement `src/infrastructure/amqp/consumer.py`: `SimulationOutputConsumer` — declares exchange + queue, binds queue to routing key, starts consumer with manual ack. On each message:
  1. Parse as `SimulationOutputPayload` (validation errors → publish failed + ack).
  2. Delegate to `CalculatorService.execute()`.
  3. Ack on success; on `RuntimeError`/`ConnectionError` from publisher: nack with requeue=false.
- [ ] **T030** [US1] Wire everything into `src/main.py` lifespan: on startup, create AMQP connection, start consumer as a background task, log `startup.amqp_connected` + `startup.amqp_bound` + `startup.http_ready`. On shutdown, cancel consumer, close connection, log `shutdown.begin`. Make T019 pass.

**Checkpoint**: `pytest tests/unit tests/integration/test_calculator_pipeline.py tests/integration/test_amqp_consumer_publisher.py` passes. The manual-simulation event round-trip works end-to-end on the fixture.

---

## Phase 4: User Story 2 — Synchronous HTTP calculation (Priority: P2)

**Goal**: `POST /calculate` accepts the same payload and returns the computed output synchronously.

**Independent Test**: `pytest tests/e2e/test_post_calculate.py` — hit the endpoint with the T014 fixture, assert the response matches T015.

### Tests

- [ ] **T031** [P] [TEST] [US2] Write `tests/e2e/test_post_calculate.py`:
  - (a) Valid payload → 200, response body matches T015 golden output.
  - (b) Missing `timeSeries` → 400 with `ErrorResponse` shape (`error='invalid_payload'`).
  - (c) `timeSeries` is not an array → 400.
  - (d) Empty payload body → 400.
  - (e) Valid payload with unknown extra fields → 200 (extra fields ignored due to `extra='allow'`).
  - (f) The same `simulationId` in request appears in response.
  - (g) Response is idempotent: two identical requests produce byte-identical responses.

### Implementation

- [ ] **T032** [US2] Implement `src/api/routes/calculate.py`: `POST /calculate` endpoint accepting `SimulationOutputPayload`, invoking `CalculatorService.execute_sync()` (a new synchronous-return variant) with an in-memory publisher that captures the payload instead of publishing to AMQP, returning the captured payload as JSON. Refactor `CalculatorService` if needed to expose `compute(payload) -> BalanceComputedPayload` returning the payload directly, letting the caller (either the AMQP consumer or the HTTP handler) decide what to do with it. Update `execute()` from T025 to call `compute()` then publish. Update tests T017 accordingly (small refactor — should be same assertions on the mock publisher).
- [ ] **T033** [US2] Wire `POST /calculate` into `src/main.py`'s app factory. Make T031 pass.

**Checkpoint**: `pytest tests/e2e/test_post_calculate.py` passes.

---

## Phase 5: User Story 3 — Observability (Priority: P2)

**Goal**: Every processing log line has `simulation_id`; log events cover the full lifecycle.

### Tests

- [ ] **T034** [P] [TEST] [US3] Write `tests/unit/test_log_shape.py`: run `CalculatorService.execute()` on the T014 fixture with a captured log stream (via `structlog.testing.capture_logs()` or writing to a `StringIO`). Assert:
  - (a) Every log line during processing has `simulation_id: <T014.simulationId>`, `service: 'ms-calculator-api'`, `ts`, `level`, `event`, `message`.
  - (b) The sequence of events includes at least: `calculation.started`, `calculation.completed`, `publisher.event_sent` (in that order).
  - (c) After `execute()` returns, `structlog.contextvars` is cleared (a follow-up log has no `simulation_id`).
  - (d) When a reservoir is skipped due to missing config, exactly one `calculation.reservoir_skipped` warning is emitted with `reservoir_id`.
- [ ] **T035** [P] [TEST] [US3] Write `tests/e2e/test_log_shape_http.py`: hit `POST /calculate` with the T014 fixture, capture stdout via `capsys`, assert every JSON line during the request has `simulation_id` bound.

### Implementation

- [ ] **T036** [US3] Audit `CalculatorService`, `SimulationOutputConsumer`, `POST /calculate` handler, and `AmqpBalanceEventPublisher` for the canonical log events listed in `plan.md` §8.3. Add any missing ones. Make T034 and T035 pass.
- [ ] **T037** [US3] Add a middleware / route dependency in FastAPI that binds `simulation_id` to structlog when the request body contains it, and clears it after the response. This mirrors the consumer pattern.

**Checkpoint**: `pytest tests/unit/test_log_shape.py tests/e2e/test_log_shape_http.py` passes.

---

## Phase 6: User Story 4 — Health and API discoverability (Priority: P3)

**Goal**: `/health` and `/docs` work.

### Tests

- [ ] **T038** [P] [TEST] [US4] Write `tests/e2e/test_get_health.py`:
  - (a) With AMQP up (testcontainer) → 200, body `{status: 'ok', checks: {amqp: 'ok'}}`.
  - (b) With AMQP intentionally disconnected → 503, body `{status: 'degraded', checks: {amqp: 'down'}}`.
- [ ] **T039** [P] [TEST] [US4] Write `tests/e2e/test_openapi_docs.py`:
  - (a) `GET /docs` returns 200 with `text/html` content-type and a body containing `swagger-ui`.
  - (b) `GET /openapi.json` returns a valid OpenAPI schema listing `POST /calculate`, `GET /health`.

### Implementation

- [ ] **T040** [US4] Implement `src/api/routes/health.py`: `GET /health` endpoint. Uses `AmqpConnection.is_open()` (or a lightweight `channel.declare` probe with a short timeout). Return the shape from `plan.md` §8.2.
- [ ] **T041** [US4] Wire `GET /health` into `src/main.py`. FastAPI's `/docs` and `/openapi.json` are auto-served by the framework; verify they are enabled. Make T038 and T039 pass.

**Checkpoint**: `pytest tests/e2e/test_get_health.py tests/e2e/test_openapi_docs.py` passes.

---

## Phase 7: Docker, CI/CD, registry (packaging)

- [ ] **T042** [P] [PO] Write `Dockerfile` per `plan.md` §9.1 (multi-stage: wheels → dev → prod). Verify `docker build --target dev -t ms-calculator-api-dev .` completes.
- [ ] **T043** [P] [PO] Write `docker-compose.yml` per `plan.md` §9.2. Verify `docker compose up -d` starts the service and it responds on port 3011 (with `infra-network` external present).
- [ ] **T044** [P] [PO] Write `Jenkinsfile` per `plan.md` §9.3. Manual sanity check only — the pipeline is exercised on push.
- [ ] **T045** [PO] Update `/Users/sebastianaliceio/Desktop/proyects/flowCat/tajo-monorepo/.claude/rules/01-global.md`: append `ms-calculator-api` row to the Monorepo Service Registry table between `ms-authentication-api` and `ms-sftp-api` (respecting port ordering is not required — this is 3011 and belongs at the end of the list). Verify with `grep ms-calculator-api ...01-global.md`.

**Checkpoint**: `docker compose up -d && curl localhost:3011/health` returns 200; the service appears in `01-global.md`.

---

## Phase 8: Polish

- [ ] **T046** [P] [PO] Run `ruff check src tests --fix` and `ruff format src tests`. Commit the result.
- [ ] **T047** [P] [PO] Run `mypy src` and address any type errors (allow `Any` for pandas-touching code; annotate everything else).
- [ ] **T048** [P] [PO] Add a `.dockerignore` excluding `tests/`, `.venv/`, `__pycache__/`, `.pytest_cache/`, `.mypy_cache/`, `.ruff_cache/`, `.env`, `.git/`, `.specify/`.
- [ ] **T049** [PO] Regenerate `tests/fixtures/expected_balance_output.json` if any pipeline-adjacent code (T023, T025) changed the output shape — run the golden generator, diff, commit if intentional.
- [ ] **T050** [PO] End-to-end smoke test: with `infra-rabbitmq` running (via the monorepo's `infra/infra/docker-compose.yml`), start the service via docker compose, publish a fixture message using `rabbitmqadmin publish`, subscribe with a one-liner script, verify the response arrives. Document the exact commands in `README.md` under a `Manual smoke test` section.

**Checkpoint**: All lint/type/format checks green. Golden output stable. Manual smoke test documented and passes.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)** — no dependencies; start immediately.
- **Phase 2 (Foundational)** — depends on Phase 1. BLOCKS every user story.
- **Phase 3 (US1)** — depends on Phase 2. MVP.
- **Phase 4 (US2)** — depends on Phase 3 (reuses `CalculatorService.compute()`).
- **Phase 5 (US3)** — depends on Phase 3 (observability wraps existing code paths).
- **Phase 6 (US4)** — depends on Phase 2 + Phase 3 (needs AMQP connection for health check).
- **Phase 7 (Packaging)** — depends on Phase 3 minimum; ideally all user stories done for a full container build.
- **Phase 8 (Polish)** — depends on all previous phases.

### Within Each Phase

- All tasks marked `[TEST]` MUST be written and observed failing before the corresponding implementation task runs.
- Test files marked `[P]` can be written in parallel (they touch different files).
- Fixtures (T013-T015) MUST exist before their consuming tests (T016+) run.

### Parallel Opportunities

- **Phase 1**: T002, T003, T004, T005, T006 all `[P]` — parallelisable after T001.
- **Phase 2**: T008 and T009 can be written in parallel.
- **Phase 3**: T013/T014/T015 fixtures in parallel; T016/T017/T018/T019 test files in parallel; T020/T021/T022 pydantic schema files in parallel.
- **Phase 7**: T042/T043/T044 in parallel.

---

## Implementation Strategy

### MVP-first path

1. Phase 1 (setup) → Phase 2 (foundational) → Phase 3 (US1) → **STOP AND VALIDATE**.
2. Present the AMQP round-trip to the TL as MVP.
3. Continue with Phase 4 (US2) → Phase 5 (US3) → Phase 6 (US4) → Phase 7 (packaging) → Phase 8 (polish).

### Blocked-external note

The `predictions-consumer` teammate cannot fully validate their side until Phase 3 finishes and the topic contract is live. Communicate the exact routing key and payload shape to the TL as soon as Phase 3 is done — even before Phases 4–8.

---

## Task Summary

| Phase | Task count | Tests | Impl | Notes |
|-------|-----------|-------|------|-------|
| 1. Setup | 7 | 0 | 7 | Scaffolding, ports the domain package |
| 2. Foundational | 5 | 2 | 3 | Settings + logging + FastAPI factory |
| 3. US1 (MVP) | 18 | 4 | 11 | AMQP round-trip + fixtures |
| 4. US2 | 3 | 1 | 2 | HTTP POST /calculate |
| 5. US3 | 4 | 2 | 2 | Observability |
| 6. US4 | 4 | 2 | 2 | /health + /docs |
| 7. Packaging | 4 | 0 | 4 | Dockerfile + compose + Jenkinsfile + registry |
| 8. Polish | 5 | 0 | 5 | Lint, mypy, dockerignore, smoke |
| **Total** | **50** | **11** | **36** + 3 golden fixtures | — |

---

## Notes

- The ported `src/domain/volume_calculator/` MUST remain unmodified from the source repo `tajo-volume_calculator/`. Any adaptation to accept in-memory payloads happens in `src/application/calculator_service.py` (via the `run_pipeline_from_payload` helper described in T025). This makes future upstream syncs trivial.
- Commit frequently (after each task or logical group). Use conventional commits, e.g., `feat(calculator): add SimulationOutputConsumer` / `test(calculator): golden output for E_08/E_09`.
- The `[TEST]` gate MUST be observed — do not skip TDD. If a test proves impossible to write before implementation (rare — e.g., pandas edge case), document why in the task comment before proceeding.
- Never use `print()` or unstructured logging. All logs go through `structlog.get_logger()`.
