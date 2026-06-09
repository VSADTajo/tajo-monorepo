# Implementation Plan: Generic Notification Service

**Branch**: `001-notifications-api` | **Date**: 2026-03-20 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-notifications-api/spec.md`

## Summary

Build a source-agnostic notification microservice that consumes events from RabbitMQ and exposes a REST API for listing, filtering, reading, and archiving notifications. The service follows the existing NestJS boilerplate architecture (Hexagonal + CQRS) with a single generic `Notification` entity backed by PostgreSQL. Domain-specific context is stored as JSONB metadata, keeping the service decoupled from upstream producers.

## Technical Context

**Language/Version**: TypeScript 5.7+ on Node.js >= 22
**Primary Dependencies**: NestJS 11, @nestjs/cqrs 11, TypeORM 0.3, amqplib (via @nestjs/microservices), class-validator, nestjs-pino
**Storage**: PostgreSQL 16 (new database `ms_notifications`, container `infra-db-notifications`, external port 5438)
**Testing**: Jest + Supertest + Testcontainers (PostgreSQL)
**Target Platform**: Linux server (Docker container on Hetzner VM)
**Project Type**: Single NestJS hybrid application (HTTP + RabbitMQ consumer)
**Performance Goals**: 100 events/sec ingestion, <500ms list endpoint response for 100k records
**Constraints**: Metadata JSONB max 10KB per notification, manual RabbitMQ ack (no message loss)
**Scale/Scope**: Single entity (Notification), 1 consumer, 1 controller, ~5 endpoints

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Hexagonal Architecture | PASS | api → application → domain ← infrastructure layers maintained |
| II. CQRS with MediatR Pattern | PASS | Commands for create/update, Queries for list/filter via CommandBus/CachingQueryBus |
| III. Dependency Inversion via Ports | PASS | INotificationRepository abstract class as DI token, bound in infrastructure.module |
| IV. Domain-Driven Validation | PASS | Notification entity implements IValidable with validate() method |
| V. Integration Testing through Endpoints | PASS | E2E tests via HTTP endpoints with real PostgreSQL (Testcontainers) |
| VI. Type Safety & Strictness | PASS | strict: true, path aliases, no any |
| VII. Structured Error Hierarchy | PASS | EntityError for validation, ApiError for business rules, RepositoryError for DB |

**Gate result**: ALL PASS — proceed to Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/001-notifications-api/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── rest-api.md      # REST endpoint contracts
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── api/
│   │   ├── controllers/
│   │   │   └── notification.controller.ts       # REST endpoints (list, read, archive, bulk)
│   │   └── dtos/
│   │       └── notification.dtos.ts             # Request/Response DTOs
│   │
│   ├── application/
│   │   ├── commands/
│   │   │   └── notification.commands.ts         # CreateNotification, MarkAsRead, Archive, BulkRead, BulkArchive
│   │   ├── queries/
│   │   │   └── notification.queries.ts          # ListNotifications (with filters + pagination)
│   │   ├── mappers/
│   │   │   └── notification.mappers.ts          # DTO ↔ Command/Query, Result → ResponseDTO
│   │   ├── consumers/
│   │   │   └── notification.consumer.ts         # RabbitMQ consumer → dispatches CreateNotificationCommand
│   │   └── application.module.ts
│   │
│   ├── domain/
│   │   ├── entities/
│   │   │   └── notification.entity.ts           # Notification entity (type, source, title, message, metadata, severity, status)
│   │   ├── value-objects/
│   │   │   └── notification-severity.value-object.ts  # INFO | WARNING | CRITICAL
│   │   ├── ports/
│   │   │   └── notification-repository.port.ts  # Abstract repository
│   │   ├── results/
│   │   │   └── notification.result.ts           # NotificationResult, ListNotificationsResult
│   │   ├── errors/                              # Reuse existing EntityError, ApiError hierarchy
│   │   └── types/
│   │       └── notification-status.enum.ts      # UNREAD | READ | ARCHIVED
│   │
│   └── infrastructure/
│       ├── persistence/
│       │   └── notification.repository.ts       # TypeORM implementation
│       ├── messaging/
│       │   └── messaging.registry.ts            # Add NOTIFICATION_CREATED topic
│       └── infrastructure.module.ts
│
├── configuration/                               # Reuse existing postgres, redis, rabbitmq configs
├── migrations/
│   └── {timestamp}-create-notifications-table.ts
└── main.ts                                      # Update queue name for hybrid consumer
```

**Structure Decision**: Single NestJS project following established Hexagonal Architecture. All boilerplate SFTP-related modules will be removed and replaced with Notification domain. The hybrid HTTP + RabbitMQ pattern from the boilerplate is reused directly.

## Complexity Tracking

> No constitution violations — this section is intentionally empty.
