<!--
  Sync Impact Report
  Version change: 0.0.0 → 1.0.0 (initial ratification)
  Added principles:
    - I. Hexagonal Architecture
    - II. CQRS with MediatR Pattern
    - III. Dependency Inversion via Ports
    - IV. Domain-Driven Validation
    - V. Integration Testing through Endpoints
    - VI. Type Safety & Strictness
    - VII. Structured Error Hierarchy
  Added sections:
    - Technology Stack
    - Development Workflow
  Templates requiring updates:
    - .specify/templates/plan-template.md ✅ compatible (constitution check section aligns)
    - .specify/templates/spec-template.md ✅ compatible (user stories + requirements structure)
    - .specify/templates/tasks-template.md ✅ compatible (phase structure maps to our layers)
  Follow-up TODOs: none
-->

# NestJS Boilerplate Constitution

## Core Principles

### I. Hexagonal Architecture

Every feature MUST be organized into four strict layers with unidirectional dependency flow:

- **api/** — HTTP input adapters: controllers, request/response DTOs, swagger docs. MUST only depend on application layer.
- **application/** — Use case orchestration: commands, queries, mappers. MUST only depend on domain layer.
- **domain/** — Business logic: entities, value objects, ports, errors, results. MUST have zero framework dependencies. No imports from infrastructure or api.
- **infrastructure/** — Output adapters: repository implementations, external service integrations. Implements domain ports.

Dependency rule: `api → application → domain ← infrastructure`. Infrastructure implements domain ports but domain never imports infrastructure.

### II. CQRS with MediatR Pattern

All business operations MUST go through `CommandBus` (writes) or `QueryBus` (reads) from `@nestjs/cqrs`. Controllers MUST NOT inject use cases, repositories, or services directly.

- Each Command contains a Command class + Handler in a single file (`application/commands/`)
- Each Query contains a Query class + Handler in a single file (`application/queries/`)
- Mappers live in a separate folder (`application/mappers/`) and handle DTO-to-Command and Result-to-ResponseDTO transformations
- Handlers orchestrate domain logic by calling ports; they do not contain business rules themselves

### III. Dependency Inversion via Ports

Domain ports MUST be defined as **abstract classes** (not TypeScript interfaces) to serve as NestJS DI tokens. Each port is bound to its implementation in `infrastructure.module.ts` using the `{ provide: AbstractPort, useClass: ConcreteImpl }` pattern.

- Repository ports live in `domain/ports/`
- Service ports live in `domain/types/`
- All bindings are centralized in `infrastructure.module.ts`
- This enables test isolation: real Postgres for repositories, mocks for external services

### IV. Domain-Driven Validation

Validation MUST happen at the domain boundary using Value Objects and entity business methods:

- **Value Objects** validate on construction and throw `EntityError` on invalid data. They are immutable.
- **Entities** contain business methods that enforce invariants (e.g., `user.markAsActive(emailId)`)
- Entities MUST NOT be anemic data bags — behavior belongs on the entity
- DTOs use `class-validator` decorators for HTTP-level validation (format, presence); domain-level validation (business rules) belongs in Value Objects

### V. Integration Testing through Endpoints

Tests MUST verify behavior exclusively through HTTP endpoints. No direct database access (`dataSource.getRepository()`) in test assertions.

- **Real Postgres** via Testcontainers — never SQLite or in-memory substitutes
- **Mock only external services** (email, third-party APIs) — never mock repositories or the database
- **Verify via API**: create resources with POST, verify with GET, confirm conflicts with duplicate POST
- Each test composes its own NestJS module via `createTestApp()` — MUST NOT import `ApplicationModule` or any module that loads real config
- Factory functions generate unique test data per invocation

### VI. Type Safety & Strictness

TypeScript MUST be configured with full strictness. Code MUST compile with zero errors and zero warnings.

- `strict: true`, `noImplicitAny`, `strictNullChecks`, `noUnusedLocals`, `noUnusedParameters`
- Path aliases (`@domain/*`, `@api/*`, `@application/*`, etc.) MUST be used instead of relative imports with `.js` extensions
- All path aliases MUST be mirrored in `jest-e2e.json` `moduleNameMapper`
- No `any` unless absolutely necessary and justified

### VII. Structured Error Hierarchy

All domain errors MUST extend the established error hierarchy. The global `HttpExceptionFilter` maps them to a consistent JSON response format `{ StatusCode, ErrorCode, ErrorDescription }`.

| Error Class | Purpose | Typical HTTP Status |
|-------------|---------|-------------------|
| `ApiError(statusCode, message, data?)` | Business rule violations with explicit HTTP status | As specified |
| `EntityError(message, field?)` | Value object / entity validation failures | 400 |
| `RepositoryError(message, error, data?)` | Database operation failures | 500 |
| `ProviderError(message)` | External service failures | 500 |
| `RetryError(message)` | Retry/timeout exhaustion | 500 |

Controllers MUST catch errors in a standard try/catch pattern: `EntityError` → 400, `ApiError` → its statusCode, everything else → 500.

## Technology Stack

| Component | Technology | Version |
|-----------|-----------|---------|
| Runtime | Node.js | >= 22 |
| Framework | NestJS | 11 |
| Language | TypeScript | 5.7+ |
| Database | PostgreSQL | 16 |
| ORM | TypeORM | 0.3 |
| CQRS | @nestjs/cqrs | 11 |
| Validation | class-validator + class-transformer | latest |
| Logging | nestjs-pino + pino-pretty | latest |
| API Docs | @nestjs/swagger | 11 |
| Testing | Jest + Supertest + Testcontainers | latest |
| Containerization | Docker (multi-stage) | latest |

Migrations MUST use raw SQL via TypeORM `MigrationInterface` for full control over DDL. `synchronize` MUST be `false` in production.

## Development Workflow

1. **New feature**: Create entity → value objects → port → result → repository → bind in infrastructure.module → command/query + handler → mapper → DTOs → controller endpoint → register in application.module → migration → factory → e2e test
2. **Swagger**: Every endpoint MUST use the `@ApiEndpoint` decorator. Every DTO property MUST have `@ApiProperty`.
3. **Logging**: Use injected `Logger` from `nestjs-pino`. No `console.log`.
4. **Commits**: Follow conventional commits (`feat:`, `fix:`, `chore:`, `docs:`).
5. **Code style**: ESLint + Prettier enforced. Single quotes, trailing commas, semicolons. Max line length 250.
6. **Specs**: For non-trivial features, create a spec via `/speckit.specify` before implementation.

## Governance

This constitution supersedes all ad-hoc practices. All code contributions MUST comply with the principles above.

- **Amendments** require updating this file, incrementing the version, and verifying consistency with `.specify/templates/` and `CLAUDE.md`.
- **Complexity justification**: Any deviation from these principles (e.g., skipping the port layer, direct DB access in tests) MUST be explicitly justified in the PR description.
- **Runtime guidance**: See `CLAUDE.md` at repository root for detailed implementation patterns, code examples, and step-by-step instructions.

**Version**: 1.0.0 | **Ratified**: 2026-02-19 | **Last Amended**: 2026-02-19
