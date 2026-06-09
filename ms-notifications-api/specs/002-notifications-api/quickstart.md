# Quickstart: ms-notifications-api

**Branch**: `001-notifications-api` | **Date**: 2026-03-20

## Prerequisites

- Node.js >= 22 (check `.nvmrc`)
- Docker & Docker Compose (for PostgreSQL, Redis, RabbitMQ)
- Infrastructure services running (`cd infra && docker compose up -d`)

## Setup

1. **Clone and install**:
   ```bash
   cd ms-notifications-api
   nvm use
   npm install
   ```

2. **Environment**: Copy `.env.example` to `.env` and configure:
   ```env
   APP_PORT=3009
   DB_HOST=localhost
   DB_PORT=5438
   DB_DATABASE=ms_notifications
   DB_USERNAME=postgres
   DB_PASSWORD=secret
   REDIS_HOST=localhost
   REDIS_PORT=6379
   RABBITMQ_ENABLED=true
   RABBITMQ_HOST=localhost
   RABBITMQ_PORT=5672
   RABBITMQ_USER=guest
   RABBITMQ_PASSWORD=guest
   ```

3. **Database**: Add `db-notifications` service to `infra/docker-compose.yml` (port 5438) and start it.

4. **Run migrations**:
   ```bash
   npm run migration:run
   ```

5. **Start**:
   ```bash
   npm run start:dev
   ```

## Verify

- **Health**: `GET http://localhost:3009/health`
- **Swagger**: `http://localhost:3009/docs`
- **Publish test notification** via RabbitMQ Management UI (http://localhost:15672):
  - Exchange: `notifications`
  - Routing key: `notification.created`
  - Payload: `{"type":"TEST","source":"manual","title":"Test","message":"Hello","severity":"INFO"}`
- **List notifications**: `GET http://localhost:3009/notifications`

## Infrastructure (docker-compose)

New services to add in `infra/`:

- `db-notifications` (PostgreSQL 16, port 5438) in `docker-compose.yml`
- `ms-notifications-api` (port 3009) in `docker-compose.apps.yml`
- Jenkins pipeline in `jenkins/casc.yaml`

## Testing

```bash
# Unit + Integration (requires Docker for Testcontainers)
npm test

# E2E
npm run test:e2e
```
