---
name: run-local
description: >
  How to run the VSAD Tajo monorepo locally. Covers prerequisites, infrastructure
  setup (Postgres per service, MongoDB, Redis, RabbitMQ), each NestJS microservice,
  the Vue 3 frontend, and smoke tests.
---

# Run Local — VSAD Tajo Monorepo

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | >= 22 (matches `.nvmrc`) | `nvm install 22 && nvm use 22` |
| npm | ships with Node | — |
| Docker | 27+ | Docker Desktop |
| Postgres CLI (optional) | 16 | `brew install postgresql@16` |

## Quick Start

### 1. Infrastructure (Terminal 1)

```bash
cd infra/infra
docker compose up -d
```

Starts:
- **PostgreSQL 16.4** containers, one per service (`infra-db-*` on ports 5433-5441)
- **MongoDB 7.0.28** on `:27017` (`infra-mongo-logs`)
- **Redis 7** on `:6379` (`infra-redis`)
- **RabbitMQ 3.13** on `:5672` + management UI on `:15672` (`infra-rabbitmq`)

Verify:
```bash
docker ps                                                # all healthy
docker exec infra-redis redis-cli ping                    # PONG
docker exec infra-db-user pg_isready -U postgres          # accepting connections
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:15672  # 200 (RabbitMQ UI)
```

### 2. Pick a service to develop (Terminal 2)

For example, `ms-user-api`:
```bash
cd ms-user-api
cp .env.example .env                # first time only
npm install                          # first time only
npm run migration:run                # apply pending migrations
npm run start:dev                    # watch mode on :3001
```

Repeat for any other service you need running. Typical local dev: run only the services you are working on (e.g. `ms-gateway-api` + `ms-user-api`) plus the frontend.

### 3. Frontend (Terminal 3)

```bash
cd vsad-tajo-frontend
npm install                          # first time only
npm run dev                          # Vite dev server on :8080
```

Open http://localhost:8080.

## Ports

| Service | Port | Container | Notes |
|---------|------|-----------|-------|
| ms-gateway-api | 3000 | ms-gateway-api | API Gateway |
| ms-user-api | 3001 | ms-user-api | |
| ms-authentication-api | 3002 | ms-authentication-api | |
| ms-sftp-api | 3003 | ms-sftp-api | |
| ms-logs-api | 3004 | ms-logs-api | Express + Mongoose |
| ms-hydro-api | 3006 | ms-hydro-api | |
| ms-predictions-api | 3007 | ms-predictions-api | |
| ms-model-api | 3008 | ms-model-api | |
| ms-notifications-api | 3009 | ms-notifications-api | |
| ms-meteo-api | 3010 | ms-meteo-api | GDAL CLI in image |
| vsad-tajo-frontend (Vite) | 8080 | — | Local dev process |
| ms-sftp-api/ui (Vite) | 5174 | sftp-frontend (prod) | |
| ms-logs-api/ui | 3005 | — | |
| PostgreSQL (per service) | 5433-5441 | infra-db-* | One DB per service |
| MongoDB | 27017 | infra-mongo-logs | ms-logs-api |
| Redis 7 | 6379 | infra-redis | |
| RabbitMQ 3.13 | 5672 (AMQP) + 15672 (UI) | infra-rabbitmq | guest/guest |

## Smoke Tests

```bash
# Health (Terminus) — any NestJS service
curl http://localhost:3000/health
curl http://localhost:3001/health

# Swagger UI
open http://localhost:3001/docs
```

## Configuration

Each service reads env vars from `<ms-xxx>/.env` (copy from `.env.example`).
Key vars (defaults sit in `.env.example`):

```
APP_PORT=<port>
APP_LOG_LEVEL=info
DB_HOST=127.0.0.1
DB_PORT=<5433-5441>
DB_USERNAME=postgres
DB_PASSWORD=secret
DB_DATABASE=<service db name>
DB_SYNCHRONIZE=false
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_DEFAULT_TTL=300
RABBITMQ_HOST=127.0.0.1
RABBITMQ_PORT=5672
RABBITMQ_USER=guest
RABBITMQ_PASSWORD=guest
RABBITMQ_VHOST=/
```

## Run everything in Docker (alternative)

If you need the full stack instead of mixed (some services local + infra Docker), use `/start-all`:
```bash
cd infra/infra
docker compose -f docker-compose.yml -f docker-compose.apps.yml up -d
```

That builds every service and frontend in containers. Slower iteration, useful for end-to-end validation.

## Troubleshooting

| Problem | Solution |
|---------|----------|
| **Port in use** | `lsof -i :<port>` to find the process; kill it or change `APP_PORT` |
| **DB connection refused** | Verify `docker ps` shows the corresponding `infra-db-*` healthy. Check `DB_HOST` (use `127.0.0.1` for local dev, container name in Docker mode) and `DB_PORT` |
| **Migrations failed** | Read the output: SQL error in `src/migrations/*.ts`? DB in a half-applied state? Drop & recreate the DB if dev-only |
| **RabbitMQ ECONNREFUSED** | `docker ps` for `infra-rabbitmq` healthy; if not, `docker restart infra-rabbitmq` |
| **Postgres password mismatch** | `POSTGRES_PASSWORD` only applies at first volume init. Reset via `docker exec infra-db-<svc> psql -U postgres -c "ALTER USER postgres PASSWORD 'new'"` |
| **Frontend cannot reach API** | Ensure `ms-gateway-api` (port 3000) is up. Vite proxy lives in `vite.config.ts` |

## Stopping

```bash
# Stop local processes: Ctrl-C in each terminal
# Stop infra
cd infra/infra
docker compose down
# Reset infra (DESTROYS data)
docker compose down -v
```
