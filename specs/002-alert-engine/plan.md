# Plan: Alert Engine

## Summary

Build a dynamic alert engine in ms-logs-api that lets operators create monitoring rules from the backoffice UI. Rules run queries against MongoDB (local) or PostgreSQL (remote microservice DBs) on configurable intervals, evaluate conditions, and dispatch notifications to ms-notifications-api via RabbitMQ.

## Technical Context

| Layer | Technology |
|-------|-----------|
| Backend | Express 5, TypeScript, Mongoose, node-cron |
| Database | MongoDB (alert rules + execution history) |
| Query targets | MongoDB local + 7 PostgreSQL instances (via `pg`) |
| Messaging | RabbitMQ (via `amqplib`) → ms-notifications-api |
| Frontend | React 18, TanStack Query, Tailwind CSS, Vite |

## Repos Modified

| Repo | Changes |
|------|---------|
| **ms-logs-api** | Backend: collections, services, controllers, routes, crons. Frontend: new "Alertas" panel |
| **infra** | docker-compose.apps.yml: add RabbitMQ + PG env vars to ms-logs-api container |

**NOT modified:** ms-notifications-api (already has the consumer ready).

## Project Structure — New Files

```
ms-logs-api/
├── src/
│   ├── collections/
│   │   ├── alert-rule.collection.ts          # NEW — AlertRule Mongoose model
│   │   └── alert-execution.collection.ts     # NEW — AlertExecution Mongoose model
│   ├── services/
│   │   ├── alert.service.ts                  # NEW — CRUD for alert rules
│   │   ├── alert-engine.service.ts           # NEW — Cron scheduling + evaluation logic
│   │   ├── query-executor.service.ts         # NEW — Execute queries against MongoDB/PG
│   │   └── rabbitmq.service.ts               # NEW — RabbitMQ publisher
│   ├── controllers/
│   │   └── alert.controller.ts               # NEW — HTTP handlers
│   ├── routes/
│   │   └── alert.routes.ts                   # NEW — /api/alerts routes + swagger
│   ├── types/
│   │   └── alert.types.ts                    # NEW — Enums + interfaces
│   ├── config/
│   │   └── datasources.ts                    # NEW — PG pool config per datasource
│   └── templates/
│       └── alert-templates.ts                # NEW — Predefined alert templates
│
├── ui/src/
│   ├── components/
│   │   └── alerts/
│   │       ├── index.ts                      # NEW — barrel export
│   │       ├── AlertsPanel.tsx               # NEW — main panel with tabs
│   │       ├── AlertRuleList.tsx             # NEW — table of alert rules
│   │       ├── AlertRuleForm.tsx             # NEW — create/edit form
│   │       ├── AlertHistoryModal.tsx         # NEW — execution history modal
│   │       ├── AlertTemplateSelector.tsx     # NEW — template picker
│   │       └── TestQueryResult.tsx           # NEW — test query result display
│   ├── api/
│   │   └── alerts.ts                         # NEW — API client for /api/alerts
│   └── types/
│       └── alert.types.ts                    # NEW — Frontend type definitions

infra/
├── docker-compose.apps.yml                   # MODIFIED — add env vars to ms-logs-api
```

## Modified Files

| File | Change |
|------|--------|
| `ms-logs-api/package.json` | Add `pg`, `@types/pg`, `amqplib`, `@types/amqplib` |
| `ms-logs-api/src/index.ts` | Import + call `startAlertEngine()` on startup |
| `ms-logs-api/src/app.ts` | Register `alertRouter` on `/api/alerts` |
| `ms-logs-api/ui/src/App.tsx` | Add `'alerts'` to activePanel union, render `AlertsPanel` |
| `ms-logs-api/ui/src/components/Sidebar.tsx` | Add "Alertas" nav button (admin only) |
| `infra/docker-compose.apps.yml` | Add RabbitMQ + PG env vars to ms-logs-api service |

## Architecture Flow

```
                    ┌──────────────────────────────────────────────────────┐
                    │  ms-logs-api                                         │
                    │                                                      │
  UI (React)        │  ┌─────────────────┐                                │
  ─────────────────▶│  │ alert.controller │                                │
  CRUD rules        │  └────────┬────────┘                                │
  test queries      │           │                                          │
                    │  ┌────────▼────────┐   ┌───────────────────┐        │
                    │  │  alert.service  │──▶│ alert-engine.svc  │        │
                    │  │  (CRUD Mongo)   │   │ (cron scheduling) │        │
                    │  └─────────────────┘   └────────┬──────────┘        │
                    │                                  │ on tick           │
                    │                        ┌─────────▼──────────┐       │
                    │                        │ query-executor.svc │       │
                    │                        │ • MongoDB (local)  │       │
                    │                        │ • pg.Pool (remote) │       │
                    │                        └─────────┬──────────┘       │
                    │                                  │ result           │
                    │                        ┌─────────▼──────────┐       │
                    │                        │ condition eval     │       │
                    │                        │ if met + !cooldown │       │
                    │                        └─────────┬──────────┘       │
                    │                                  │                   │
                    │                        ┌─────────▼──────────┐       │
                    │                        │ rabbitmq.service   │───────┼──▶ RabbitMQ
                    │                        │ publish to         │       │    exchange: notifications
                    │                        │ "notifications"    │       │    key: notification.created
                    │                        └────────────────────┘       │
                    │                                                      │
                    │  ┌────────────────────────────────┐                  │
                    │  │ alert-execution (MongoDB)      │                  │
                    │  │ history of each evaluation     │                  │
                    │  └────────────────────────────────┘                  │
                    └──────────────────────────────────────────────────────┘
                                                                      │
                                                     ┌────────────────▼─────────┐
                                                     │ ms-notifications-api     │
                                                     │ consumer already exists  │
                                                     │ stores in PostgreSQL     │
                                                     └─────────────────────────┘
```

## Implementation Phases

### Phase 1: Infrastructure Setup
- Add npm dependencies (`pg`, `amqplib`, types)
- Add env vars to docker-compose.apps.yml
- Create types/enums file
- Create datasource config

### Phase 2: Data Layer (MongoDB)
- AlertRule collection + model
- AlertExecution collection + model (with TTL index)

### Phase 3: Services
- QueryExecutorService (MongoDB + PG query execution)
- RabbitMQService (connect + publish)
- AlertService (CRUD operations)
- AlertEngineService (cron scheduling + evaluation + dispatch)
- Alert templates

### Phase 4: API Layer
- AlertController (all endpoints)
- Alert routes with Swagger docs
- Register in app.ts + index.ts

### Phase 5: Frontend
- API client (`ui/src/api/alerts.ts`)
- Types (`ui/src/types/alert.types.ts`)
- AlertsPanel (main container)
- AlertRuleList (table with status badges)
- AlertRuleForm (create/edit with test query)
- AlertHistoryModal (execution log)
- AlertTemplateSelector
- TestQueryResult
- Add to Sidebar + App.tsx

### Phase 6: Verification
- `npm run build` (backend)
- `npm run build` (frontend)
- Manual test: create rule, see cron evaluate, notification dispatched

## Security Considerations

- **Read-only PG queries**: Connection pools use `default_transaction_read_only = true`
- **SQL injection**: Queries are operator-defined, not user-facing. Only admins can create rules (isAdmin check)
- **Rate limiting**: Cooldown mechanism prevents alert flooding
- **Credentials**: PG passwords from env vars, never hardcoded
- **RabbitMQ auth**: Standard user/password from env vars

## Dependencies

```
pg: ^8.16.0          — PostgreSQL client
@types/pg: ^8.15.0   — PG type definitions
amqplib: ^0.10.7     — RabbitMQ client
@types/amqplib: ^0.10.7 — AMQP type definitions
```

## Environment Variables (new for ms-logs-api)

```env
# RabbitMQ
RABBITMQ_HOST=infra-rabbitmq
RABBITMQ_PORT=5672
RABBITMQ_USER=guest
RABBITMQ_PASSWORD=guest

# PostgreSQL connections (read-only for alert queries)
PG_USER_URL=postgresql://postgres:secret@infra-db-user:5432/user
PG_SFTP_URL=postgresql://postgres:secret@infra-db-sftp:5432/sftp
PG_PREDICTIONS_URL=postgresql://postgres:secret@infra-db-predictions:5432/predictions
PG_HYDRO_URL=postgresql://postgres:secret@infra-db-hydro:5432/hydro
PG_MODEL_URL=postgresql://postgres:secret@infra-db-model:5432/model
PG_NOTIFICATIONS_URL=postgresql://postgres:secret@infra-db-notifications:5432/notifications
PG_METEO_URL=postgresql://postgres:secret@infra-db-meteo:5432/meteo
```

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Bad SQL query crashes engine | Each rule evaluation is isolated in try/catch, failures increment counter but don't stop other rules |
| PG connection pool exhaustion | Max 5 connections per data source, 30s idle timeout, pools shared across rules |
| RabbitMQ down | Catch publish errors, log and continue. Alert still records execution history |
| Server restart loses cron state | On startup, load all enabled rules from MongoDB and re-register crons |
| Alert flooding | Cooldown mechanism (configurable per rule, default 30min) |
| Operator writes destructive SQL | Read-only PG connections prevent any write operations |
