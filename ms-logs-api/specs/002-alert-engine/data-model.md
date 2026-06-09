# Data Model: Alert Engine

## Collections (MongoDB)

### AlertRule

```
Collection: alert_rules
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `_id` | ObjectId | auto | — | Primary key |
| `name` | String | yes | — | Human-readable rule name (unique) |
| `description` | String | no | `""` | Detailed description |
| `enabled` | Boolean | yes | `true` | Whether the rule is actively evaluated |
| `dataSource` | String (enum) | yes | — | Target data source identifier |
| `query` | String | yes | — | Raw query (SQL for pg_*, JSON filter for mongodb_local) |
| `condition` | Object | yes | — | Evaluation condition |
| `condition.operator` | String (enum) | yes | — | Comparison operator: `eq`, `neq`, `gt`, `lt`, `gte`, `lte` |
| `condition.value` | Number | yes | — | Threshold value to compare against |
| `condition.field` | String | no | `"count"` | Field name from query result to evaluate |
| `intervalMinutes` | Number | yes | — | Evaluation frequency in minutes (min: 1, max: 1440) |
| `notification` | Object | yes | — | Notification dispatch config |
| `notification.severity` | String (enum) | yes | — | `INFO`, `WARNING`, `CRITICAL` |
| `notification.title` | String | yes | — | Notification title |
| `notification.message` | String | yes | — | Notification message body |
| `cooldownMinutes` | Number | yes | `30` | Minimum minutes between consecutive notifications |
| `lastCheckedAt` | Date | no | `null` | Timestamp of last evaluation |
| `lastResult` | Mixed | no | `null` | Last query result value |
| `lastTriggeredAt` | Date | no | `null` | Timestamp of last notification dispatch |
| `consecutiveFailures` | Number | no | `0` | Count of consecutive query execution failures |
| `lastError` | String | no | `null` | Last error message (if query failed) |
| `templateId` | String | no | `null` | Reference to template used for creation |
| `createdAt` | Date | auto | — | Mongoose timestamp |
| `updatedAt` | Date | auto | — | Mongoose timestamp |

**Indexes:**
- `{ enabled: 1 }` — fast lookup of active rules on startup
- `{ name: 1 }` — unique constraint
- `{ dataSource: 1 }` — filter by source

**Enums:**

```typescript
enum DataSource {
  MONGODB_LOCAL = 'mongodb_local',
  PG_PREDICTIONS = 'pg_predictions',
  PG_HYDRO = 'pg_hydro',
  PG_MODEL = 'pg_model',
  PG_NOTIFICATIONS = 'pg_notifications',
  PG_METEO = 'pg_meteo',
  PG_USER = 'pg_user',
  PG_SFTP = 'pg_sftp',
}

enum ConditionOperator {
  EQ = 'eq',
  NEQ = 'neq',
  GT = 'gt',
  LT = 'lt',
  GTE = 'gte',
  LTE = 'lte',
}

enum NotificationSeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  CRITICAL = 'CRITICAL',
}
```

---

### AlertExecution

```
Collection: alert_executions
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `_id` | ObjectId | auto | — | Primary key |
| `ruleId` | ObjectId | yes | — | Reference to AlertRule._id |
| `ruleName` | String | yes | — | Denormalized rule name (for history readability) |
| `executedAt` | Date | yes | — | Timestamp of execution |
| `queryResult` | Mixed | no | `null` | Raw result value from query |
| `conditionMet` | Boolean | yes | — | Whether condition evaluated to true |
| `notificationDispatched` | Boolean | yes | `false` | Whether notification was sent |
| `skippedReason` | String | no | `null` | Why notification was not sent (e.g., "cooldown") |
| `error` | String | no | `null` | Error message if query failed |
| `durationMs` | Number | no | `null` | Query execution time in milliseconds |
| `createdAt` | Date | auto | — | Mongoose timestamp |

**Indexes:**
- `{ ruleId: 1, executedAt: -1 }` — history lookup per rule, newest first
- `{ executedAt: 1 }` — TTL index for auto-cleanup (30 days)

**TTL:** Documents auto-deleted after 30 days via MongoDB TTL index on `executedAt`.

---

## Data Source Connection Config

PostgreSQL connections are configured via environment variables. Each data source maps to a connection string:

| DataSource | Env Var | Docker Host | Port | Database |
|------------|---------|-------------|------|----------|
| `pg_predictions` | `PG_PREDICTIONS_URL` | `infra-db-predictions` | 5437 | `predictions` |
| `pg_hydro` | `PG_HYDRO_URL` | `infra-db-hydro` | 5438 | `hydro` |
| `pg_model` | `PG_MODEL_URL` | `infra-db-model` | 5439 | `model` |
| `pg_notifications` | `PG_NOTIFICATIONS_URL` | `infra-db-notifications` | 5440 | `notifications` |
| `pg_meteo` | `PG_METEO_URL` | `infra-db-meteo` | 5441 | `meteo` |
| `pg_user` | `PG_USER_URL` | `infra-db-user` | 5433 | `user` |
| `pg_sftp` | `PG_SFTP_URL` | `infra-db-sftp` | 5435 | `sftp` |
| `mongodb_local` | — | Local Mongoose connection | — | Same DB |

**Connection String Format:**
```
postgresql://postgres:${POSTGRES_PASSWORD}@${host}:${port}/${database}
```

All PostgreSQL connections use the `pg` library with a shared connection pool (max 5 connections per data source, idle timeout 30s).

---

## RabbitMQ Notification Payload

Dispatched to exchange `notifications` with routing key `notification.created`:

```json
{
  "type": "ALERT_TRIGGERED",
  "source": "ms-logs-api",
  "title": "Sin simulaciones nuevas",
  "message": "No se han recibido simulaciones en las últimas 2 horas | Result: 0",
  "metadata": {
    "ruleId": "6651a2b3c4d5e6f7a8b9c0d1",
    "ruleName": "Sin simulaciones en 2 horas",
    "queryResult": 0,
    "dataSource": "pg_predictions",
    "conditionOperator": "eq",
    "conditionValue": 0
  },
  "severity": "CRITICAL"
}
```
