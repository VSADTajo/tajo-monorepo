# Quickstart: Alert Engine

## Prerequisites

- Docker containers running: `infra-rabbitmq`, `infra-mongo-logs`, all `infra-db-*` PostgreSQL instances
- ms-notifications-api running and consuming from RabbitMQ exchange `notifications`

## Implementation Order

1. Install dependencies: `cd ms-logs-api && npm install pg @types/pg amqplib @types/amqplib`
2. Add env vars to `infra/docker-compose.apps.yml` (ms-logs-api service)
3. Create types + config
4. Create MongoDB collections (models)
5. Create services (bottom-up): query-executor → rabbitmq → alert → alert-engine
6. Create controller + routes
7. Wire into app.ts + index.ts
8. Create frontend components
9. Wire into Sidebar + App.tsx
10. Build + verify

## Verification Commands

```bash
# Backend
cd ms-logs-api && npm run build

# Frontend
cd ms-logs-api/ui && npm run build

# Full stack (Docker)
cd infra && docker compose -f docker-compose.yml -f docker-compose.apps.yml up -d ms-logs-api ms-logs-ui
```

## API Quick Reference

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/alerts` | Create rule |
| GET | `/api/alerts` | List rules |
| GET | `/api/alerts/:id` | Get rule |
| PUT | `/api/alerts/:id` | Update rule |
| DELETE | `/api/alerts/:id` | Delete rule |
| PATCH | `/api/alerts/:id/toggle` | Enable/disable |
| POST | `/api/alerts/:id/test` | Test rule (no dispatch) |
| POST | `/api/alerts/test-query` | Test arbitrary query |
| GET | `/api/alerts/:id/history` | Execution history |
| GET | `/api/alerts/templates` | Predefined templates |
| GET | `/api/alerts/datasources` | Available data sources |
