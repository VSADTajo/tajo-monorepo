# CLAUDE.md — ms-meteo-api

## Project Overview

NestJS microservice that ingests meteorological raster data from the SFTP storage (RADAR, HARMONIE, EPS, SAIH) and publishes it as time-aware ImageMosaic layers in GeoServer (workspace `tajo`). Built on **Hexagonal Architecture** + **CQRS** (`@nestjs/cqrs`) with PostgreSQL (TypeORM) for the audit table.

**Domain feature spec**: see [specs/001-meteo-ingest/](specs/001-meteo-ingest/) for the full specification, plan, data model, contracts and tasks.

**Key responsibilities**:
- `GET /meteo/info` — list metadata for every (provider, variable) dataset, with optional filters.
- `POST /meteo/sync` — manual trigger of the ingest pipeline (cron also runs every 3 hours by default).
- Discover datasets dynamically from `tajo/METEO/<provider>/<variable>/info.json` via the existing `ms-sftp-api` HTTP endpoints (this service does **not** mount the SFTP volume).
- For each `(provider, variable)`: download raster files, convert ESRI ASCII Grid → GeoTIFF with `gdal_translate`, publish granules to a single time-aware ImageMosaic layer named `tajo:<provider>_<variable>`.
- Daily retention cron purges granules older than `METEO_RETENTION_DAYS` (default 7).
- Auditability: every cycle writes a row in `meteo_ingest_run` (running / ok / partial / failed / noop).

**Underlying boilerplate**: this service follows the same NestJS Hexagonal + CQRS conventions as the rest of the platform. The reference patterns below are inherited from the platform constitution and should not be changed without updating `.specify/memory/constitution.md`.

- **Runtime**: Node.js >= 22 (`.nvmrc` specifies v22)
- **Framework**: NestJS 11
- **Language**: TypeScript 5.7+ with `strict: true`
- **Module system**: `NodeNext` (requires `.js` extensions on relative imports for runtime, but use **path aliases** instead)
- **Database**: PostgreSQL 16 via TypeORM
- **Cache**: Redis 7 via `ioredis` with CachingQueryBus wrapper
- **Logging**: `nestjs-pino` + `pino-pretty`
- **Admin panel**: AdminJS (disabled in production)
- **Testing**: Jest + Supertest + Testcontainers

---

## Quick Commands

```bash
npm run build                  # Compile with nest build
npm run start:dev              # Dev mode with watch
npm run test                   # Unit tests
npm run test:e2e               # Integration tests (requires Docker)
npm run lint                   # ESLint + fix
npm run format                 # Prettier
npm run migration:run          # Run pending migrations
npm run migration:create --name=my-migration  # Create empty migration
docker compose up              # Start API + Postgres + Redis
```

---

## Architecture

```
src/
├── main.ts                         # Bootstrap: pipes, filters, swagger, helmet, cors
├── app.module.ts                   # Root module: config, logging, feature modules
├── admin.ts                        # AdminJS panel setup (dev only)
│
├── app/                            # Feature domain (hexagonal layers)
│   ├── api/                        # INPUT ADAPTER (HTTP layer)
│   │   ├── controllers/            # REST controllers
│   │   ├── dtos/                   # Request/Response DTOs grouped by domain (e.g., role.dtos.ts, user.dtos.ts)
│   │   └── docs/                   # Swagger doc decorators (future)
│   │
│   ├── application/                # USE CASES (orchestration)
│   │   ├── commands/               # Write operations grouped by domain (e.g., role.commands.ts)
│   │   ├── queries/                # Read operations grouped by domain (e.g., role.queries.ts)
│   │   ├── mappers/                # DTO <-> Command/Result transformations grouped by domain (e.g., role.mappers.ts)
│   │   ├── consumers/              # RabbitMQ message handlers (@MessagePattern, @EventPattern)
│   │   └── application.module.ts   # Registers handlers + controllers + consumers
│   │
│   ├── domain/                     # BUSINESS LOGIC (zero framework deps ideally)
│   │   ├── entities/               # TypeORM entities
│   │   ├── value-objects/          # Immutable validated types (Name, Email, etc.)
│   │   ├── ports/                  # Abstract classes = interfaces for DI
│   │   ├── errors/                 # Domain error hierarchy
│   │   ├── results/                # Command/Query result DTOs
│   │   └── types/                  # Shared abstract types and interfaces
│   │
│   └── infrastructure/             # OUTPUT ADAPTERS (implementations)
│       ├── cache/                  # CachingQueryBus + cache config registry
│       ├── messaging/              # RabbitMQ service + queue/topic registry
│       ├── persistence/            # TypeORM repositories + DB provider module
│       ├── services/               # External services (notifications, cache, HTTP, retry)
│       └── infrastructure.module.ts # Binds ports to implementations
│
├── common/                         # Cross-cutting concerns
│   ├── exceptions/                 # Global exception filter + custom validation exception
│   ├── pipes/                      # CustomValidationPipe (whitelist + forbidNonWhitelisted)
│   ├── decorators/                 # FieldTag decorator for validation error mapping
│   └── validation-error-map.ts     # Error code mapping
│
├── configuration/                  # App & DB config via @nestjs/config
│   ├── app/                        # APP_NAME, APP_PORT, NODE_ENV, LOG_LEVEL
│   ├── postgres/                   # DB_HOST, DB_PORT, etc. + DataSource export
│   ├── redis/                      # REDIS_HOST, REDIS_PORT, REDIS_DEFAULT_TTL
│   ├── rabbitmq/                   # RABBITMQ_HOST, RABBITMQ_PORT, RABBITMQ_USER, etc.
│   └── helpers/                    # validate-config helper
│
├── health/                         # /health endpoint (Terminus)
├── swagger/                        # Swagger setup + custom UI + @ApiEndpoint decorator
└── migrations/                     # TypeORM migrations (raw SQL)
```

---

## CQRS Pattern (MediatR Style)

All business operations go through `CommandBus` (writes) or `CachingQueryBus` (reads) from `@nestjs/cqrs`. Controllers never inject use cases directly. `CachingQueryBus` wraps `QueryBus` with a transparent Redis cache layer.

### Flow: Controller -> CommandBus -> Handler -> Port -> Repository

```
Request -> Controller -> Mapper.toCommand(dto) -> CommandBus.execute(command)
                                                         |
                                                   CommandHandler
                                                   (orchestrates domain logic)
                                                         |
                                                   Port (abstract class)
                                                         |
                                                   Repository (implementation)
                                                         |
                                                   Result -> Mapper.toResponseDto(result)
                                                         |
                                                   Response
```

### Adding a new Command (write operation)

Commands are **grouped by domain entity** in a single file: `src/app/application/commands/{domain}.commands.ts`. Multiple command+handler pairs live in the same file, separated by section dividers.

1. **Add the Command + Handler** to the appropriate domain file (e.g., `role.commands.ts`, `user.commands.ts`). Create a new `{domain}.commands.ts` if needed:

```typescript
// src/app/application/commands/foo.commands.ts

import { CommandHandler, ICommandHandler } from "@nestjs/cqrs";

// ─────────────────────────────────────────────────────────────
// CreateFoo
// ─────────────────────────────────────────────────────────────

export interface ICreateFooCommand {
    name: string;
}

export class CreateFooCommand {
    constructor(private readonly parameters: ICreateFooCommand) {}
    get name(): string { return this.parameters.name; }
}

@CommandHandler(CreateFooCommand)
export class CreateFooHandler implements ICommandHandler<CreateFooCommand, CreateFooResult> {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly fooRepository: IFooRepository,
    ) {}

    async execute(command: CreateFooCommand): Promise<CreateFooResult> {
        // 1. Build entity and validate invariants
        const foo = new Foo({ name: command.name });
        foo.validate();
        // 2. Business logic + persist
        const persistedFoo = await this.fooRepository.create(foo);
        // 3. Return result
        return new CreateFooResult({ id: persistedFoo.id, name: persistedFoo.name });
    }
}

// ─────────────────────────────────────────────────────────────
// DeleteFoo (additional commands go in the same file)
// ─────────────────────────────────────────────────────────────
// ...
```

Existing domain files:
- `role.commands.ts` — CreateRole, AssignRoleToUser, RemoveRoleFromUser
- `user.commands.ts` — RegisterUser

2. **Add Request/Response DTOs** to the domain's DTO file `src/app/api/dtos/{domain}.dtos.ts` (e.g., `foo.dtos.ts`):

```typescript
// In foo.dtos.ts — add a new section with divider comment

// ─────────────────────────────────────────────────────────────
// CreateFoo
// ─────────────────────────────────────────────────────────────

export class CreateFooRequestDto {
    @ApiProperty({ description: '...', example: '...' })
    @IsNotEmpty()
    @IsString()
    name: string;
}

export class CreateFooResponseDto {
    @ApiProperty({ ... })
    id: string;

    @ApiProperty({ ... })
    name: string;
}
```

Existing domain DTO files:
- `role.dtos.ts` — CreateRole, ListRoles, AssignRole, GetUserRoles, RemoveUserRole
- `user.dtos.ts` — RegisterUser, GetUserById

3. **Add Mapper** to the domain's mapper file `src/app/application/mappers/{domain}.mappers.ts` (e.g., `foo.mappers.ts`). Multiple mappers live in the same file, separated by section dividers:

```typescript
// In foo.mappers.ts — add a new section with divider comment

// ─────────────────────────────────────────────────────────────
// CreateFoo
// ─────────────────────────────────────────────────────────────

export class CreateFooMapper {
    static toCommand(dto: CreateFooRequestDto): CreateFooCommand {
        return new CreateFooCommand(dto);
    }
    static toResponseDto(result: CreateFooResult): CreateFooResponseDto {
        return { id: result.id, name: result.name };
    }
}
```

Existing domain mapper files:
- `role.mappers.ts` — CreateRole, AssignRoleToUser, ListRoles, GetUserRoles, RemoveRoleFromUser
- `user.mappers.ts` — RegisterUser, GetUserById

4. **Create Result** in `src/app/domain/results/`:

```typescript
export class CreateFooResult {
    readonly id: string;
    readonly name: string;
    constructor(params: { id: string; name: string }) {
        this.id = params.id;
        this.name = params.name;
    }
}
```

5. **Add endpoint to Controller**:

```typescript
@Post()
@ApiEndpoint({
    summary: 'Create a foo',
    body: CreateFooRequestDto,
    response: { status: 201, type: CreateFooResponseDto, description: 'Foo created' },
    errors: [{ status: 400, description: 'Invalid payload' }],
})
async createFoo(@Body() dto: CreateFooRequestDto): Promise<CreateFooResponseDto> {
    const command = CreateFooMapper.toCommand(dto);
    try {
        const result = await this.commandBus.execute(command);
        return CreateFooMapper.toResponseDto(result);
    } catch (error) {
        if (error instanceof EntityError) {
            throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
        }
        if (error instanceof ApiError) {
            throw new HttpException(error.message, error.statusCode);
        }
        throw new HttpException("Internal server error", HttpStatus.INTERNAL_SERVER_ERROR);
    }
}
```

6. **Register in `application.module.ts`**:

```typescript
import { CreateFooHandler } from '@application/commands/foo.commands';
// ...
providers: [CreateFooHandler, ...],
controllers: [FooController, ...],
```

### Adding a new Query (read operation)

Same grouped pattern but use `@QueryHandler`, `IQueryHandler`, `QueryBus`, and place in `src/app/application/queries/{domain}.queries.ts`.

Existing domain files:
- `role.queries.ts` — ListRoles, GetUserRoles
- `user.queries.ts` — GetUserById

---

## Cache Layer (Redis + CachingQueryBus)

### Architecture

```
Controller (query)
  → CachingQueryBus.execute(query)       // checks cache first
    → cache HIT  → return cached result
    → cache MISS → QueryBus.execute()    → store in cache → return

Controller (command)
  → CommandBus.execute(command)
    → Handler executes mutation
    → Handler calls cacheService.del/delByPattern()  // manual invalidation
```

### Key files

| File | Purpose |
|------|---------|
| `src/app/domain/ports/cache-service.port.ts` | `ICacheService` abstract class (port) |
| `src/app/infrastructure/services/redis-cache.service.ts` | `RedisCacheService` (ioredis implementation) |
| `src/app/infrastructure/cache/cache-config.registry.ts` | `CACHE_REGISTRY` + domain cache key constants (`RoleCacheKeys`, `UserRoleCacheKeys`, etc.) |
| `src/app/infrastructure/cache/caching-query-bus.service.ts` | `CachingQueryBus` — wraps QueryBus with cache |
| `src/configuration/redis/` | Redis config (host, port, defaultTtl) |

### Adding cache to a new domain

1. **Define cache key constants** in `cache-config.registry.ts`. All key strings for a domain live here — both for reads (registry) and writes (invalidation):

```typescript
export const FooCacheKeys = {
    byId: (id: string) => `foo:${id}`,
    list: () => 'foo:list',
    pattern: () => 'foo:*',
};
```

2. **Add entries to `CACHE_REGISTRY`** referencing those constants:

```typescript
CACHE_REGISTRY.set('GetFooByIdQuery', { ttl: 60, key: (q) => FooCacheKeys.byId(q.id) });
CACHE_REGISTRY.set('ListFooQuery', { ttl: 300, key: () => FooCacheKeys.list() });
```

3. No changes needed in the controller or handler — `CachingQueryBus` handles it automatically.

### Invalidating cache from a command

**ALWAYS invalidate relevant cache keys in command handlers that mutate cached data.** Use the same cache key constants from `cache-config.registry.ts` — never hardcode key strings in handlers.

```typescript
import { FooCacheKeys } from '@infrastructure/cache/cache-config.registry';

// In command handler constructor:
private readonly cacheService: ICacheService,

// After mutation:
await this.cacheService.del(FooCacheKeys.byId(id));           // single key
await this.cacheService.delByPattern(FooCacheKeys.pattern());  // pattern
```

### Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_HOST` | `127.0.0.1` | Redis host |
| `REDIS_PORT` | `6379` | Redis port |
| `REDIS_DEFAULT_TTL` | `300` | Default TTL in seconds |

### Testing

In e2e tests, provide a no-op mock for `ICacheService` (get returns null, set/del are no-ops) and register `CachingQueryBus` as a provider. This makes the cache transparent — all queries pass through to the real database.

---

## Messaging Layer (RabbitMQ)

### Architecture

The app runs as a **hybrid** NestJS application: HTTP server + RabbitMQ microservice consumer in the same process.

```
Producer side (publish):
  Command Handler (after mutation)
    → IMessageBroker.publish(queue, payload)           // direct queue
    → IMessageBroker.publishToTopic(exchange, key, payload)  // topic exchange

Consumer side (subscribe):
  RabbitMQ Queue
    → @MessagePattern(Queues.XXX) handler              // direct queue consumer
    → @EventPattern('routing.key') handler             // topic subscriber
    → ack() on success / nack(requeue) on failure
```

### Key files

| File | Purpose |
|------|---------|
| `src/app/domain/ports/message-broker.port.ts` | `IMessageBroker` abstract class (port) |
| `src/app/infrastructure/messaging/rabbitmq.service.ts` | `RabbitmqService` (amqplib implementation) |
| `src/app/infrastructure/messaging/messaging.registry.ts` | `Queues` + `Topics` — single source of truth for queue names and exchanges |
| `src/app/application/consumers/` | Message consumer handlers |
| `src/configuration/rabbitmq/` | RabbitMQ config (host, port, user, password, prefetch) |

### Adding a new queue consumer

1. **Add queue name** to `messaging.registry.ts`:

```typescript
export const Queues = {
    PAYMENT_PROCESSING: 'payment-processing',
    MY_NEW_QUEUE: 'my-new-queue',
};
```

2. **Create consumer** in `src/app/application/consumers/`:

```typescript
@Controller()
export class MyConsumer {
    constructor(@Inject(Logger) private readonly logger: Logger) {}

    @MessagePattern(Queues.MY_NEW_QUEUE)
    async handle(@Payload() data: unknown, @Ctx() context: RmqContext): Promise<void> {
        const channel = context.getChannelRef();
        const originalMsg = context.getMessage();
        try {
            // process message
            channel.ack(originalMsg);
        } catch (error) {
            this.logger.error(`Failed: ${error}`);
            channel.nack(originalMsg, false, true);  // requeue
        }
    }
}
```

3. **Register consumer** in `application.module.ts` controllers array.

4. **Register queue** in `main.ts` `connectMicroservice()` if it needs its own transport (or use the existing one).

### Publishing messages from command handlers

```typescript
// Inject the port
private readonly messageBroker: IMessageBroker,

// Publish to a direct queue
await this.messageBroker.publish(Queues.PAYMENT_PROCESSING, { orderId, amount });

// Publish to a topic exchange
await this.messageBroker.publishToTopic(
    Topics.USER_EVENTS.exchange,
    Topics.USER_EVENTS.routingKeys.CREATED,
    { userId, email },
);
```

### Topic subscriptions (pub/sub)

1. **Add topic config** to `messaging.registry.ts`:

```typescript
export const Topics = {
    ORDER_EVENTS: {
        exchange: 'order-events',
        routingKeys: {
            CREATED: 'order.created',
            COMPLETED: 'order.completed',
        },
    },
};
```

2. **Subscribe** with `@EventPattern()` in a consumer:

```typescript
@EventPattern(Topics.ORDER_EVENTS.routingKeys.CREATED)
async handleOrderCreated(@Payload() data: unknown, @Ctx() context: RmqContext): Promise<void> {
    context.getChannelRef().ack(context.getMessage());
    // process event
}
```

### Retry strategy

- `noAck: false` — messages are not lost until explicit `ack()`
- On failure: `nack(msg, false, true)` → message requeued for retry
- `prefetchCount` controls concurrent processing (default 10, via `RABBITMQ_PREFETCH`)
- Dead Letter Exchange (DLX) can be configured per queue via `x-dead-letter-exchange` in queue options

### Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `RABBITMQ_HOST` | `127.0.0.1` | RabbitMQ host |
| `RABBITMQ_PORT` | `5672` | RabbitMQ port |
| `RABBITMQ_USER` | `guest` | RabbitMQ user |
| `RABBITMQ_PASSWORD` | `guest` | RabbitMQ password |
| `RABBITMQ_VHOST` | `/` | RabbitMQ virtual host |
| `RABBITMQ_PREFETCH` | `10` | Max concurrent messages per consumer |
| `RABBITMQ_RETRY_ATTEMPTS` | `3` | Retry attempts |
| `RABBITMQ_RETRY_DELAY` | `5000` | Retry delay in ms |

### Testing

In e2e tests, provide a no-op mock for `IMessageBroker` (publish/publishToTopic are no-ops). This avoids needing a RabbitMQ instance in tests.

---

## Domain Layer Conventions

### Entities

- Extend `BaseAuditEntity` (provides `createdAt`, `updatedAt`)
- Implement `IValidable` interface from `@domain/types/validable.type`
- Use `@Entity('table_name')` decorator
- Constructor takes `Partial<Entity>` and uses `Object.assign`
- **Every entity must implement a `validate()` method** that checks invariants and throws `EntityError` on invalid state
- `validate()` delegates to value objects for field-level validation and applies their normalized values back to the entity
- `validate()` is NOT called in the constructor (TypeORM hydrates entities via constructor too). It must be called explicitly in command handlers before persisting
- Business methods live on the entity (e.g., `user.markAsActive(emailId)`)
- **ALWAYS declare TypeORM relations** (`@ManyToOne`, `@OneToMany`, `@ManyToMany`) between entities. Do NOT create entities with bare FK columns without relation decorators unless explicitly requested. Keep both the FK column (for direct queries) and the relation decorator (for joins and metadata).
- For join entities (e.g., `UserRole`), use `@ManyToOne` on the join entity and `@OneToMany` on each parent entity
- When an entity has relations, **all related entities must be registered** in `TypeOrmModule.forFeature([...])` and in test `entities` arrays

```typescript
@Entity('users')
export class User extends BaseAuditEntity implements IValidable {
    constructor(data: Partial<User>) {
        super();
        Object.assign(this, data);
    }
    @PrimaryGeneratedColumn('uuid') id: string;
    @Column('varchar', { nullable: false }) name: string;
    @Column('varchar', { nullable: false, unique: true }) email: string;
    // ...

    @OneToMany(() => UserRole, (userRole) => userRole.user)
    userRoles: UserRole[];

    validate(): void {
        const name = new NameValueObject(this.name);
        const email = new EmailValueObject(this.email);
        this.name = name.value;
        this.email = email.value;
    }

    markAsActive(welcomeEmailId: string): void {
        this.status = UserStatus.ACTIVE;
        this.welcomeEmailId = welcomeEmailId;
    }
}

// Join entity — validate required FK fields directly with EntityError
@Entity('user_roles')
export class UserRole extends BaseAuditEntity implements IValidable {
    @Column('uuid', { nullable: false })
    userId: string;

    @ManyToOne(() => User, (user) => user.userRoles, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'userId' })
    user: User;

    @Column('uuid', { nullable: false })
    roleId: string;

    @ManyToOne(() => Role, (role) => role.userRoles, { onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'roleId' })
    role: Role;

    validate(): void {
        if (!this.userId) throw new EntityError('userId is required', 'userId');
        if (!this.roleId) throw new EntityError('roleId is required', 'roleId');
    }
}
```

### Entity validation flow in command handlers

Command handlers build the entity, call `validate()`, then persist:

```typescript
// 1. Build entity and validate invariants
const user = new User({ name: command.name, email: command.email, status: UserStatus.PENDING });
user.validate();  // throws EntityError if invalid, normalizes values

// 2. Business rules (uniqueness, etc.)
const existing = await this.userRepository.findByEmail(user.email);
if (existing) throw new ApiError(HttpStatus.CONFLICT, '...');

// 3. Persist
const persistedUser = await this.userRepository.create(user);
```

### Value Objects

- Immutable, validate on construction
- Throw `EntityError` on invalid data
- Located in `src/app/domain/value-objects/`

```typescript
export class EmailValueObject {
    constructor(public readonly value: string) {
        this.value = value.toLowerCase().trim();
        this.validate();
    }
    private validate(): void {
        if (!this.value) throw new EntityError('Email is required');
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.value))
            throw new EntityError('Email format is invalid', 'email');
    }
}
```

### Ports (Dependency Inversion)

- Use **abstract classes** (not interfaces) as DI tokens
- Located in `src/app/domain/ports/`
- Bound to implementations in `infrastructure.module.ts`

```typescript
// Port
export abstract class IUserRepository {
    abstract create(data: User): Promise<User>;
    abstract findByEmail(email: string): Promise<User | null>;
}

// Binding in infrastructure.module.ts
{ provide: IUserRepository, useClass: UserRepository }
```

### Error Hierarchy

All custom errors in `src/app/domain/errors/`:

| Error | Usage | HTTP mapping |
|-------|-------|-------------|
| `ApiError(statusCode, message, data?)` | Business rule violations with specific HTTP status | Maps directly to `statusCode` |
| `EntityError(message, field?)` | Value object / entity validation failures | Maps to 400 |
| `RepositoryError(message, error, data?)` | Database operation failures | Maps to 500 |
| `ProviderError(message)` | External service failures | Maps to 500 |
| `RetryError(message)` | Retry/timeout exhaustion | Maps to 500 |

The global `HttpExceptionFilter` catches all exceptions and returns:

```json
{
    "StatusCode": 409,
    "ErrorCode": "TR999",
    "ErrorDescription": "User with email x@y.com already exists"
}
```

---

## Controller Conventions

### Error handling pattern

Every controller method follows this try/catch pattern:

```typescript
try {
    const result = await this.commandBus.execute(command);
    return Mapper.toResponseDto(result);
} catch (error) {
    if (error instanceof EntityError) {
        throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
    if (error instanceof ApiError) {
        throw new HttpException(error.message, error.statusCode);
    }
    this.logger.error(`Error: ${error}`);
    throw new HttpException("Internal server error", HttpStatus.INTERNAL_SERVER_ERROR);
}
```

### Swagger documentation

Use the `@ApiEndpoint` decorator from `@swagger/api-endpoint.decorator`:

```typescript
@ApiEndpoint({
    summary: 'Short description',
    body: RequestDto,          // optional, for POST/PUT
    response: { status: 200, type: ResponseDto, description: '...' },
    errors: [
        { status: 400, description: 'Validation error' },
        { status: 404, description: 'Not found' },
    ],
})
```

### DTO conventions

- **Request DTOs**: Use `class-validator` decorators + `@ApiProperty`
- **Response DTOs**: Use `@ApiProperty` only (no validation)
- **Grouped by domain**: `{domain}.dtos.ts` (e.g., `role.dtos.ts`, `user.dtos.ts`)
- Each operation section separated by divider comments
- Whitelist is ON: extra fields are rejected (400)

---

## Infrastructure Layer

### Repository pattern

- Implement the abstract port class
- Use `@InjectRepository(Entity)` for TypeORM repository
- Wrap all operations in try/catch, throw `RepositoryError` on failure
- Inject `Logger` for structured logging

### Services (external integrations)

- Implement an abstract port class
- Located in `src/app/infrastructure/services/`
- Available services: `NotificationService`, `RedisCacheService`, `HttpService`, `RetryService`, `TransactionManagerService`

---

## Configuration

### Environment variables

Copy `.env.example` to `.env`. Key variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `APP_NAME` | `nestjs-boilerplate` | Application name |
| `NODE_ENV` | `development` | Environment |
| `APP_PORT` | `3000` | HTTP port |
| `APP_LOG_LEVEL` | `info` | Pino log level |
| `DB_HOST` | `127.0.0.1` | Postgres host |
| `DB_PORT` | `5432` | Postgres port |
| `DB_USERNAME` | `postgres` | Postgres user |
| `DB_PASSWORD` | `secret` | Postgres password |
| `DB_DATABASE` | `boilerplate` | Database name |
| `DB_SYNCHRONIZE` | `false` | Auto-sync schema (never in prod) |
| `REDIS_HOST` | `127.0.0.1` | Redis host |
| `REDIS_PORT` | `6379` | Redis port |
| `REDIS_DEFAULT_TTL` | `300` | Default cache TTL in seconds |
| `RABBITMQ_HOST` | `127.0.0.1` | RabbitMQ host |
| `RABBITMQ_PORT` | `5672` | RabbitMQ port |
| `RABBITMQ_USER` | `guest` | RabbitMQ user |
| `RABBITMQ_PASSWORD` | `guest` | RabbitMQ password |
| `RABBITMQ_VHOST` | `/` | RabbitMQ virtual host |
| `RABBITMQ_PREFETCH` | `10` | Max concurrent messages per consumer |
| `RABBITMQ_RETRY_ATTEMPTS` | `3` | Retry attempts |
| `RABBITMQ_RETRY_DELAY` | `5000` | Retry delay in ms |

### Path Aliases (tsconfig.json)

| Alias | Maps to | Usage |
|-------|---------|-------|
| `@app/*` | `src/app/*` | Base app imports |
| `@api/*` | `src/app/api/*` | Controllers, DTOs |
| `@domain/*` | `src/app/domain/*` | Entities, ports, errors, VOs |
| `@application/*` | `src/app/application/*` | Commands, queries, mappers |
| `@infrastructure/*` | `src/app/infrastructure/*` | Repositories, services |
| `@config/*` | `src/configuration/*` | Config modules |
| `@common/*` | `src/common/*` | Pipes, filters, decorators |
| `@health/*` | `src/health/*` | Health module |
| `@swagger/*` | `src/swagger/*` | Swagger utilities |

**IMPORTANT**: Always use path aliases instead of relative imports with `.js` extensions. Jest does not resolve `.js` extensions in `ts-jest`. The `jest-e2e.json` mirrors all aliases in `moduleNameMapper`.

---

## Migrations

Migrations are in `src/migrations/` using raw SQL for full control.

```bash
# Create a new empty migration
npm run migration:create --name=add-foo-table

# Run pending migrations
npm run migration:run

# Run in production (against compiled JS)
npm run migration:run:prod
```

Migration file pattern:

```typescript
import { MigrationInterface, QueryRunner } from "typeorm";

export class AddFooTable1234567890 implements MigrationInterface {
    name = 'AddFooTable1234567890'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "foo" (
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "name" character varying NOT NULL,
                CONSTRAINT "PK_foo_id" PRIMARY KEY ("id")
            )
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "foo"`);
    }
}
```

---

## Testing

### Philosophy

- **Integration tests only through endpoints** — no direct DB access (`dataSource.getRepository()`)
- **Real Postgres** via Testcontainers (ephemeral Docker container)
- **Mock only external services** (email, external APIs) — never mock repositories
- **Verify via API**: Create via POST, verify via GET, confirm conflict via duplicate POST

### Test structure

```
test/
├── setup/
│   └── jest-setup.ts           # Polyfills (crypto, File for Node 18 compat)
├── helpers/
│   ├── test-app.helper.ts      # createTestApp() — spins up NestJS + Testcontainer
│   └── db.helper.ts            # cleanDatabase() — TRUNCATE all tables between tests
├── factories/
│   └── user.factory.ts         # buildRegisterUserDto() — unique data per call
└── modules/
    └── users/
        └── register-user.e2e-spec.ts
```

### Running tests

```bash
# Requires Docker running
npm run test:e2e

# Run specific test file
npm run test:e2e -- --testPathPattern=register-user
```

### Writing a new e2e test

1. **Create factory** in `test/factories/`:

```typescript
export function buildCreateFooDto(overrides?: Partial<{ name: string }>): { name: string } {
    return {
        name: 'Default Name',
        ...overrides,
    };
}
```

2. **Create test file** in `test/modules/{feature}/`:

```typescript
import { INestApplication, HttpStatus } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { StartedPostgreSqlContainer } from '@testcontainers/postgresql';

import { FooEntity } from '../../../src/app/domain/entities/foo.entity';
import { IFooRepository } from '../../../src/app/domain/ports/foo-repository.port';
import { FooRepository } from '../../../src/app/infrastructure/persistence/foo.repository';
import { CreateFooHandler } from '../../../src/app/application/commands/foo.commands';
import { FooController } from '../../../src/app/api/controllers/foo.controller';
import { createTestApp, TestContext } from '../../helpers/test-app.helper';
import { cleanDatabase } from '../../helpers/db.helper';
import { buildCreateFooDto } from '../../factories/foo.factory';

describe('Create Foo (e2e)', () => {
    let app: INestApplication;
    let dataSource: DataSource;
    let pgContainer: StartedPostgreSqlContainer;

    // Mock only external services
    const mockExternalService = {
        someMethod: jest.fn().mockResolvedValue({ ... }),
    };

    beforeAll(async () => {
        const ctx: TestContext = await createTestApp({
            entities: [FooEntity],
            controllers: [FooController],
            providers: [
                CreateFooHandler,
                { provide: IFooRepository, useClass: FooRepository },
                { provide: IExternalService, useValue: mockExternalService },
            ],
        });
        app = ctx.app;
        dataSource = ctx.dataSource;
        pgContainer = ctx.pgContainer;
    }, 60_000);

    afterEach(async () => {
        await cleanDatabase(dataSource);
        jest.clearAllMocks();
    });

    afterAll(async () => {
        await app.close();
        await pgContainer.stop();
    });

    // Helper functions (NOT async — return supertest chain)
    function createFoo(dto: { name: string }) {
        return request(app.getHttpServer()).post('/foo').send(dto);
    }

    function getFooById(id: string) {
        return request(app.getHttpServer()).get(`/foo/${id}`);
    }

    it('should create and retrieve a foo', async () => {
        const dto = buildCreateFooDto();
        const { body: created } = await createFoo(dto).expect(HttpStatus.CREATED);
        expect(created.name).toBe(dto.name);

        const { body: fetched } = await getFooById(created.id).expect(HttpStatus.OK);
        expect(fetched.name).toBe(dto.name);
    });
});
```

### Key test patterns

- **Helper functions must NOT be `async`** — return the supertest `Test` object directly so `.expect()` chains work
- **`beforeAll` timeout**: Set to `60_000` (testcontainer startup)
- **`afterEach`**: `cleanDatabase()` + `jest.clearAllMocks()`
- **Import style**: `import request from 'supertest'` (default import, NOT `import * as`)
- **Use relative imports** in test files (no path aliases): `../../../src/app/domain/...`
- **`createTestApp`** composes the NestJS module manually (does NOT import `ApplicationModule`) to avoid loading real DB config

### Test setup polyfills (test/setup/jest-setup.ts)

Required when running on Node < 20:
- `crypto` global polyfill (for `uuid`)
- `File` global polyfill (for `undici` used by testcontainers)

---

## Docker

### Development

```bash
docker compose up
```

Uses multi-stage Dockerfile:
- `dev`: Full source with `npm install`, mounts volumes
- `build`: Compiles TypeScript
- `prod`: Minimal image with only `dist/` + production deps

### Environment for Docker

The `docker-compose.yml` overrides `DB_HOST=database` and `REDIS_HOST=redis` to point to the respective containers. Variables `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` are read from `.env`.

---

## Adding a New Feature (Checklist)

1. [ ] Entity in `src/app/domain/entities/` (implement `IValidable` with `validate()` method)
2. [ ] Value objects in `src/app/domain/value-objects/` (if needed)
3. [ ] Port (abstract class) in `src/app/domain/ports/`
4. [ ] Result in `src/app/domain/results/`
5. [ ] Repository implementation in `src/app/infrastructure/persistence/`
6. [ ] Bind port -> impl in `infrastructure.module.ts`
7. [ ] Register entity in `TypeOrmModule.forFeature([...])` in `infrastructure.module.ts`
8. [ ] Command/Query + Handler in `src/app/application/commands/{domain}.commands.ts` or `queries/{domain}.queries.ts`
9. [ ] Mapper in `src/app/application/mappers/{domain}.mappers.ts`
10. [ ] Request/Response DTOs in `src/app/api/dtos/{domain}.dtos.ts`
11. [ ] Controller endpoint in `src/app/api/controllers/`
12. [ ] Register handler in `application.module.ts` providers
13. [ ] Register controller in `application.module.ts` controllers
14. [ ] Migration in `src/migrations/`
15. [ ] Factory in `test/factories/`
16. [ ] E2E test in `test/modules/{feature}/`

---

## Code Style

- **ESLint** + **Prettier** enforced
- Single quotes, trailing commas, semicolons
- Max line length: 250
- `noUnusedLocals` and `noUnusedParameters` are ON
- No `console.log` — use injected `Logger` from `nestjs-pino`
- Strict TypeScript: `strict`, `noImplicitAny`, `strictNullChecks`

## Active Technologies
- TypeScript 5.7+ (strict mode) on Node.js >= 22 + NestJS 11, @nestjs/cqrs 11, TypeORM 0.3, class-validator, class-transformer, nestjs-pino (001-user-roles)
- PostgreSQL 16 via TypeORM (raw SQL migrations, `synchronize: false`) (001-user-roles)
- Redis 7 via ioredis with CachingQueryBus wrapper pattern (001-user-roles)
- RabbitMQ 3.13 via amqplib + @nestjs/microservices (hybrid HTTP + RMQ app, IMessageBroker port, queue/topic registry)
- TypeScript 5.7+ (strict mode) on Node.js >= 22 + NestJS 11, @nestjs/cqrs 11, TypeORM 0.3, class-validator, class-transformer, nestjs-pino, ioredis (002-hydro-reference-data)
- PostgreSQL 16 via TypeORM (raw SQL migrations, `synchronize: false`), Redis 7 for cache (002-hydro-reference-data)
- TypeScript 5.7+ on Node.js >= 22 + NestJS 11, @nestjs/cqrs 11, TypeORM 0.3, class-validator, nestjs-pino, ioredis (003-geoserver-sync)
- PostgreSQL 16 (primary: hydro-api DB), PostgreSQL 17 + PostGIS (secondary: GeoServer DB, read-only) (003-geoserver-sync)
- TypeScript 5.7+ (strict) on Node.js >= 22 + NestJS 11, @nestjs/cqrs 11, @nestjs/schedule 4, TypeORM 0.3, class-validator, class-transformer, nestjs-pino, ioredis, pg, axios, swagger (001-meteo-ingest)
- PostgreSQL 16 (own database `ms_meteo` on `infra-db-meteo`) for the audit table; Redis 7 (existing `infra-redis`) for short-lived caching of metadata responses (001-meteo-ingest)
- TypeScript 5.7+ on Node.js >= 22 + NestJS 11, @nestjs/cqrs 11, TypeORM 0.3, GDAL CLI (gdal_translate, gdalinfo) (002-precip-aggregation)
- PostgreSQL 16 (audit table only — no new migrations), GeoServer ImageMosaic (raster files), filesystem (002-precip-aggregation)

## Recent Changes
- 001-user-roles: Added Role entity, UserRole join entity, role CRUD + user-role assignment/removal endpoints
- 001-user-roles: Refactored commands/queries to grouped-by-domain pattern (`role.commands.ts`, `user.commands.ts`, `role.queries.ts`, `user.queries.ts`)
- 001-user-roles: Grouped DTOs by domain (`role.dtos.ts`, `user.dtos.ts`)
- 001-user-roles: Removed test entity boilerplate; User and Role are now the reference examples
- 001-user-roles: Added Redis cache layer with CachingQueryBus wrapper, ICacheService port, cache registry, ioredis
- 001-user-roles: Added TypeScript 5.7+ (strict mode) on Node.js >= 22 + NestJS 11, @nestjs/cqrs 11, TypeORM 0.3, class-validator, class-transformer, nestjs-pino
- microservice: Added RabbitMQ messaging layer — IMessageBroker port, RabbitmqService adapter, messaging.registry.ts, hybrid bootstrap, example consumer
- microservice: Grouped mappers by domain (role.mappers.ts, user.mappers.ts), added entity validate() pattern, centralized cache keys
- aerial-precipitation: ingest FEWS areal precipitation JSONs from SFTP + query endpoints (list, latest, by-location); see .specify/specs/aerial-precipitation/
