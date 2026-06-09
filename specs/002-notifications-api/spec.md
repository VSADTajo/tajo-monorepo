# Feature Specification: Generic Notification Service

**Feature Branch**: `001-notifications-api`
**Created**: 2026-03-19
**Status**: Draft
**Input**: User description: "ms-notifications-api: A generic, source-agnostic notification microservice for the North Labs platform. Consumes notification events from RabbitMQ (any microservice can publish). Provides REST API to list/filter/read/archive notifications. No knowledge of upstream domains — all context lives in metadata. First producer will be ms-predictions-api publishing threshold-exceeded events."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Receive and Store Notifications from Any Source (Priority: P1)

Any microservice in the North Labs platform can publish a notification event to RabbitMQ. The notification service consumes the event, validates the payload, and persists a new notification record. The service has no knowledge of the upstream domain — it simply stores the notification with its metadata.

**Why this priority**: This is the foundational capability. Without event consumption and persistence, no other functionality (listing, reading, archiving) is possible. This is the MVP.

**Independent Test**: Can be fully tested by publishing a message to the RabbitMQ exchange and verifying the notification appears in the database with correct type, source, title, message, severity, and metadata.

**Acceptance Scenarios**:

1. **Given** a microservice publishes a valid notification event to the RabbitMQ exchange, **When** the notification service consumes it, **Then** a new notification record is created with status UNREAD and all fields correctly mapped.
2. **Given** a microservice publishes an event with missing required fields (e.g., no title), **When** the notification service attempts to consume it, **Then** the message is rejected and an error is logged without crashing the service.
3. **Given** a microservice publishes an event with an unknown type or source, **When** the notification service consumes it, **Then** the notification is still created because type and source are free-form strings — the service is agnostic.
4. **Given** the notification service is temporarily down, **When** events are published to RabbitMQ, **Then** messages are queued and consumed when the service recovers (no data loss).

---

### User Story 2 - List and Filter Notifications (Priority: P1)

A consumer (e.g., a frontend application or another microservice) can retrieve notifications via REST API with flexible filtering. Filters include status, severity, source, type, date range, and read/unread state. Results are paginated.

**Why this priority**: Equal priority to P1 because ingesting notifications without being able to read them provides no user value. This is the read side of the MVP.

**Independent Test**: Can be tested by seeding notification records and calling the list endpoint with various filter combinations, verifying correct results and pagination.

**Acceptance Scenarios**:

1. **Given** multiple notifications exist, **When** a consumer requests all notifications without filters, **Then** a paginated list is returned ordered by creation date (newest first).
2. **Given** notifications of different severities exist, **When** a consumer filters by severity CRITICAL, **Then** only critical notifications are returned.
3. **Given** notifications from multiple sources exist, **When** a consumer filters by source "ms-predictions-api", **Then** only notifications from that source are returned.
4. **Given** notifications exist, **When** a consumer filters by status UNREAD, **Then** only unread notifications are returned.
5. **Given** notifications exist, **When** a consumer requests page 2 with page size 10, **Then** the correct slice is returned with total count and pagination metadata.

---

### User Story 3 - Mark Notification as Read (Priority: P2)

A consumer can mark a specific notification as read. This updates its status from UNREAD to READ.

**Why this priority**: Reading notifications is a core interaction but depends on P1 stories being functional first.

**Independent Test**: Can be tested by creating a notification, calling the mark-as-read endpoint, and verifying the status changed.

**Acceptance Scenarios**:

1. **Given** an UNREAD notification exists, **When** a consumer marks it as read, **Then** the notification status changes to READ and updatedAt is refreshed.
2. **Given** a notification is already READ, **When** a consumer marks it as read again, **Then** the operation is idempotent — no error, status remains READ.
3. **Given** a non-existent notification ID, **When** a consumer attempts to mark it as read, **Then** a 404 error is returned.

---

### User Story 4 - Archive Notifications (Priority: P2)

A consumer can archive a notification, moving it to ARCHIVED status. Archived notifications are excluded from default list queries but can still be retrieved with an explicit filter.

**Why this priority**: Archiving supports notification lifecycle management but is not required for the initial flow.

**Independent Test**: Can be tested by archiving a notification and verifying it no longer appears in default queries but appears when filtering by ARCHIVED status.

**Acceptance Scenarios**:

1. **Given** a READ or UNREAD notification exists, **When** a consumer archives it, **Then** the notification status changes to ARCHIVED.
2. **Given** no status filter is provided on the list endpoint, **When** a consumer lists notifications, **Then** ARCHIVED notifications are excluded by default.
3. **Given** a consumer explicitly filters by status ARCHIVED, **When** the list endpoint is called, **Then** only archived notifications are returned.

---

### User Story 5 - Bulk Operations (Priority: P3)

A consumer can mark multiple notifications as read or archive multiple notifications in a single request by providing a list of notification IDs.

**Why this priority**: Quality-of-life improvement for frontend consumers that handle many notifications at once. Not required for MVP.

**Independent Test**: Can be tested by creating multiple notifications, calling the bulk endpoint, and verifying all targeted notifications were updated.

**Acceptance Scenarios**:

1. **Given** multiple UNREAD notifications exist, **When** a consumer sends a bulk mark-as-read request with their IDs, **Then** all specified notifications are marked as READ.
2. **Given** a bulk request includes a non-existent ID among valid ones, **When** the request is processed, **Then** valid IDs are updated and the non-existent ID is reported in a partial-success response.

---

### Edge Cases

- What happens when the RabbitMQ connection is lost? The service retries with exponential backoff and logs connection failures.
- What happens when the metadata JSON exceeds a reasonable size? The service enforces a maximum metadata size (10KB) and rejects oversized payloads.
- What happens when a consumer requests a notification that doesn't exist? A 404 response is returned.
- What happens when many notifications arrive in a burst? The consumer processes messages at a sustainable rate without overwhelming the database.
- What happens when duplicate events arrive (at-least-once delivery)? The service creates separate notification records — each event is a distinct occurrence.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST consume notification events from a RabbitMQ exchange and persist them as notification records.
- **FR-002**: System MUST accept notification events with the following required fields: type, source, title, message, severity.
- **FR-003**: System MUST accept an optional metadata field (arbitrary key-value structure) attached to each notification.
- **FR-004**: System MUST assign status UNREAD to every newly created notification.
- **FR-005**: System MUST expose a REST endpoint to list notifications with pagination (page, pageSize) and filters (status, severity, source, type, date range).
- **FR-006**: System MUST exclude ARCHIVED notifications from list results by default (unless explicitly filtered).
- **FR-007**: System MUST expose a REST endpoint to mark a single notification as READ.
- **FR-008**: System MUST expose a REST endpoint to archive a single notification.
- **FR-009**: System MUST expose REST endpoints for bulk mark-as-read and bulk archive operations.
- **FR-010**: System MUST validate incoming RabbitMQ messages and reject malformed payloads without crashing.
- **FR-011**: System MUST log all consumed events and any processing errors for observability.
- **FR-012**: System MUST expose a health check endpoint that reports service and dependency status (database, message broker, cache).

### Key Entities

- **Notification**: A generic record of something noteworthy that occurred in the platform. Contains a type (free-form category), source (originating service), human-readable title and message, severity level (INFO, WARNING, CRITICAL), flexible metadata for domain-specific context, and a lifecycle status (UNREAD, READ, ARCHIVED). Has no knowledge of upstream domains — all domain-specific context lives in metadata.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Any microservice can publish a notification event and see it appear in the notifications list within 5 seconds under normal load.
- **SC-002**: The notification list endpoint returns paginated results within 500ms for up to 100,000 stored notifications.
- **SC-003**: Zero notification events are lost during normal operation — all published events are eventually persisted.
- **SC-004**: The service processes burst loads of up to 100 events per second without message loss or degradation.
- **SC-005**: Consumers can filter notifications by any combination of status, severity, source, type, and date range and receive accurate results.
- **SC-006**: The service recovers from message broker or database outages automatically and resumes processing queued messages without manual intervention.

## Assumptions

- Authentication and authorization are handled at the API Gateway level (ms-gateway-api). The notification service itself does not implement auth.
- Notifications are informational records — no push notifications, emails, or external delivery channels are in scope for this initial version.
- The message broker exchange and routing configuration follows the existing platform conventions (topic exchange).
- Notification data retention follows platform-standard practices. No automatic purge or TTL is implemented initially.
- The metadata field is stored with a practical size limit of 10KB per notification.
