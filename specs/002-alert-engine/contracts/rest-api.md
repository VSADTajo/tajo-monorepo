# REST API Contract: Alert Engine

Base URL: `/api/alerts`

---

## POST `/api/alerts`

Create a new alert rule.

**Request Body:**
```json
{
  "name": "Sin simulaciones en 2 horas",
  "description": "Alerta si no hay simulaciones nuevas en las ultimas 2 horas",
  "dataSource": "pg_predictions",
  "query": "SELECT COUNT(*) as count FROM simulations WHERE created_at > NOW() - INTERVAL '2 hours'",
  "condition": {
    "operator": "eq",
    "value": 0,
    "field": "count"
  },
  "intervalMinutes": 10,
  "notification": {
    "severity": "CRITICAL",
    "title": "Sin simulaciones nuevas",
    "message": "No se han recibido simulaciones en las ultimas 2 horas"
  },
  "cooldownMinutes": 60
}
```

**Response 201:**
```json
{
  "success": true,
  "data": { /* AlertRule object */ }
}
```

**Response 400:**
```json
{
  "success": false,
  "error": "Validation error: name is required"
}
```

---

## GET `/api/alerts`

List all alert rules.

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "6651a2b3c4d5e6f7a8b9c0d1",
      "name": "Sin simulaciones en 2 horas",
      "description": "...",
      "enabled": true,
      "dataSource": "pg_predictions",
      "query": "SELECT COUNT(*) ...",
      "condition": { "operator": "eq", "value": 0, "field": "count" },
      "intervalMinutes": 10,
      "notification": { "severity": "CRITICAL", "title": "...", "message": "..." },
      "cooldownMinutes": 60,
      "lastCheckedAt": "2026-05-21T10:30:00Z",
      "lastResult": 3,
      "lastTriggeredAt": null,
      "consecutiveFailures": 0,
      "lastError": null,
      "createdAt": "2026-05-20T08:00:00Z",
      "updatedAt": "2026-05-21T10:30:00Z"
    }
  ]
}
```

---

## GET `/api/alerts/:id`

Get a single alert rule by ID.

**Response 200:**
```json
{
  "success": true,
  "data": { /* AlertRule object */ }
}
```

**Response 404:**
```json
{
  "success": false,
  "error": "Alert rule not found"
}
```

---

## PUT `/api/alerts/:id`

Update an alert rule. Re-registers the cron job with new interval if changed.

**Request Body:** Same as POST (all fields optional, partial update).

**Response 200:**
```json
{
  "success": true,
  "data": { /* updated AlertRule object */ }
}
```

---

## DELETE `/api/alerts/:id`

Delete an alert rule and remove its cron job.

**Response 200:**
```json
{
  "success": true,
  "data": { "deleted": true }
}
```

---

## PATCH `/api/alerts/:id/toggle`

Enable or disable an alert rule.

**Request Body:**
```json
{
  "enabled": false
}
```

**Response 200:**
```json
{
  "success": true,
  "data": { /* updated AlertRule object */ }
}
```

---

## POST `/api/alerts/:id/test`

Execute the rule's query and return the result without dispatching a notification.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "queryResult": 0,
    "conditionMet": true,
    "durationMs": 45,
    "wouldNotify": true,
    "cooldownActive": false
  }
}
```

**Response 400:**
```json
{
  "success": false,
  "error": "Query execution failed: relation \"simulations\" does not exist"
}
```

---

## POST `/api/alerts/test-query`

Test a query without saving a rule. Used in the creation form for preview.

**Request Body:**
```json
{
  "dataSource": "pg_predictions",
  "query": "SELECT COUNT(*) as count FROM simulations WHERE created_at > NOW() - INTERVAL '2 hours'"
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "result": 5,
    "durationMs": 32
  }
}
```

---

## GET `/api/alerts/:id/history`

Get execution history for a rule.

**Query Params:**
- `limit` (default: 50, max: 100)
- `offset` (default: 0)

**Response 200:**
```json
{
  "success": true,
  "data": {
    "executions": [
      {
        "_id": "...",
        "ruleId": "6651a2b3c4d5e6f7a8b9c0d1",
        "ruleName": "Sin simulaciones en 2 horas",
        "executedAt": "2026-05-21T10:30:00Z",
        "queryResult": 0,
        "conditionMet": true,
        "notificationDispatched": true,
        "skippedReason": null,
        "error": null,
        "durationMs": 45
      }
    ],
    "total": 120
  }
}
```

---

## GET `/api/alerts/templates`

Get predefined alert templates.

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": "no_simulations",
      "name": "Sin simulaciones",
      "description": "Alerta si no hay simulaciones nuevas en X horas",
      "dataSource": "pg_predictions",
      "query": "SELECT COUNT(*) as count FROM simulations WHERE created_at > NOW() - INTERVAL '{{hours}} hours'",
      "condition": { "operator": "eq", "value": 0, "field": "count" },
      "intervalMinutes": 10,
      "notification": {
        "severity": "CRITICAL",
        "title": "Sin simulaciones nuevas",
        "message": "No se han recibido simulaciones en las ultimas {{hours}} horas"
      },
      "cooldownMinutes": 60,
      "variables": [
        { "name": "hours", "label": "Horas sin simulaciones", "type": "number", "default": 2 }
      ]
    }
  ]
}
```

---

## GET `/api/alerts/datasources`

Get available data sources with connection status.

**Response 200:**
```json
{
  "success": true,
  "data": [
    { "id": "mongodb_local", "name": "MongoDB (Logs & Forecasts)", "status": "connected" },
    { "id": "pg_predictions", "name": "PostgreSQL Predictions", "status": "connected" },
    { "id": "pg_hydro", "name": "PostgreSQL Hydro", "status": "connected" },
    { "id": "pg_model", "name": "PostgreSQL Model", "status": "disconnected" }
  ]
}
```
