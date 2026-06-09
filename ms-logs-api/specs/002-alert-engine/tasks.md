# Tasks: Alert Engine

## Dependency Graph

```
Phase 1 (Setup)
  └─▶ Phase 2 (Data Layer)
       └─▶ Phase 3 (Services)
            └─▶ Phase 4 (API Layer)
                 └─▶ Phase 5 (Frontend)
                      └─▶ Phase 6 (Verification)
```

---

## Phase 1 — Infrastructure Setup

- [x] [T01] [P] Add `pg`, `@types/pg`, `amqplib`, `@types/amqplib` to `ms-logs-api/package.json`
- [x] [T02] [P] Create `src/types/alert.types.ts` — enums (DataSource, ConditionOperator, NotificationSeverity) + interfaces (AlertRuleData, AlertExecutionData, ConditionConfig, NotificationConfig)
- [x] [T03] [P] Create `src/config/datasources.ts` — PG pool factory: reads env vars, creates pg.Pool per data source with `default_transaction_read_only=true`, max 5 connections, idle timeout 30s
- [x] [T04] Add RabbitMQ + PG env vars to ms-logs-api service in `infra/docker-compose.apps.yml`

## Phase 2 — Data Layer

- [x] [T05] [P] [US1] Create `src/collections/alert-rule.collection.ts` — Mongoose schema with all fields from data-model.md, indexes on `enabled`, `name` (unique)
- [x] [T06] [P] [US4] Create `src/collections/alert-execution.collection.ts` — Mongoose schema with TTL index on `executedAt` (30 days), compound index `{ ruleId: 1, executedAt: -1 }`

## Phase 3 — Services

- [x] [T07] [US3] Create `src/services/query-executor.service.ts` — QueryExecutorService with static methods:
  - `executeMongoQuery(queryJson: string): Promise<number>` — parse JSON filter, run countDocuments on Log collection
  - `executePgQuery(dataSource: string, sql: string): Promise<number>` — get pool from datasources config, execute query, extract first row first column as number
  - `execute(dataSource: string, query: string): Promise<{ result: number; durationMs: number }>` — dispatcher
- [x] [T08] Create `src/services/rabbitmq.service.ts` — RabbitMQService:
  - `connect()` — connect to RabbitMQ using env vars, assert exchange `notifications` (topic, durable)
  - `publish(routingKey: string, payload: object)` — publish JSON message
  - `disconnect()` — close connection gracefully
- [x] [T09] [US1] Create `src/services/alert.service.ts` — AlertService with static CRUD methods:
  - `create(data: AlertRuleData)` — validate + insert into MongoDB
  - `findAll()` — return all rules sorted by createdAt desc
  - `findById(id: string)` — find one by _id
  - `update(id: string, data: Partial<AlertRuleData>)` — partial update
  - `delete(id: string)` — remove from MongoDB
  - `toggle(id: string, enabled: boolean)` — update enabled field
  - `updateExecutionState(id, updates)` — update lastCheckedAt, lastResult, etc.
- [x] [T10] [US3] Create `src/services/alert-engine.service.ts` — AlertEngineService:
  - `scheduledTasks: Map<string, ScheduledTask>` — in-memory map of active crons
  - `start()` — load all enabled rules from MongoDB, register cron for each
  - `registerRule(rule)` — create node-cron task with `*/intervalMinutes * * * *` expression, add to map
  - `unregisterRule(ruleId)` — stop and remove from map
  - `evaluateRule(rule)` — execute query, evaluate condition, dispatch if met + cooldown elapsed, save execution history
  - `dispatchNotification(rule, result)` — build payload per ms-notifications-api contract, publish via RabbitMQService
- [x] [T11] [P] [US5] Create `src/templates/alert-templates.ts` — array of predefined templates with variable placeholders

## Phase 4 — API Layer

- [x] [T12] [US1,US2] Create `src/controllers/alert.controller.ts` — AlertController with static methods:
  - `create(req, res)` — validate body, create rule via AlertService, register in engine
  - `findAll(req, res)` — list all rules
  - `findById(req, res)` — get single rule
  - `update(req, res)` — update rule, re-register cron if interval changed
  - `delete(req, res)` — delete rule, unregister cron
  - `toggle(req, res)` — enable/disable, register/unregister cron
  - `testRule(req, res)` — execute rule query without dispatching
  - `testQuery(req, res)` — execute arbitrary query (for form preview)
  - `getHistory(req, res)` — get executions for a rule with pagination
  - `getTemplates(req, res)` — return predefined templates
  - `getDataSources(req, res)` — return available data sources with connection status
- [x] [T13] Create `src/routes/alert.routes.ts` — Express router with Swagger JSDoc comments for all endpoints
- [x] [T14] Modify `src/app.ts` — import and register alertRouter: `app.use("/api/alerts", validateToken, alertRouter)`
- [x] [T15] Modify `src/index.ts` — import RabbitMQService + AlertEngineService, connect RabbitMQ, start alert engine after MongoDB connection

## Phase 5 — Frontend

- [x] [T16] [P] Create `ui/src/types/alert.types.ts` — TypeScript interfaces mirroring backend types
- [x] [T17] [P] Create `ui/src/api/alerts.ts` — API client functions using fetch: createRule, listRules, updateRule, deleteRule, toggleRule, testRule, testQuery, getHistory, getTemplates, getDataSources
- [x] [T18] [US2] Create `ui/src/components/alerts/AlertRuleList.tsx` — table with columns: name, source, interval, last checked, last result, last triggered, status badge, toggle switch, edit/delete/history buttons
- [x] [T19] [US1] Create `ui/src/components/alerts/AlertRuleForm.tsx` — create/edit form with fields: name, description, data source selector, query textarea, condition config (operator + value), interval, notification config (severity + title + message), cooldown. Includes "Test Query" button
- [x] [T20] [US1] Create `ui/src/components/alerts/TestQueryResult.tsx` — displays test query result: value, duration, condition evaluation preview
- [x] [T21] [US4] Create `ui/src/components/alerts/AlertHistoryModal.tsx` — modal showing execution history table with: timestamp, result, condition met, dispatched, error, duration
- [x] [T22] [US5] Create `ui/src/components/alerts/AlertTemplateSelector.tsx` — grid/list of templates with description, click to pre-fill form with variable inputs
- [x] [T23] Create `ui/src/components/alerts/AlertsPanel.tsx` — main container: header with "Create Rule" and "From Template" buttons, AlertRuleList, conditionally renders form/modal
- [x] [T24] Create `ui/src/components/alerts/index.ts` — barrel export
- [x] [T25] Modify `ui/src/components/Sidebar.tsx` — add "Alertas" button with Bell icon (admin only), add `'alerts'` to panel type union
- [x] [T26] Modify `ui/src/App.tsx` — add `'alerts'` to activePanel type, add case in renderPanel() for AlertsPanel

## Phase 6 — Verification

- [x] [T27] Run `npm run build` in ms-logs-api (backend compiles)
- [x] [T28] Run `npm run build` in ms-logs-api/ui (frontend compiles)
