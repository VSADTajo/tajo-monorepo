# Research: Generic Notification Service

**Branch**: `001-notifications-api` | **Date**: 2026-03-20

## R1: RabbitMQ Consumer Pattern for Notification Ingestion

**Decision**: Use NestJS hybrid application pattern (HTTP + RMQ microservice) with a topic exchange for notification events.

**Rationale**: The boilerplate already implements this pattern — a single NestJS app runs both an HTTP server and a RabbitMQ consumer via `@nestjs/microservices`. Topic exchanges allow flexible routing (e.g., `notification.created`, `notification.threshold.*`) and multiple producers can publish to the same exchange without coordination.

**Alternatives considered**:
- Direct queue (point-to-point): Too rigid — doesn't support multiple consumers or routing patterns.
- Separate consumer process: Adds operational complexity for no benefit at current scale.
- WebSocket/SSE push to frontend: Out of scope per spec assumptions — notifications are stored records, not real-time pushes.

**Implementation details**:
- Exchange: `notifications` (topic type, durable)
- Routing key: `notification.created` (all producers use this initially)
- Queue: `ms-notifications-api.notification.created` (bound to exchange)
- Consumer uses `@EventPattern('notification.created')` with manual ack
- Message payload validated before dispatching `CreateNotificationCommand` via CommandBus

## R2: Notification Entity Design — Generic vs Domain-Specific

**Decision**: Single generic entity with JSONB `metadata` field. No domain-specific columns (no stationId, thresholdValue, etc.).

**Rationale**: The spec explicitly requires source-agnostic design. All domain context lives in metadata. This means any microservice can publish notifications without schema changes to ms-notifications-api.

**Alternatives considered**:
- Polymorphic entities (one table per notification type): Over-engineered for current needs. Creates coupling between notification types and schema.
- EAV pattern (attribute-value pairs): Worse query performance than JSONB, more complex.
- Separate metadata table with FK: Unnecessary join — JSONB on the same row is simpler and PostgreSQL supports indexing JSONB.

**Implementation details**:
- `metadata` column: `jsonb`, nullable, default `{}`
- Enforce 10KB max via entity validation (check `JSON.stringify(metadata).length`)
- GIN index on metadata for future query needs (optional, add when needed)
- Composite indexes: `(status, createdAt)`, `(source, createdAt)`, `(severity, createdAt)` for common filter patterns

## R3: Pagination Strategy

**Decision**: Offset-based pagination with `page` and `pageSize` parameters, returning `total`, `page`, `pageSize`, `totalPages` in response.

**Rationale**: Consistent with existing platform patterns. The notification list is expected to be queried with filters (status, severity, source) which reduce result sets. Offset pagination works well under 100k records with proper indexes.

**Alternatives considered**:
- Cursor-based pagination: Better for infinite scroll but more complex. Not needed — admin/dashboard usage patterns, not infinite feeds.
- Keyset pagination: Good performance but requires ordered, unique column. Can migrate later if needed.

**Implementation details**:
- Default page size: 20, max page size: 100
- Always order by `createdAt DESC` (newest first)
- TypeORM `findAndCount` with `skip` and `take`

## R4: Bulk Operations Design

**Decision**: Accept array of UUIDs, process in a single database transaction, return partial success response.

**Rationale**: Frontend consumers need to mark-all-as-read or archive-selected efficiently. A single transaction ensures atomicity for valid IDs while reporting failures for invalid ones.

**Alternatives considered**:
- Individual requests per notification: N+1 problem, poor UX for bulk actions.
- Fire-and-forget (no response about failures): Doesn't meet spec requirement for partial-success reporting.

**Implementation details**:
- Max batch size: 100 IDs per request
- Use TypeORM `In()` operator for bulk update
- Response: `{ updated: string[], notFound: string[] }`

## R5: Infrastructure Setup — Database and Docker

**Decision**: New PostgreSQL database `ms_notifications` in container `infra-db-notifications` on external port 5438.

**Rationale**: Each microservice has its own database per platform convention. Port 5438 is the next available after infra-db-predictions (5437).

**Implementation details**:
- Add to `docker-compose.yml`: new postgres service `db-notifications`
- Add to `docker-compose.apps.yml`: new service `ms-notifications-api` on port 3009
- Add to `jenkins/casc.yaml`: new multibranch pipeline
- Environment variables follow existing pattern (DB_HOST, DB_PORT, DB_DATABASE, DB_USERNAME, DB_PASSWORD)

## R6: Removing Boilerplate SFTP Modules

**Decision**: Remove all SFTP-related domain modules (file, sftp, mapping-schema, sftp-user, cleanup-job) and replace with Notification domain.

**Rationale**: The boilerplate is a scaffold. All SFTP-specific code must be removed to avoid confusion and dead code. Retain infrastructure patterns (rabbitmq, redis, health, swagger, error handling).

**What to keep**:
- Configuration modules (app, postgres, redis, rabbitmq)
- Infrastructure plumbing (rabbitmq.service, redis-cache.service, CachingQueryBus)
- Common utilities (exceptions, pipes, decorators)
- Health module, Swagger setup, main.ts bootstrap pattern
- Error hierarchy (EntityError, ApiError, RepositoryError)
- Docker, Jenkinsfile, test infrastructure

**What to remove**:
- All controllers, commands, queries, mappers, DTOs for: file, sftp, mapping-schema, sftp-user, cleanup-job
- All entities: MappingSchema, SftpUser, CleanupJob
- All repositories: mapping-schema, sftp-user, cleanup-job
- All services: sftp-client, file-storage, file-transformer, sftp-server, cleanup-scheduler
- All ports for above services
- All value objects for above domains
- All results for above domains
- All migrations for above tables
- SFTP/storage configuration modules
- Frontend directory (SFTP Mapping Engine UI)
- Example consumer
