# ms-calculator-api

Volume-balance calculator microservice. Consumes raw manual-simulation output events from RabbitMQ, computes `v.balance.*` time-series per reservoir and model using the ported `volume_calculator` pipeline, and republishes the enriched payload so `ms-predictions-api` can persist it.

## Quickstart

```bash
# 1. Start shared infrastructure (RabbitMQ must be running)
cd infra/infra && docker compose up -d

# 2. Start the calculator service
cd ms-calculator-api
cp .env.example .env
docker compose up -d

# 3. Verify health
curl http://localhost:3011/health
# {"status":"ok","checks":{"amqp":"ok"}}
```

## Development (no Docker)

```bash
cd ms-calculator-api
python -m venv .venv && source .venv/bin/activate
pip install -e .[dev]
cp .env.example .env
uvicorn src.main:app --host 0.0.0.0 --port 3011 --reload
```

## Running tests

```bash
# Unit tests (no Docker needed)
pytest tests/unit -v

# Integration tests (requires Docker for testcontainers)
pytest tests/integration -v

# E2E HTTP tests
pytest tests/e2e -v

# All tests
pytest -v --tb=short
```

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `APP_NAME` | `ms-calculator-api` | Service name (used in logs) |
| `APP_PORT` | `3011` | HTTP port |
| `APP_LOG_LEVEL` | `info` | Log level: `debug`/`info`/`warn`/`error` |
| `NODE_ENV` | `local` | Environment: `local`/`development`/`production` |
| `RABBITMQ_HOST` | `127.0.0.1` | RabbitMQ host |
| `RABBITMQ_PORT` | `5672` | RabbitMQ AMQP port |
| `RABBITMQ_USER` | `guest` | RabbitMQ username |
| `RABBITMQ_PASSWORD` | `guest` | RabbitMQ password |
| `RABBITMQ_VHOST` | `/` | RabbitMQ virtual host |
| `RABBITMQ_PREFETCH` | `10` | Consumer prefetch count |
| `RESERVOIR_CONFIG_PATH` | `src/config/reservoir_parameters.json` | Path to reservoir parameters JSON |
| `HEALTH_AMQP_TIMEOUT_MS` | `1000` | AMQP health probe timeout (ms) |

## API

- `POST /calculate` — synchronous balance calculation (same input as AMQP consumer)
- `GET /health` — health check (AMQP connectivity)
- `GET /docs` — Swagger UI (OpenAPI)
- `GET /openapi.json` — OpenAPI schema

## Spec / Plan / Tasks

- [spec.md](.specify/specs/calculator-integration/spec.md)
- [plan.md](.specify/specs/calculator-integration/plan.md)
- [tasks.md](.specify/specs/calculator-integration/tasks.md)

## Manual smoke test

Requires `infra-rabbitmq` running. Start the service via docker compose, then:

```bash
# Publish a test event (requires rabbitmqadmin)
rabbitmqadmin --host localhost --port 15672 --user guest --password guest \
  publish exchange=simulation-events routing_key=simulation.manual.output.fetched \
  payload="$(cat tests/fixtures/simulation_output_e08_e09.json)"

# Subscribe and inspect the output
rabbitmqadmin --host localhost --port 15672 --user guest --password guest \
  get queue=predictions-balance-computed count=1
```
