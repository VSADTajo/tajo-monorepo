# Implementation Plan — Calculator Integration (`ms-calculator-api`)

**Spec**: `./spec.md`
**Clarifications**: `./clarifications.md`
**Feature branch**: `calculator-integration`
**Target service**: `ms-calculator-api/` (new — Python 3.12 + FastAPI, port 3011)

---

## 1. Architectural Overview

`ms-calculator-api` is a **stateless, hybrid Python service**:

- **HTTP server** (FastAPI + uvicorn) exposing `POST /calculate`, `GET /health`, `GET /docs`.
- **AMQP consumer** (aio-pika) subscribing to `simulation-events` exchange with routing key `simulation.manual.output.fetched`.
- **AMQP publisher** (aio-pika) publishing to the same exchange with routing keys `simulation.manual.balance.computed` (success) and `simulation.manual.balance.failed` (validation/config errors).

Both the consumer and the HTTP handler share the same in-memory application service (`CalculatorService`) which wraps the ported `volume_calculator` package. The service is **fully in-memory** — no PostgreSQL, no Redis. Config (`reservoir_parameters.json`) is bundled and loaded once at startup.

```
                        ┌──────────────────────────────────────────────┐
                        │ ms-calculator-api (port 3011)                │
                        │                                              │
      RabbitMQ          │   ┌──────────────┐    ┌──────────────────┐   │
 simulation-events ─────┼─▶ │ AMQP         │───▶│ CalculatorService│   │
 (routing key           │   │ Consumer     │    │  (application)   │   │
  simulation.manual     │   └──────────────┘    │                  │   │      RabbitMQ
  .output.fetched)      │                       │  volume_calc     │   │  simulation-events
                        │   ┌──────────────┐    │  pipeline        │───┼─▶  (routing key
   HTTP POST ───────────┼─▶ │ FastAPI      │───▶│  (domain)        │   │    simulation.manual
   /calculate           │   │ /calculate   │    │                  │   │    .balance.{computed|
                        │   └──────────────┘    └───────┬──────────┘   │    failed})
                        │                               │              │
                        │   ┌──────────────┐    ┌───────▼──────────┐   │
   HTTP GET ────────────┼─▶ │ FastAPI      │    │ AMQP Publisher   │   │
   /health, /docs       │   │ /health,/docs│    │ (infrastructure) │   │
                        │   └──────────────┘    └──────────────────┘   │
                        │                                              │
                        │   structlog JSON → stdout (all log lines)    │
                        └──────────────────────────────────────────────┘
```

**Layering (hexagonal-lite adapted for Python):**

- **`api/`** — HTTP adapter (FastAPI routes + pydantic request/response schemas).
- **`application/`** — Use-case orchestrator (`CalculatorService`) that composes the domain package with the AMQP publisher.
- **`domain/`** — The ported `volume_calculator` package (pure Python, zero framework deps).
- **`infrastructure/`** — AMQP consumer/publisher (aio-pika), structured logging setup, config loader.
- **`config/`** — Settings (pydantic-settings) + bundled `reservoir_parameters.json`.

The domain layer (`volume_calculator/`) is copied verbatim from `tajo-volume_calculator/volume_calculator/` into `src/domain/volume_calculator/`. **No modifications** to the pipeline math. What changes is how it is *invoked*: the current CLI loads from file globs; the service loads from an in-memory payload. A thin adapter (`payload_source.py`) constructs the equivalent input structure the pipeline expects, without touching the pipeline code itself.

---

## 2. Directory Structure

```
ms-calculator-api/
├── src/
│   ├── __init__.py
│   ├── main.py                              # FastAPI app factory + AMQP consumer lifespan
│   │
│   ├── api/
│   │   ├── __init__.py
│   │   ├── routes/
│   │   │   ├── __init__.py
│   │   │   ├── calculate.py                 # POST /calculate
│   │   │   └── health.py                    # GET /health
│   │   └── schemas/
│   │       ├── __init__.py
│   │       ├── simulation_input.py          # pydantic: SimulationOutputPayload
│   │       ├── balance_output.py            # pydantic: BalanceComputedPayload
│   │       └── errors.py                    # pydantic: ErrorResponse
│   │
│   ├── application/
│   │   ├── __init__.py
│   │   └── calculator_service.py            # CalculatorService (orchestrates pipeline + publish)
│   │
│   ├── domain/
│   │   ├── __init__.py
│   │   └── volume_calculator/               # ← copied verbatim from tajo-volume_calculator/
│   │       ├── __init__.py
│   │       ├── __main__.py
│   │       ├── reservoir_timeseries.py
│   │       └── location_parameters.py
│   │
│   ├── infrastructure/
│   │   ├── __init__.py
│   │   ├── amqp/
│   │   │   ├── __init__.py
│   │   │   ├── connection.py                # aio-pika connection factory
│   │   │   ├── consumer.py                  # SimulationOutputConsumer
│   │   │   ├── publisher.py                 # BalanceEventPublisher
│   │   │   └── registry.py                  # exchange + routing key + queue name constants
│   │   ├── logging/
│   │   │   ├── __init__.py
│   │   │   └── structlog_config.py          # structlog setup (JSON renderer, simulation_id binding)
│   │   └── payload_source.py                # Adapter: AMQP payload → volume_calculator inputs
│   │
│   └── config/
│       ├── __init__.py
│       ├── settings.py                      # pydantic-settings (env loader)
│       └── reservoir_parameters.json        # ← copied from tajo-volume_calculator/config/
│
├── tests/
│   ├── __init__.py
│   ├── conftest.py                          # pytest fixtures (test app, rabbitmq container, fixtures)
│   ├── fixtures/
│   │   ├── simulation_output_full.json      # full 50-reservoir payload for perf tests
│   │   ├── simulation_output_e08_e09.json   # test-mode payload
│   │   ├── reservoir_parameters_test.json   # test config
│   │   └── expected_balance_output.json     # golden output for byte-identical comparison
│   │
│   ├── unit/
│   │   ├── test_payload_source.py           # AMQP payload → pipeline input adapter
│   │   ├── test_calculator_service.py       # orchestration (with mocked publisher)
│   │   ├── test_structlog_config.py         # log shape assertions
│   │   └── test_settings.py                 # env var loading
│   │
│   ├── integration/
│   │   ├── test_amqp_consumer_publisher.py  # testcontainers-python RabbitMQ, publish → consume → publish
│   │   └── test_calculator_pipeline.py      # end-to-end pipeline on fixture (no AMQP)
│   │
│   └── e2e/
│       ├── test_post_calculate.py           # FastAPI TestClient POST /calculate
│       ├── test_get_health.py               # GET /health with and without AMQP
│       └── test_openapi_docs.py             # GET /docs returns Swagger UI
│
├── Dockerfile                                # multi-stage: dev (uvicorn --reload), build, prod (gunicorn+uvicorn workers)
├── Jenkinsfile                               # CI/CD: install → lint → test → build → docker build → deploy
├── docker-compose.yml                        # standalone, joins infra-network external
├── pyproject.toml                            # runtime + dev deps, tool config (ruff, mypy, pytest)
├── .env.example                              # env template
├── .gitignore
├── entrypoint.sh                             # prod entrypoint (dumb-init + gunicorn)
├── README.md                                 # service overview + run instructions
└── .specify/
    ├── feature.json
    ├── memory/                               # (empty; extends root constitution)
    ├── templates/                            # spec/plan/tasks templates
    └── specs/
        └── calculator-integration/
            ├── spec.md
            ├── clarifications.md
            ├── plan.md                       # this file
            ├── tasks.md
            └── checklists/                   # populated by /speckit-checklist
```

---

## 3. Stack

| Layer | Choice | Version | Justification |
|-------|--------|---------|---------------|
| Runtime | Python | 3.12 | Latest stable with `slots=True` on dataclasses, PEP 695 type params if needed |
| Web framework | FastAPI | ^0.115 | Native OpenAPI, pydantic v2 integration, async |
| ASGI server (dev) | uvicorn | ^0.30 | Fast, `--reload` |
| ASGI server (prod) | gunicorn + uvicorn workers | ^22 | Battle-tested process manager + async workers |
| AMQP client | aio-pika | ^9.4 | Async-native, robust reconnect, high-level abstractions |
| Data | pandas | ^2.0 | Required by ported pipeline (transitive) |
| Data | pytz | ^2024.1 | Required by ported pipeline (transitive) |
| Validation | pydantic v2 | ^2.9 | Request/response DTOs and settings |
| Settings | pydantic-settings | ^2.5 | Env var loading, `.env` file support |
| Logging | structlog | ^24.4 | JSON structured logging, contextvars support for simulation_id binding |
| Testing | pytest | ^8.3 | Standard |
| Testing | pytest-asyncio | ^0.23 | asyncio tests for the consumer |
| Testing | httpx | ^0.27 | FastAPI TestClient uses httpx for async |
| Testing | testcontainers[rabbitmq] | ^4.8 | Real RabbitMQ in a container for integration tests |
| Lint | ruff | ^0.6 | Fast linter + formatter |
| Type checking | mypy | ^1.11 | Strict mode on `src/`; pipeline is typed via `Any` because pandas is dynamic |
| Container base | python:3.12-slim | — | Small, glibc, includes wheels for pandas |
| Process supervisor (prod) | dumb-init | latest | Correct signal forwarding under docker |

---

## 4. Data Contracts

### 4.1 Input (consumed from AMQP + POST /calculate body)

```typescript
interface SimulationOutputPayload {
  // Correlation id — propagated to every log line and to the output event
  simulationId: string;                       // uuid, required

  // Provider identification (matches ms-model-api's current publish)
  providerName: string;                       // expected "manual-simulation"; NOT validated strictly — service accepts any
  providerType?: string;                      // optional pass-through
  providerConfigId?: string;                  // optional pass-through
  outputFolder?: string;                      // optional pass-through, informational only
  seriesCount?: number;                       // optional; not used
  eventsCount?: number;                       // optional; not used

  // Payload
  timeSeries: TimeSeriesEntry[];              // required, non-empty
}

interface TimeSeriesEntry {
  header: TimeSeriesHeader;                   // required
  events: TimeSeriesEvent[];                  // required (may be empty)
}

interface TimeSeriesHeader {
  locationId: string;                         // required (reservoir id, e.g. "E_08")
  parameterId: string;                        // required (e.g. "I.mk11.forecast", "VICT01.Validado")
  parameterName?: string;
  units?: string;
  type?: string;                              // "instantaneous", etc.
  timeStep?: { unit: string; multiplier: string };
  startDate?: { date: string; time: string };
  endDate?: { date: string; time: string };
  forecastDate?: { date: string; time: string };
  missVal?: string;                           // "-999.0"
  stationName?: string;
  sourceTimezone?: string;                    // default "UTC"; used by the pipeline
  // Any other fields are accepted and ignored (pydantic model uses extra='allow')
}

interface TimeSeriesEvent {
  date: string;                               // ISO date "YYYY-MM-DD"
  time: string;                               // ISO time "HH:MM:SS"
  value: string;                              // numeric string; "-999.0" means missing
  flag: string;                               // "2" valid, "8" missing
}
```

**Pydantic model**: `SimulationOutputPayload` (in `src/api/schemas/simulation_input.py`). Uses `model_config = ConfigDict(extra='allow')` at every level so unexpected fields do not fail the request.

### 4.2 Output — success event

```typescript
interface BalanceComputedPayload {
  simulationId: string;                       // pass-through
  providerName: "volume-calculator";          // constant
  seriesCount: number;                        // number of output timeSeries entries
  eventsCount: number;                        // sum of events across all series
  computedAt: string;                         // ISO-8601 UTC of computation completion
  timeSeries: BalanceTimeSeriesEntry[];       // one entry per (reservoir, balance column)
}

interface BalanceTimeSeriesEntry {
  header: {
    type: "instantaneous";
    moduleInstanceId: "volume_calculator";
    locationId: string;                       // reservoir id, e.g. "E_08"
    parameterId: string;                      // "v.balance.q.in.for.harmonie" | "v.balance.q.in.for.eps.10" | ...
    timeStep: { unit: "second"; multiplier: string };
    startDate: { date: string; time: string };
    endDate: { date: string; time: string };
    forecastDate: { date: string; time: string };
    missVal: "-999.0";
    stationName: string;                      // reservoir id (same as locationId)
    units: "hm3";
    creationDate: string;                     // "YYYY-MM-DD"
    creationTime: string;                     // "HH:MM:SS"
    approvedDate: { date: string; time: string };
  };
  events: TimeSeriesEvent[];                  // same shape as input
}
```

**Note on compatibility with `ms-predictions-api`'s `TimeSeriesIngestedConsumer`**: The consumer's declared payload interface (see [`timeseries-ingested.consumer.ts:14-22`](../../../../ms-predictions-api/src/app/application/consumers/timeseries-ingested.consumer.ts)) only requires `simulationId`, `providerName`, `seriesCount`, `eventsCount`, `timeSeries`. All present in our output. The consumer iterates each series and calls `ProcessTimeSeriesCommand` — as long as each `TimeSeriesEntry` has a valid `header.locationId`/`header.parameterId` and `events[]`, it works. Our output satisfies that.

### 4.3 Output — failure event

```typescript
interface BalanceFailedPayload {
  simulationId: string;                       // pass-through (or "unknown" if not extractable)
  providerName: "volume-calculator";
  reason: string;                             // human-readable
  errorType: "invalid_payload" | "config_error" | "computation_error" | "publish_error";
  retryable: false;                           // always false for this event; retryable errors nack without publishing
  occurredAt: string;                         // ISO-8601 UTC
}
```

### 4.4 HTTP `POST /calculate`

**Request body**: `SimulationOutputPayload` (same as AMQP input).

**Response 200**: `BalanceComputedPayload`.

**Response 400**: `{"error": "invalid_payload", "message": "...", "details": [...]}` — validation errors from pydantic.

**Response 500**: `{"error": "internal_error", "message": "..."}` — everything else.

### 4.5 HTTP `GET /health`

**Response 200**: `{"status": "ok", "checks": {"amqp": "ok"}}`

**Response 503**: `{"status": "degraded", "checks": {"amqp": "down"}}`

---

## 5. AMQP Contracts (canonical, final)

```
Exchange: simulation-events        (type: topic, durable: true)
```

### 5.1 Consumption

| Field | Value |
|-------|-------|
| Exchange | `simulation-events` |
| Routing key | `simulation.manual.output.fetched` |
| Queue name | `calculator-simulation-manual-output` |
| Queue durable | true |
| Consumer prefetch | 10 (env: `RABBITMQ_PREFETCH`) |
| Ack policy | Manual ack after successful publish (or after publishing a `.failed` event) |
| DLX | not configured by the service (infra concern) |

**Payload**: `SimulationOutputPayload` (see 4.1). JSON UTF-8.

**Note**: `model-hook` teammate must ensure `ms-model-api` publishes to this exact routing key **for manual simulations only** (`providerName === 'manual-simulation'`). Non-manual paths remain publishing to `model-events` / `timeseries.ingested`.

### 5.2 Publication — success

| Field | Value |
|-------|-------|
| Exchange | `simulation-events` |
| Routing key | `simulation.manual.balance.computed` |
| Publisher confirms | enabled |
| Message properties | `content_type: application/json`, `delivery_mode: 2` (persistent), `headers.x-simulation-id: <simulationId>` |

**Payload**: `BalanceComputedPayload` (see 4.2). JSON UTF-8.

**Note**: `predictions-consumer` teammate subscribes a new queue (e.g. `predictions-balance-computed`) bound to this routing key.

### 5.3 Publication — failure

| Field | Value |
|-------|-------|
| Exchange | `simulation-events` |
| Routing key | `simulation.manual.balance.failed` |
| Publisher confirms | enabled |
| Message properties | same as success |

**Payload**: `BalanceFailedPayload` (see 4.3).

**Note**: `predictions-consumer` and `observability-runbook` teammates may consume this to update simulation status downstream or fire alerts.

---

## 6. Ports and Adapters

### 6.1 Ports (in `src/application/`)

The Python service does not use NestJS's DI abstract-class pattern. Instead, ports are declared as `Protocol` classes (structural typing) and injected via constructor arguments. This keeps the domain testable while staying idiomatic.

```python
# src/application/ports.py
from typing import Protocol

class BalanceEventPublisherPort(Protocol):
    async def publish_computed(self, payload: BalanceComputedPayload) -> None: ...
    async def publish_failed(self, payload: BalanceFailedPayload) -> None: ...

class ClockPort(Protocol):
    def now_utc(self) -> datetime: ...
```

### 6.2 Adapters (in `src/infrastructure/`)

- `AmqpBalanceEventPublisher` implements `BalanceEventPublisherPort`.
- `SystemClock` implements `ClockPort` (for tests, a `FrozenClock` fixture provides deterministic timestamps).

---

## 7. Configuration & Environment

Env vars are loaded via `pydantic-settings` from `.env` (dev) or the runtime env (prod).

| Variable | Default | Description |
|----------|---------|-------------|
| `APP_NAME` | `ms-calculator-api` | Service name (constant; used in logs) |
| `APP_PORT` | `3011` | HTTP port |
| `APP_LOG_LEVEL` | `info` | `debug` / `info` / `warn` / `error` |
| `NODE_ENV` | `local` | `local` / `development` / `production` (matches monorepo convention despite being Python) |
| `RABBITMQ_HOST` | `127.0.0.1` | RabbitMQ host |
| `RABBITMQ_PORT` | `5672` | RabbitMQ port |
| `RABBITMQ_USER` | `guest` | RabbitMQ user |
| `RABBITMQ_PASSWORD` | `guest` | RabbitMQ password |
| `RABBITMQ_VHOST` | `/` | RabbitMQ vhost |
| `RABBITMQ_PREFETCH` | `10` | Consumer prefetch |
| `RESERVOIR_CONFIG_PATH` | `src/config/reservoir_parameters.json` | Absolute or relative path to config JSON |
| `HEALTH_AMQP_TIMEOUT_MS` | `1000` | Timeout for AMQP health probe |

`.env.example` will list all of these with the default values.

---

## 8. Logging

### 8.1 Setup

Structlog is configured in `src/infrastructure/logging/structlog_config.py` with:

- Timestamper (ISO-8601 UTC)
- Add log level, logger name
- Add constants: `service="ms-calculator-api"`
- JSON renderer at the end
- ContextVars processor to auto-inject `simulation_id` when bound

### 8.2 Simulation ID binding pattern

```python
# In the consumer's message handler:
import structlog
log = structlog.get_logger()

async def handle_message(payload: SimulationOutputPayload) -> None:
    bound = structlog.contextvars.bind_contextvars(simulation_id=payload.simulationId)
    try:
        log.info("consumer.message_received", series_count=len(payload.timeSeries))
        # ... calculator_service.execute(...) — all its internal logs auto-inherit simulation_id
        log.info("consumer.message_processed")
    finally:
        structlog.contextvars.clear_contextvars()
```

Same pattern in the HTTP handler (`POST /calculate`).

### 8.3 Canonical events

| Event | Level | Fields |
|-------|-------|--------|
| `consumer.message_received` | info | series_count, events_count |
| `consumer.message_ack` | info | outcome (`computed` \| `failed`) |
| `consumer.message_nack` | error | reason |
| `calculation.started` | info | reservoir_count |
| `calculation.completed` | info | duration_ms, output_series_count |
| `calculation.reservoir_skipped` | warn | reservoir_id, reason |
| `publisher.event_sent` | info | routing_key, message_size |
| `publisher.event_failed` | error | routing_key, error |
| `http.calculate.request_received` | info | client_ip |
| `http.calculate.request_completed` | info | duration_ms, status_code |
| `http.health.check` | debug | amqp_status |
| `startup.amqp_connected` | info | host, port |
| `startup.amqp_bound` | info | queue, routing_key |
| `startup.http_ready` | info | port |
| `shutdown.begin` | info | reason |

All fields optional except `ts`, `level`, `event`, `service`, `message` (rendered by structlog itself). `simulation_id` present on all processing events.

---

## 9. Docker & Deployment

### 9.1 Dockerfile — multi-stage

```dockerfile
# syntax=docker/dockerfile:1

# ── Base wheels layer (cached) ───────────────────────────
FROM python:3.12-slim AS wheels
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY pyproject.toml ./
# Pre-download wheels for pandas and other heavy deps
RUN pip wheel --no-deps --wheel-dir /wheels \
    fastapi uvicorn[standard] aio-pika pydantic pydantic-settings structlog pandas pytz gunicorn

# ── Development stage ────────────────────────────────────
FROM python:3.12-slim AS dev
RUN apt-get update && apt-get install -y --no-install-recommends \
        dumb-init && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=wheels /wheels /wheels
COPY pyproject.toml ./
RUN pip install --no-index --find-links /wheels \
    fastapi uvicorn[standard] aio-pika pydantic pydantic-settings structlog pandas pytz gunicorn
RUN pip install -e . --no-deps || true
# Install dev tools directly (not from wheels)
RUN pip install pytest pytest-asyncio httpx testcontainers ruff mypy
COPY . .
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1
EXPOSE 3011
ENTRYPOINT ["dumb-init", "--"]
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "3011", "--reload"]

# ── Production stage ─────────────────────────────────────
FROM python:3.12-slim AS prod
RUN apt-get update && apt-get install -y --no-install-recommends \
        dumb-init && rm -rf /var/lib/apt/lists/*
RUN groupadd -r app && useradd -r -g app -u 1001 app
WORKDIR /app
COPY --from=wheels /wheels /wheels
COPY pyproject.toml ./
RUN pip install --no-index --find-links /wheels \
        fastapi uvicorn[standard] aio-pika pydantic pydantic-settings structlog pandas pytz gunicorn && \
    rm -rf /wheels
COPY --chown=app:app src ./src
COPY --chown=app:app entrypoint.sh ./
RUN chmod +x /app/entrypoint.sh
USER app
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1
EXPOSE 3011
ENTRYPOINT ["dumb-init", "--", "/app/entrypoint.sh"]
CMD ["gunicorn", "src.main:app", \
     "--workers", "2", \
     "--worker-class", "uvicorn.workers.UvicornWorker", \
     "--bind", "0.0.0.0:3011", \
     "--timeout", "120", \
     "--graceful-timeout", "30"]
```

### 9.2 docker-compose.yml (standalone dev)

```yaml
services:
  app:
    container_name: ms-calculator-api
    image: ms-calculator-api-dev
    build:
      context: .
      dockerfile: Dockerfile
      target: dev
    restart: unless-stopped
    env_file: .env
    environment:
      NODE_ENV: local
      RABBITMQ_HOST: infra-rabbitmq
      RABBITMQ_PORT: '5672'
      RABBITMQ_USER: guest
      RABBITMQ_PASSWORD: guest
      APP_PORT: '3011'
      APP_LOG_LEVEL: info
    volumes:
      - .:/app
    networks:
      - app-network
      - infra-network
    ports:
      - '3011:3011'
    command: uvicorn src.main:app --host 0.0.0.0 --port 3011 --reload

networks:
  app-network:
  infra-network:
    external: true
    name: infra-network
```

### 9.3 Jenkinsfile

Mirrors `ms-gateway-api/Jenkinsfile` but Python:

- `stage('Install Dependencies')` — `pip install -e .[dev]` inside a venv.
- `stage('Lint')` — `ruff check src tests && ruff format --check src tests`.
- `stage('Test')` — `pytest -v --junitxml=junit.xml` (Docker daemon available on the Jenkins host for testcontainers).
- `stage('Build')` — no-op (Python doesn't need a compile step); kept for symmetry.
- `stage('Docker Build')` — `DOCKER_BUILDKIT=1 docker build --target prod -t ms-calculator-api:${IMAGE_TAG} .`
- `stage('Deploy')` — ssh + `docker stop`/`docker run` on the Hetzner VM, joining `infra-network`, exposing 3011.

### 9.4 Ports & DB

- **Port**: 3011.
- **Database**: none. This service is stateless. **Do not** add a Postgres entry in `infra/infra/docker-compose.yml` for this service.

### 9.5 Registration in `.claude/rules/01-global.md`

Add row to Monorepo Service Registry:

```
| ms-calculator-api | 3011 | Python 3.12 + FastAPI | `ms-calculator-api/` | Volume-balance calculator (event-driven) |
```

Deployment-repo entry in `07-deployment.md` (line 43):
```
`ms-gateway-api`, `ms-user-api`, ..., `ms-meteo-api`, `ms-calculator-api`
```
> Note: this teammate is only authorised to edit `01-global.md`. Update to `07-deployment.md` is out of scope; the TL or a follow-up work item takes that on.

---

## 10. Testing Strategy

### 10.1 Layers

| Layer | Tool | What it covers |
|-------|------|----------------|
| Unit | pytest | `payload_source.py` (adapter), `calculator_service.py` (orchestration with mocks), `structlog_config.py` (log shape), `settings.py` (env loading), `location_parameters.py` (still tested even if unchanged from source) |
| Integration | pytest + testcontainers[rabbitmq] | AMQP consumer + publisher end-to-end against a real RabbitMQ container; pipeline end-to-end without AMQP against fixtures |
| E2E (HTTP) | pytest + FastAPI TestClient | POST /calculate, GET /health (with and without RabbitMQ), GET /docs |
| Contract | pytest (comparison) | Byte-identical vs the CLI's stdout on the same fixture — proves the port did not alter math |

### 10.2 Test philosophy

- **No mocking of the pipeline** — always run the real `volume_calculator` module on real fixture data (small dataset for speed).
- **Mock at the port boundary** — `BalanceEventPublisherPort` is mocked in `test_calculator_service.py` to isolate orchestration from AMQP.
- **Real RabbitMQ in integration** — testcontainers spins up a rabbitmq:3.13-management-alpine container per test class.
- **HTTP tests use FastAPI TestClient** — no separate server needed.
- **Fixtures come from `tajo-volume_calculator/`** — a small helper script bootstraps `tests/fixtures/*.json` from real payloads (can be committed since they are small and public).
- **Golden output test**: `expected_balance_output.json` is regenerated whenever the pipeline math changes intentionally; a test asserts byte-identical output.

### 10.3 Coverage target

- 90%+ line coverage on `src/api/`, `src/application/`, `src/infrastructure/`.
- `src/domain/volume_calculator/` is inherited from an external repo — do not add per-line coverage, but the integration + contract tests must exercise both harmonie and eps pipelines.

---

## 11. Migrations & Data

**None.** Service is stateless.

---

## 12. Constitution Compliance

Root `.claude/rules/` compliance check:

- **01-global**: English identifiers, Spanish user-facing UI (N/A — no UI), conventional commits. **OK.**
- **02-nestjs**: Not applicable — Python service, but the spirit (hexagonal layers, ports, structured logging) is respected.
- **03-frontend**: Not applicable.
- **04-infrastructure**: Reuses RabbitMQ from `infra-rabbitmq`, joins `infra-network`. Registered in `01-global.md`. **OK.**
- **05-testing**: The NestJS rules mandate `@testcontainers/postgresql`; here we use `testcontainers[rabbitmq]` since we have no DB. The **philosophy** (real infra, integration tests via API, mock only external services) is preserved. **OK with deviation documented in this plan.**
- **06-speckit**: This feature follows the pipeline (spec → clarify → plan → tasks → implement). **OK.**
- **07-deployment**: Same Jenkins + Hetzner pattern. **OK.**

---

## 13. Open Points for TL Approval

These decisions were made autonomously as defaults but flagged for the TL to validate before implementation. See `clarifications.md` for full context.

1. **v.obs input source (C1)**: We require v.obs series to be **inside the AMQP payload**. Confirms this is what `ms-model-api` will actually publish? If not, the `model-hook` teammate needs to ensure the WISKI CSV is fetched by SFTP alongside the JSON forecasts and included in the same `timeSeries` array.
2. **One-event-per-simulation with all 6 columns (C2)**: Confirmed with brief; documenting for record.
3. **Manual ack of infra-failed messages (nack requeue=false)**: This matches `TimeSeriesIngestedConsumer`'s behavior in ms-predictions-api but means broker-side DLX is needed for full durability. Is DLX configured on `infra-rabbitmq`? If not, messages that fail mid-publish are lost silently. Recommend: `observability-runbook` teammate adds an alert on the DLX depth.
4. **Bundled config vs remote config (C5)**: The `reservoir_parameters.json` is bundled inside the container. Redeploys are required to change reservoir mappings. Acceptable for now; if operators need runtime edits, a follow-up feature adds a config API.

---

## 14. Handoff Notes for `model-hook` and `predictions-consumer`

**For `model-hook`** (modifying `ms-model-api`):

- The manual-simulation output must be published to `simulation-events` / `simulation.manual.output.fetched` instead of `model-events` / `timeseries.ingested` (only when `providerName === 'manual-simulation'`; other paths stay unchanged).
- The payload shape does not change — it is exactly what `SimulationRunPollerService.processSingleRun` already builds.
- The v.obs series must be present in the `timeSeries` array with the reservoir's `v.obs` parameterId (per `reservoir_parameters.json`).

**For `predictions-consumer`** (modifying `ms-predictions-api`):

- Subscribe a new queue (recommend: `predictions-balance-computed`) bound to `simulation-events` / `simulation.manual.balance.computed`.
- Reuse the existing `TimeSeriesIngestedConsumer` logic — the shape is identical (`simulationId`, `providerName`, `seriesCount`, `eventsCount`, `timeSeries[]`); the only difference is `parameterId` starts with `v.balance.`.
- Optional: subscribe to `simulation.manual.balance.failed` to fail-out the simulation early instead of waiting for the timeout.
