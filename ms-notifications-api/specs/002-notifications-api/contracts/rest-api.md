# REST API Contract: ms-notifications-api

**Branch**: `001-notifications-api` | **Date**: 2026-03-20
**Base URL**: `http://ms-notifications-api:3009`

## Endpoints

### GET /notifications

List notifications with filtering and pagination. ARCHIVED notifications excluded by default.

**Query Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| page | number | No | 1 | Page number (1-indexed) |
| pageSize | number | No | 20 | Items per page (max 100) |
| status | string | No | UNREAD,READ | Filter by status (UNREAD, READ, ARCHIVED) |
| severity | string | No | — | Filter by severity (INFO, WARNING, CRITICAL) |
| source | string | No | — | Filter by source service |
| type | string | No | — | Filter by notification type |
| fromDate | ISO8601 | No | — | Filter notifications created after this date |
| toDate | ISO8601 | No | — | Filter notifications created before this date |

**Response 200**:

```json
{
  "data": [
    {
      "id": "uuid",
      "type": "THRESHOLD_EXCEEDED",
      "source": "ms-predictions-api",
      "title": "Umbral superado en estación X",
      "message": "El nivel de agua supera el umbral configurado...",
      "metadata": { "stationId": "uuid", "thresholdValue": 5.0, "actualValue": 5.8 },
      "severity": "CRITICAL",
      "status": "UNREAD",
      "createdAt": "2026-03-20T10:00:00.000Z",
      "updatedAt": "2026-03-20T10:00:00.000Z"
    }
  ],
  "total": 150,
  "page": 1,
  "pageSize": 20,
  "totalPages": 8
}
```

---

### PATCH /notifications/:id/read

Mark a single notification as READ.

**Path Parameters**: `id` (UUID)

**Response 200**:

```json
{
  "id": "uuid",
  "status": "READ",
  "updatedAt": "2026-03-20T10:05:00.000Z"
}
```

**Response 404**: Notification not found.

---

### PATCH /notifications/:id/archive

Archive a single notification.

**Path Parameters**: `id` (UUID)

**Response 200**:

```json
{
  "id": "uuid",
  "status": "ARCHIVED",
  "updatedAt": "2026-03-20T10:10:00.000Z"
}
```

**Response 404**: Notification not found.

---

### PATCH /notifications/bulk/read

Mark multiple notifications as READ.

**Request Body**:

```json
{
  "ids": ["uuid-1", "uuid-2", "uuid-3"]
}
```

**Constraints**: Max 100 IDs per request.

**Response 200**:

```json
{
  "updated": ["uuid-1", "uuid-2"],
  "notFound": ["uuid-3"]
}
```

---

### PATCH /notifications/bulk/archive

Archive multiple notifications.

**Request Body**:

```json
{
  "ids": ["uuid-1", "uuid-2", "uuid-3"]
}
```

**Constraints**: Max 100 IDs per request.

**Response 200**:

```json
{
  "updated": ["uuid-1", "uuid-2"],
  "notFound": ["uuid-3"]
}
```

---

### GET /health

Health check endpoint (existing boilerplate pattern).

**Response 200**:

```json
{
  "status": "ok",
  "info": {
    "database": { "status": "up" },
    "rabbitmq": { "status": "up" },
    "redis": { "status": "up" }
  }
}
```

## RabbitMQ Contract

### Exchange

| Property | Value |
|----------|-------|
| Name | `notifications` |
| Type | `topic` |
| Durable | `true` |

### Queue

| Property | Value |
|----------|-------|
| Name | `ms-notifications-api.notification.created` |
| Durable | `true` |
| Binding | Exchange `notifications`, routing key `notification.created` |

### Message Payload

Published by any producer microservice:

```json
{
  "type": "THRESHOLD_EXCEEDED",
  "source": "ms-predictions-api",
  "title": "Umbral superado en estación X",
  "message": "El nivel de agua en estación X (5.8m) supera el umbral configurado (5.0m)",
  "metadata": {
    "stationId": "uuid",
    "predictionResultId": "uuid",
    "thresholdValue": 5.0,
    "actualValue": 5.8
  },
  "severity": "CRITICAL"
}
```

**Required fields**: type, source, title, message, severity
**Optional fields**: metadata (defaults to `{}`)

### Consumer Behavior

- Manual acknowledgment (`noAck: false`)
- On valid message: create notification, ack
- On invalid message (validation failure): nack without requeue, log error
- On processing error (DB failure): nack with requeue for retry
- Prefetch count: 10 (configurable via `RABBITMQ_PREFETCH`)
