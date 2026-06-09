# Spec: Alert Engine — Dynamic Monitoring & Alerting System

## Summary

Add a dynamic alerting system to the ms-logs-api backoffice that allows operators to create, manage, and monitor alert rules. Each rule runs a query against a configured data source (MongoDB local or PostgreSQL from any microservice) on a cron interval, evaluates a condition, and dispatches a notification to ms-notifications-api via RabbitMQ when triggered.

## Problem Statement

Currently there is no way to know when critical data is missing (no new simulations, station data gaps, forecast failures) until someone manually checks. The platform needs proactive monitoring that alerts operators in real-time when something is wrong.

## User Scenarios & Testing

### US1 — Create Alert Rule (P1)

**As an** operator  
**I want to** create a new alert rule from the backoffice  
**So that** the system monitors a condition and notifies me when it triggers

**Acceptance Criteria:**
- Form with: name, description, data source, query, condition (operator + value), interval (minutes), notification config (severity, title, message), cooldown (minutes)
- Data sources: `mongodb_local` (logs/forecasts), `pg_predictions`, `pg_hydro`, `pg_model`, `pg_notifications`, `pg_meteo`, `pg_user`, `pg_sftp`
- Query field supports raw MongoDB filter JSON (for mongodb_local) or raw SQL (for pg_* sources)
- "Test Query" button: executes the query and shows the result count before saving
- Rule saved to MongoDB with `enabled: true` by default
- Rule immediately registered in the cron scheduler on creation

**Test Scenarios:**
1. Create rule with MongoDB query, test it, save — rule appears in list as enabled
2. Create rule with PostgreSQL query, test it — shows result count
3. Attempt to save rule with invalid query — shows validation error
4. Create rule with 0 or negative interval — validation rejects

### US2 — List & Manage Alert Rules (P1)

**As an** operator  
**I want to** see all alert rules and their current state  
**So that** I can monitor what is being tracked and take action

**Acceptance Criteria:**
- Table with columns: name, data source, interval, last checked, last result, last triggered, status (enabled/disabled/error)
- Toggle switch to enable/disable each rule (stops/starts cron evaluation)
- Edit button opens the creation form pre-filled
- Delete button with confirmation dialog
- Status badges: green (enabled, passing), yellow (enabled, triggered recently), red (error/failed query), gray (disabled)

**Test Scenarios:**
1. List shows all rules with correct state
2. Disable a rule — cron stops evaluating it
3. Re-enable a rule — cron resumes evaluation
4. Delete a rule — removed from DB and cron scheduler
5. Edit a rule — changes reflected in next evaluation

### US3 — Alert Engine Evaluation (P1)

**As the** system  
**I want to** evaluate alert rules on their configured interval  
**So that** conditions are detected and notifications are dispatched

**Acceptance Criteria:**
- On server startup, load all enabled rules and register crons
- Each cron tick: execute query against configured data source, extract numeric result
- Compare result against condition (operator: eq, neq, gt, lt, gte, lte)
- If condition is met AND cooldown has elapsed: dispatch notification via RabbitMQ to ms-notifications-api
- Update rule: `lastCheckedAt`, `lastResult`, `lastTriggeredAt` (if triggered), `consecutiveFailures` (reset on success)
- If query fails: increment `consecutiveFailures`, log error, do NOT disable rule automatically
- RabbitMQ payload follows ms-notifications-api consumer contract:
  ```json
  {
    "type": "ALERT_TRIGGERED",
    "source": "ms-logs-api",
    "title": "<rule.notification.title>",
    "message": "<rule.notification.message> | Result: <value>",
    "metadata": { "ruleId": "<id>", "ruleName": "<name>", "queryResult": <value>, "dataSource": "<source>" },
    "severity": "<rule.notification.severity>"
  }
  ```

**Test Scenarios:**
1. Rule with interval 10min — evaluates every 10 minutes
2. Condition met, cooldown elapsed — notification dispatched
3. Condition met, cooldown NOT elapsed — notification NOT dispatched
4. Condition NOT met — no notification, lastCheckedAt updated
5. Query fails — consecutiveFailures incremented, error logged, rule stays enabled
6. Server restart — all enabled rules re-registered in cron

### US4 — Alert Execution History (P2)

**As an** operator  
**I want to** see the execution history of each alert rule  
**So that** I can debug and understand when alerts fired and why

**Acceptance Criteria:**
- Each rule has a "History" button that opens a modal/panel
- Shows last 50 executions with: timestamp, query result, condition met (yes/no), notification dispatched (yes/no), error (if any)
- History stored in a separate MongoDB collection (`alert-executions`)

**Test Scenarios:**
1. View history of a rule with 10 executions — shows all 10 in order
2. Execution that triggered notification — shows "dispatched: true"
3. Execution that failed — shows error message

### US5 — Predefined Alert Templates (P3)

**As an** operator  
**I want to** create alerts from predefined templates  
**So that** I don't need to write queries for common monitoring scenarios

**Acceptance Criteria:**
- "Create from Template" button on the alert list
- Templates:
  1. **Sin simulaciones**: No new simulations in X hours (pg_predictions)
  2. **Estacion sin datos**: No data for station X in Y hours (pg_hydro)
  3. **Errores excesivos**: More than N errors from service X in Z minutes (mongodb_local)
  4. **Forecast no llego**: No forecasts with strategy X today (mongodb_local)
  5. **Servicio caido**: Health check failed for service X (HTTP check)
- Template pre-fills the form with sensible defaults, user can customize before saving

**Test Scenarios:**
1. Select "Sin simulaciones" template — form pre-filled with correct query and condition
2. Modify template defaults — saves with custom values
3. Template query uses placeholder variables (e.g., `{{hours}}`) — replaced with user input

## Requirements

### Functional

- CRUD operations for alert rules
- Dynamic cron scheduling per rule (not a single global cron)
- Multi-datasource query execution (MongoDB + multiple PostgreSQL instances)
- Condition evaluation with 6 operators (eq, neq, gt, lt, gte, lte)
- Notification dispatch via RabbitMQ to ms-notifications-api
- Cooldown mechanism to prevent alert flooding
- Execution history tracking
- Test query before saving
- Predefined templates for common scenarios

### Non-Functional

- Alert evaluation must complete within 30 seconds per rule
- Failed queries must not crash the engine or affect other rules
- PostgreSQL connections must use connection pooling (no persistent connections per rule)
- Server restart must restore all active cron jobs

### Key Entities

- **AlertRule**: name, description, dataSource, query, condition, intervalMinutes, notification config, cooldown, state
- **AlertExecution**: ruleId, timestamp, queryResult, conditionMet, notificationDispatched, error

## Assumptions

1. ms-notifications-api is running and consuming from the `notifications` RabbitMQ exchange
2. ms-logs-api can reach all PostgreSQL instances via Docker network (container names)
3. PostgreSQL credentials are provided via environment variables
4. Operators creating alert rules have sufficient knowledge to write basic SQL or MongoDB queries
5. The BO React UI already has authentication and role-based access

## Success Criteria

1. Operator can create an alert rule from the UI and see it evaluate on schedule
2. When condition is met, notification appears in ms-notifications-api within the evaluation interval
3. Test query shows result before saving the rule
4. Alert history shows past 50 executions per rule
5. Server restart preserves all rules and resumes evaluation
6. Failed query does not crash the engine
