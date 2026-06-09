# NestJS Boilerplate

Production-ready NestJS API boilerplate with **Hexagonal Architecture**, **CQRS**, and **PostgreSQL**.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js >= 22 |
| Framework | NestJS 11 |
| Language | TypeScript 5.7+ (strict mode) |
| Database | PostgreSQL 16 via TypeORM 0.3 |
| CQRS | @nestjs/cqrs 11 |
| Validation | class-validator + class-transformer |
| Logging | nestjs-pino + pino-pretty |
| Admin Panel | AdminJS (dev only) |
| Testing | Jest + Supertest + Testcontainers |
| API Docs | Swagger (OpenAPI) |

## Prerequisites

- **Node.js** >= 22 (see `.nvmrc`)
- **Docker** & **Docker Compose** (for PostgreSQL and e2e tests)
- **npm** >= 10.5

## Getting Started

### 1. Clone and install

```bash
git clone <repository-url>
cd nestjs-boilerplate
nvm use           # switches to Node 22
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Key variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `APP_PORT` | `3000` | HTTP port |
| `NODE_ENV` | `development` | Environment |
| `APP_LOG_LEVEL` | `info` | Log level (debug, info, warn, error) |
| `DB_HOST` | `127.0.0.1` | PostgreSQL host |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_USERNAME` | `postgres` | Database user |
| `DB_PASSWORD` | `secret` | Database password |
| `DB_DATABASE` | `boilerplate` | Database name |

### 3. Start with Docker (recommended)

```bash
docker compose up
```

This starts both the API and PostgreSQL, runs migrations automatically, and watches for file changes.

- API: http://localhost:3000
- Swagger: http://localhost:3000/docs
- AdminJS: http://localhost:3000/admin (dev only)
- Health: http://localhost:3000/health

### 4. Start locally (without Docker)

Make sure PostgreSQL is running, then:

```bash
npm run migration:run
npm run start:dev
```

## API Endpoints

### Health

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check (app + database) |

### Users

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/users/register` | Register a new user |
| `GET` | `/users/:id` | Get user by ID |

### Roles

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/roles` | Create a new role |
| `GET` | `/roles` | List all roles |
| `POST` | `/users/:userId/roles` | Assign a role to a user |
| `GET` | `/users/:userId/roles` | Get all roles for a user |
| `DELETE` | `/users/:userId/roles/:roleId` | Remove a role from a user |

Full API documentation with request/response schemas is available at `/docs` (Swagger UI).

## Architecture

The project follows **Hexagonal Architecture** (Ports & Adapters) with **CQRS** for separating read and write operations.

```
src/
├── main.ts                         # Bootstrap (pipes, filters, swagger, helmet, cors)
├── app.module.ts                   # Root module
│
├── app/                            # Feature domain
│   ├── api/                        # Input adapters (HTTP)
│   │   ├── controllers/            # REST controllers
│   │   └── dtos/                   # Request/Response DTOs
│   │
│   ├── application/                # Use cases
│   │   ├── commands/               # Write operations (grouped by domain)
│   │   ├── queries/                # Read operations (grouped by domain)
│   │   └── mappers/                # DTO <-> Command/Result transformations
│   │
│   ├── domain/                     # Business logic (framework-agnostic)
│   │   ├── entities/               # TypeORM entities
│   │   ├── value-objects/          # Immutable validated types
│   │   ├── ports/                  # Abstract classes (DI contracts)
│   │   ├── errors/                 # Domain error hierarchy
│   │   └── results/                # Command/Query result objects
│   │
│   └── infrastructure/             # Output adapters
│       ├── persistence/            # TypeORM repositories
│       ├── services/               # External services (notifications, HTTP)
│       └── infrastructure.module.ts
│
├── common/                         # Cross-cutting (exceptions, pipes, decorators)
├── configuration/                  # App & DB config (@nestjs/config)
├── health/                         # Health check endpoint (Terminus)
├── swagger/                        # Swagger setup + decorators
└── migrations/                     # TypeORM migrations (raw SQL)
```

### Request Flow

```
HTTP Request
  → Controller
    → Mapper.toCommand(dto)
      → CommandBus.execute(command)
        → Handler (orchestrates domain logic)
          → Port (abstract class)
            → Repository (implementation)
              → Result
    → Mapper.toResponseDto(result)
  → HTTP Response
```

### Commands and Queries

Commands and queries are grouped by domain entity to reduce boilerplate:

```
commands/
├── role.commands.ts    # CreateRole, AssignRoleToUser, RemoveRoleFromUser
└── user.commands.ts    # RegisterUser

queries/
├── role.queries.ts     # ListRoles, GetUserRoles
└── user.queries.ts     # GetUserById
```

Each file contains multiple Command/Query + Handler pairs separated by section dividers.

## Scripts

| Script | Description |
|--------|-------------|
| `npm run build` | Compile TypeScript |
| `npm run start:dev` | Dev mode with file watching |
| `npm run start:prod` | Production mode |
| `npm run lint` | ESLint with auto-fix |
| `npm run format` | Prettier formatting |
| `npm run test` | Unit tests |
| `npm run test:e2e` | Integration tests (requires Docker) |
| `npm run migration:run` | Run pending migrations |
| `npm run migration:create --name=<name>` | Create a new empty migration |

## Testing

Integration tests use **Testcontainers** to spin up a real PostgreSQL instance per test suite.

```bash
# Run all e2e tests (Docker must be running)
npm run test:e2e

# Run a specific test file
npm run test:e2e -- --testPathPattern=register-user
```

Test structure:

```
test/
├── setup/jest-setup.ts          # Polyfills
├── helpers/
│   ├── test-app.helper.ts       # createTestApp() with Testcontainers
│   └── db.helper.ts             # cleanDatabase() between tests
├── factories/                   # Builders for test data
└── modules/                     # e2e test files by feature
    ├── users/
    └── roles/
```

Testing philosophy:
- Test through HTTP endpoints only (no direct DB access in tests)
- Real PostgreSQL via Testcontainers (no in-memory mocks)
- Mock only external services (email, third-party APIs)
- Verify via API: create via POST, confirm via GET

## Database Migrations

Migrations use raw SQL for full control over the schema.

```bash
# Create a new migration
npm run migration:create --name=add-foo-table

# Run pending migrations
npm run migration:run

# Run in production (against compiled JS)
npm run migration:run:prod
```

## Docker

Multi-stage Dockerfile with three targets:

| Stage | Purpose |
|-------|---------|
| `dev` | Full source with hot-reload |
| `build` | TypeScript compilation |
| `prod` | Minimal image with `dist/` + production deps |

```bash
# Development (with hot-reload and PostgreSQL)
docker compose up

# Production build
docker build --target prod -t nestjs-boilerplate .
```

## Path Aliases

| Alias | Maps to |
|-------|---------|
| `@app/*` | `src/app/*` |
| `@api/*` | `src/app/api/*` |
| `@domain/*` | `src/app/domain/*` |
| `@application/*` | `src/app/application/*` |
| `@infrastructure/*` | `src/app/infrastructure/*` |
| `@config/*` | `src/configuration/*` |
| `@common/*` | `src/common/*` |
| `@health/*` | `src/health/*` |
| `@swagger/*` | `src/swagger/*` |

## License

UNLICENSED
