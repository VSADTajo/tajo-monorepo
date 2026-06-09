# Research: Alert Engine

## Decisions

### R1 — Implement in ms-logs-api, not as a new microservice

**Decision:** Build the alert engine directly inside ms-logs-api (the BO).

**Rationale:**
- ms-logs-api already has node-cron, MongoDB, and the React UI
- Adding another microservice for this adds infra overhead (another DB, another container, another CI pipeline)
- The BO is the natural home for operational monitoring
- The feature is scoped to querying existing databases and dispatching to ms-notifications-api

**Alternatives considered:**
- New `ms-alerts-api` microservice — too much overhead for the scope
- Grafana Alerting — requires installing Grafana, duplicates BO functionality
- Elasticsearch + Kibana — overkill for the data volume (~thousands of logs/day, 5-day retention)

### R2 — Use `pg` (node-postgres) for direct PostgreSQL access

**Decision:** Add the `pg` npm package to ms-logs-api for querying remote PostgreSQL instances.

**Rationale:**
- ms-logs-api currently only connects to MongoDB via Mongoose
- Alert rules need to query PostgreSQL databases from other microservices (predictions, hydro, model, etc.)
- `pg` is the standard Node.js PostgreSQL driver, lightweight and battle-tested
- Connection pooling via `pg.Pool` prevents connection exhaustion (max 5 per data source, idle timeout 30s)

**Alternatives considered:**
- Querying via HTTP to each microservice's API — adds latency, requires each service to expose monitoring endpoints, tight coupling
- TypeORM from ms-logs-api — overkill, ms-logs-api is Express/Mongoose, adding TypeORM mixes paradigms

### R3 — Use `amqplib` for RabbitMQ publishing

**Decision:** Add `amqplib` to ms-logs-api to publish notifications to the `notifications` exchange.

**Rationale:**
- ms-notifications-api already consumes from exchange `notifications` with routing key `notification.created`
- Publishing via RabbitMQ is the standard inter-service pattern in this platform
- Decouples alert dispatch from notification delivery
- Alternative (HTTP POST to ms-notifications-api) would work but bypasses the event-driven pattern

### R4 — Dynamic cron scheduling with node-cron

**Decision:** Each alert rule gets its own node-cron scheduled task, managed via a `Map<string, ScheduledTask>`.

**Rationale:**
- node-cron already exists in the project
- Dynamic scheduling allows different intervals per rule (some every 1min, others every 30min)
- In-memory Map tracks active tasks for enable/disable/delete operations
- On server restart, all enabled rules are loaded from MongoDB and re-registered

**Alternatives considered:**
- Single global cron that evaluates all rules — doesn't support per-rule intervals without added complexity
- Bull/BullMQ job queue — adds Redis dependency (already available) but too complex for this use case
- setTimeout loops — less precise, harder to manage lifecycle

### R5 — SQL queries executed as read-only

**Decision:** All PostgreSQL queries from alert rules run with `SET default_transaction_read_only = true` on the connection pool.

**Rationale:**
- Alert rules should NEVER modify data in other microservices' databases
- Read-only mode prevents accidental INSERT/UPDATE/DELETE from user-written queries
- Defense-in-depth: even if an operator writes a dangerous query, the DB rejects it

### R6 — RabbitMQ connection variables added to ms-logs-api docker-compose

**Decision:** Add RABBITMQ_HOST, RABBITMQ_PORT, RABBITMQ_USER, RABBITMQ_PASSWORD environment variables to the ms-logs-api container in docker-compose.apps.yml.

**Rationale:**
- ms-logs-api currently has no RabbitMQ connection (only MongoDB)
- Needs RabbitMQ to publish alert notifications
- Uses the same infra-rabbitmq instance already running for other microservices

### R7 — PostgreSQL connection URLs added to ms-logs-api docker-compose

**Decision:** Add PG connection environment variables for each microservice database that alert rules can query.

**Rationale:**
- ms-logs-api needs to connect to multiple PostgreSQL instances
- Connection strings follow the format: `postgresql://postgres:${POSTGRES_PASSWORD}@${container}:5432/${db}`
- Uses Docker network internal hostnames (container names)
