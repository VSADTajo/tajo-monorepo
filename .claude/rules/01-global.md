# Global Conventions

## Language
- Code, identifiers, inline comments: English
- Communication with the user: Spanish
- Git commits: English (conventional commits)

## Conventional Commits
Format: `type(scope): description`
Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `ci`

## Monorepo Service Registry

| Service | Port | Tech | Directory | Description |
|---------|------|------|-----------|-------------|
| ms-gateway-api | 3000 | NestJS 11 | `ms-gateway-api/` | API Gateway (composes upstream services) |
| ms-user-api | 3001 | NestJS 11 | `ms-user-api/` | User + role management (RBAC) |
| ms-authentication-api | 3002 | NestJS 11 | `ms-authentication-api/` | Authentication, JWT issuance |
| ms-sftp-api | 3003 | NestJS 11 | `ms-sftp-api/` | SFTP file transfer + Mapping Engine UI |
| ms-logs-api | 3004 | **Express 5 + Mongoose** | `ms-logs-api/` | Centralized log ingestion (MongoDB) |
| ms-hydro-api | 3006 | NestJS 11 | `ms-hydro-api/` | Hydrological data |
| ms-predictions-api | 3007 | NestJS 11 | `ms-predictions-api/` | Predictions / forecasting |
| ms-model-api | 3008 | NestJS 11 | `ms-model-api/` | Model execution & management |
| ms-notifications-api | 3009 | NestJS 11 | `ms-notifications-api/` | Notification dispatch |
| ms-meteo-api | 3010 | NestJS 11 | `ms-meteo-api/` | Meteo ingest → GeoServer (uses GDAL CLI) |

## Frontends & UIs

| Component | Port (dev) | Stack | Directory |
|-----------|-----------|-------|-----------|
| vsad-tajo-frontend | 8080 | Vue 3.5 + Vite 6 + Vuetify 3 + Pinia + TS 5.7 | `vsad-tajo-frontend/` |
| ms-sftp-api/ui (Mapping Engine) | 5174 | React 19 + Vite 7 + TailwindCSS | `ms-sftp-api/ui/` |
| ms-logs-api/ui | 3005 | React 18 + Vite | `ms-logs-api/ui/` |

## Other Components

| Component | Tech | Directory | Purpose |
|-----------|------|-----------|---------|
| tajo-toolkit | TS lib | `tajo-toolkit/` | Shared toolkit (nestjs-cls tracing, axios, uuid) — published as `github:VSADTajo/tajo-toolkit` |
| vsad_tajo_geoserver | GeoServer 2.24.2 + PostGIS | `vsad_tajo_geoserver/` | Raster/vector layer publishing (port 8085) |
| tajo-gisdb-backup | scripts | `tajo-gisdb-backup/` | GIS DB backups |

## Shared Infrastructure (`infra/infra/`)

| Service | External port | Container | Role |
|---------|---------------|-----------|------|
| PostgreSQL (per service) | 5433, 5435, 5436, 5437, 5438, 5439, 5440, 5441 | `infra-db-<service>` | One DB per NestJS service |
| MongoDB | 27017 | `infra-mongo-logs` | Logs (ms-logs-api) |
| Redis 7 | 6379 | `infra-redis` | Cache (CachingQueryBus) |
| RabbitMQ 3.13 | 5672 + 15672 | `infra-rabbitmq` | Messaging (AMQP + management UI) |
| GeoServer | 8085 | `vsad-tajo-geoserver` | Map server |
| Jenkins | 9080 | `infra-jenkins` | CI/CD |

## Event Architecture (RabbitMQ)

All inter-service communication goes through RabbitMQ. Each backend service is a **hybrid** NestJS app: HTTP + RabbitMQ consumer in the same process.

```
ms-meteo-api ──publish──> RabbitMQ ──@MessagePattern──> ms-hydro-api
              (direct queue or topic exchange)
```

- **Queue/topic registry** per service: `src/app/infrastructure/messaging/messaging.registry.ts` — single source of truth.
- **Publishing**: via `IMessageBroker` port (`publish(queue, payload)` / `publishToTopic(exchange, key, payload)`).
- **Consuming**: `@MessagePattern(Queues.X)` (direct) or `@EventPattern('x.y')` (topic) with explicit `ack/nack`.
- **Local dev**: RabbitMQ runs in `infra-rabbitmq` and is the same broker for all services.
- **New service**: use `/create-nestjs-service` (clones `ms-gateway-api` as template).

## Cross-Cutting

- Health checks: `/health` (Terminus) on every NestJS service.
- Structured JSON logging via `nestjs-pino` with `pino-pretty` in dev.
- One PostgreSQL DB per NestJS service (`uuid-ossp` extension). MongoDB only for `ms-logs-api`.
- AdminJS panel on each service (disabled in production).
- Swagger autogen at `/docs` on each NestJS service.

## CI/CD

Jenkins multibranch pipelines (`infra-jenkins`, port 9080) monitor the VSADTajo GitHub org repos and deploy to the Hetzner production server (65.21.97.113) via `docker run`. Details in `.claude/rules/07-deployment.md`.
