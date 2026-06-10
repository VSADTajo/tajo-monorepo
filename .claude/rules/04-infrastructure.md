# Infrastructure Conventions

## Docker Compose Layout

Three compose files in `infra/infra/`:

| File | Purpose |
|------|---------|
| `docker-compose.yml` | Base infrastructure: Redis, RabbitMQ, PostgreSQL DBs (one per service), MongoDB |
| `docker-compose.apps.yml` | Application services in containers (10 NestJS + 1 Express + 2 frontends) |
| `docker-compose.jenkins.yml` | Jenkins CI/CD |

Start infrastructure only:
```bash
cd infra/infra && docker compose up -d
```

Start everything (infra + apps):
```bash
cd infra/infra && docker compose -f docker-compose.yml -f docker-compose.apps.yml up -d
```

## Infrastructure Containers

| Service | External port | Container | Notes |
|---------|---------------|-----------|-------|
| Redis 7 alpine | 6379 | `infra-redis` | Cache for CachingQueryBus, ioredis client |
| RabbitMQ 3.13 management-alpine | 5672 (AMQP) + 15672 (UI) | `infra-rabbitmq` | Messaging, default `guest/guest` |
| PostgreSQL 16.4 alpine — user | 5433 | `infra-db-user` | ms-user-api |
| PostgreSQL 16.4 alpine — sftp | 5435 | `infra-db-sftp` | ms-sftp-api, `password_encryption=scram-sha-256` |
| PostGIS 17-3.5 alpine — geoserver | 5436 | `infra-db-geoserver` | GeoServer + ms-meteo-api spatial data |
| PostgreSQL 16.4 — predictions | 5437 | `infra-db-predictions` | ms-predictions-api |
| PostgreSQL 16.4 — hydro | 5438 | `infra-db-hydro` | ms-hydro-api |
| PostgreSQL 16.4 — model | 5439 | `infra-db-model` | ms-model-api |
| PostgreSQL 16.4 — notifications | 5440 | `infra-db-notifications` | ms-notifications-api |
| PostgreSQL 16.4 — meteo | 5441 | `infra-db-meteo` | ms-meteo-api |
| MongoDB 7.0.28 | 27017 | `infra-mongo-logs` | ms-logs-api |

Network: `infra-network` (bridge). Services use the container name as hostname for inter-service communication.

## Compose Anchors

`docker-compose.apps.yml` defines reusable anchors:

```yaml
x-common-db-env: &common-db-env
    DB_PORT: '5432'
    DB_USERNAME: ${POSTGRES_USER:-postgres}
    DB_PASSWORD: ${POSTGRES_PASSWORD:-secret}
    DB_SYNCHRONIZE: 'false'
    DB_LOGGING: 'true'

x-common-infra-env: &common-infra-env
    NODE_ENV: local
    APP_LOG_LEVEL: info
    LOGS_API_URL: http://ms-logs-api:3004
    REDIS_HOST: infra-redis
    REDIS_PORT: '6379'
    REDIS_DEFAULT_TTL: '300'
    RABBITMQ_HOST: infra-rabbitmq
    RABBITMQ_PORT: '5672'
    RABBITMQ_USER: ${RABBITMQ_USER:-guest}
    RABBITMQ_PASSWORD: ${RABBITMQ_PASSWORD:-guest}
    RABBITMQ_VHOST: /
    RABBITMQ_PREFETCH: '10'
    RABBITMQ_RETRY_ATTEMPTS: '3'
    RABBITMQ_RETRY_DELAY: '5000'
```

When adding a new NestJS service to `docker-compose.apps.yml`, reuse these anchors via `<<: *common-db-env` and `<<: *common-infra-env`.

## Database Conventions (NON-NEGOTIABLE)

For NestJS services (TypeORM):

- **UUID PK**: `id uuid PRIMARY KEY DEFAULT uuid_generate_v4()` (extension `uuid-ossp` initialized via `infra/postgres/init-extensions.sql`).
- **Audit columns**: `createdAt TIMESTAMP NOT NULL DEFAULT now()`, `updatedAt TIMESTAMP NOT NULL DEFAULT now()` (provided by `BaseAuditEntity`).
- **Money**: `numeric(12,2)` in DB → `string` decimal or `number` in TypeScript (depends on the domain — declare explicitly).
- **One DB per service**: each NestJS service has its own Postgres instance/container.
- **Migrations**: raw SQL inside TypeORM `MigrationInterface` classes under `src/migrations/<timestamp>-<name>.ts`. `synchronize: false`.
- **Soft delete**: NOT a default. Apply only when the entity explicitly declares a `deletedAt` column.

`ms-logs-api` is the exception: Express + Mongoose + MongoDB (different conventions live in that service's own README).

## Environment Variables

Per-service, loaded via `@nestjs/config`. Required vars:

```
APP_NAME, NODE_ENV, APP_PORT, APP_LOG_LEVEL
DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD, DB_DATABASE, DB_SYNCHRONIZE
REDIS_HOST, REDIS_PORT, REDIS_DEFAULT_TTL
RABBITMQ_HOST, RABBITMQ_PORT, RABBITMQ_USER, RABBITMQ_PASSWORD, RABBITMQ_VHOST,
RABBITMQ_PREFETCH, RABBITMQ_RETRY_ATTEMPTS, RABBITMQ_RETRY_DELAY
```

Each service ships a `.env.example` — copy it to `.env` and override locally.

## Dockerfile Pattern (NestJS services)

Multi-stage:
- `dev`: full source + `npm install`, volumes mounted, runs `npm run start:dev`.
- `build`: compiles TypeScript (`nest build`).
- `prod`: minimal image — `dist/` + production deps only, non-root user, exposes the service's port.

In `docker-compose.apps.yml` the `dev` target is used so source changes hot-reload via mounted volumes.

## Known Pitfall: PostgreSQL Password Desync

`POSTGRES_PASSWORD` in `docker-compose.yml` only applies on **first volume initialization**. If the volume already exists and the password was changed in the compose file, the DB keeps the old password.

Fix:
```bash
docker exec <container> psql -U postgres -c "ALTER USER postgres PASSWORD 'new_password';"
```

Or nuclear option (destroys data):
```bash
docker compose down -v && docker compose up -d
```

## GeoServer

- Container: `vsad-tajo-geoserver` (image `docker.osgeo.org/geoserver:2.24.2`).
- Port: 8085.
- Backing DB: `infra-db-geoserver` (PostGIS 17-3.5).
- Data on prod VM: `/opt/geoserver/`.
- Repo: `VSADTajo/vsad_tajo_geoserver`.
