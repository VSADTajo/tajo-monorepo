# NestJS Service Conventions

All backend services in this monorepo (except `ms-logs-api`, which is Express + Mongoose) follow this layout. The canonical reference is `ms-gateway-api/`.

## Architecture: Hexagonal + CQRS (4 layers)

```
src/
├── main.ts                            # Bootstrap: pipes, filters, swagger, helmet, cors
├── app.module.ts                      # Root module
├── admin.ts                           # AdminJS panel (dev only)
│
├── app/
│   ├── api/                           # INPUT ADAPTER (HTTP)
│   │   ├── controllers/
│   │   ├── dtos/                      # Grouped by domain: <domain>.dtos.ts
│   │   └── docs/
│   │
│   ├── application/                   # USE CASES (orchestration)
│   │   ├── commands/                  # <domain>.commands.ts
│   │   ├── queries/                   # <domain>.queries.ts
│   │   ├── mappers/                   # <domain>.mappers.ts
│   │   ├── consumers/                 # @MessagePattern / @EventPattern handlers
│   │   └── application.module.ts
│   │
│   ├── domain/                        # BUSINESS LOGIC (zero framework deps)
│   │   ├── entities/                  # TypeORM entities
│   │   ├── value-objects/             # Immutable validated types
│   │   ├── ports/                     # Abstract classes (DI tokens)
│   │   ├── errors/                    # Domain error hierarchy
│   │   ├── results/                   # Command/Query result DTOs
│   │   └── types/                     # Shared abstract types
│   │
│   └── infrastructure/                # OUTPUT ADAPTERS
│       ├── cache/                     # CachingQueryBus + cache config registry
│       ├── messaging/                 # RabbitMQ service + messaging.registry.ts
│       ├── persistence/               # TypeORM repositories
│       ├── services/                  # NotificationService, HttpService, RetryService, ...
│       └── infrastructure.module.ts   # Binds ports to implementations
│
├── common/                            # Cross-cutting (exception filter, pipes, decorators)
├── configuration/                     # @nestjs/config modules (app, postgres, redis, rabbitmq)
├── health/                            # /health endpoint (Terminus)
├── swagger/                           # Swagger setup + @ApiEndpoint decorator
└── migrations/                        # TypeORM migrations (raw SQL)
```

## Layer Rules (NON-NEGOTIABLE)

1. **api/** only: extract headers, decode request, validate DTO, build Command/Query via Mapper, call `commandBus.execute` / `queryBus.execute`, map result to response DTO.
2. **application/** orchestrates by calling ports. Handlers do NOT contain business rules — those live on entities and value objects.
3. **domain/ports/** are **abstract classes** (not interfaces) so they can serve as NestJS DI tokens.
4. **domain/** has zero framework deps. NO imports from `infrastructure/` or `api/`.
5. **infrastructure/** implements ports. Wraps DB/HTTP operations in `try/catch` and throws `RepositoryError`/`ProviderError`.
6. Controllers MUST NOT inject use cases, repositories, or services directly.

## CQRS Flow

```
Controller → Mapper.toCommand(dto) → CommandBus.execute(command)
                                       │
                                  CommandHandler  ← @CommandHandler(Command)
                                       │
                                  Port (abstract class) ← injected
                                       │
                                  Repository (implementation)
                                       │
                                  Result → Mapper.toResponseDto → Response
```

Reads use `CachingQueryBus` (wraps `QueryBus`) and check Redis transparently before hitting the handler.

## Engine vs CQRS

This monorepo uses **CQRS via @nestjs/cqrs**. There is no separate "Engine" layer — orchestration lives in command/query handlers.

## Entity Pattern

- Extend `BaseAuditEntity` (provides `createdAt`, `updatedAt`).
- Implement `IValidable` from `@domain/types/validable.type`.
- `@Entity('table_name')` decorator.
- Constructor takes `Partial<Entity>` and uses `Object.assign(this, data)`.
- **Every entity MUST implement `validate()`** that enforces invariants and throws `EntityError`. Called explicitly by the handler before persisting — NOT in the constructor (TypeORM hydration would trigger it).
- Business methods live on the entity (`user.markAsActive(emailId)`).
- TypeORM relations (`@ManyToOne`, `@OneToMany`, `@ManyToMany`) MUST be declared alongside FK columns.
- All related entities MUST be registered in `TypeOrmModule.forFeature([...])` of `infrastructure.module.ts` AND in test `entities` arrays.

## Ports (Dependency Inversion)

```typescript
// src/app/domain/ports/foo-repository.port.ts
export abstract class IFooRepository {
    abstract create(data: Foo): Promise<Foo>;
    abstract findById(id: string): Promise<Foo | null>;
}

// src/app/infrastructure/infrastructure.module.ts
{ provide: IFooRepository, useClass: FooRepository }
```

## Error Hierarchy (NON-NEGOTIABLE)

| Error | Usage | HTTP |
|-------|-------|------|
| `ApiError(statusCode, message, data?)` | Business rule violation with specific status | as specified |
| `EntityError(message, field?)` | Value object / entity validation failure | 400 |
| `RepositoryError(message, error, data?)` | DB operation failure | 500 |
| `ProviderError(message)` | External service failure | 500 |
| `RetryError(message)` | Retry/timeout exhaustion | 500 |

Global `HttpExceptionFilter` returns `{ StatusCode, ErrorCode, ErrorDescription }`.

Controller try/catch pattern (mandatory):
```typescript
try {
    const result = await this.commandBus.execute(command);
    return Mapper.toResponseDto(result);
} catch (error) {
    if (error instanceof EntityError) throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    if (error instanceof ApiError)    throw new HttpException(error.message, error.statusCode);
    this.logger.error(`Error: ${error}`);
    throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
}
```

## Cache (Redis + CachingQueryBus)

- Cache keys live in `src/app/infrastructure/cache/cache-config.registry.ts` (key constants + `CACHE_REGISTRY` mapping query name → `{ ttl, key(q) }`).
- Reads: `CachingQueryBus` checks cache automatically — no handler changes.
- Writes: command handlers MUST invalidate manually via `ICacheService.del(<key>)` or `delByPattern(<pattern>)`. Use the constants from the registry, never hardcoded strings.

## Messaging (RabbitMQ)

- Queue and topic names live in `src/app/infrastructure/messaging/messaging.registry.ts`.
- Publish via the `IMessageBroker` port: `publish(queue, payload)` or `publishToTopic(exchange, routingKey, payload)`.
- Consume with `@MessagePattern(Queues.X)` (direct) or `@EventPattern('x.y')` (topic). MUST `ack()` on success, `nack(msg, false, true)` on failure (requeue).
- Each service is a hybrid app: HTTP + RabbitMQ in the same process (`main.ts` calls `connectMicroservice()`).

## Path Aliases (tsconfig + jest-e2e.json)

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

ALWAYS use aliases in `src/`. Inside `test/`, use relative imports.

## Migrations

```bash
npm run migration:create --name=add-foo-table       # creates empty file in src/migrations/
npm run migration:run                               # apply pending
npm run migration:run:prod                          # against compiled JS
npm run migration:revert
```

Use raw SQL in the `up`/`down` methods. `synchronize` MUST be `false`.

## NestJS Conventions

- DI is constructor-based with `@Inject(Logger)` for the pino logger.
- No `console.log`. Logger from `nestjs-pino`, always.
- `class-validator` decorators on every request DTO field, `@ApiProperty` on every DTO field (request + response).
- `whitelist: true` + `forbidNonWhitelisted: true` on the global validation pipe.
- Every controller endpoint uses the `@ApiEndpoint` decorator.
- TypeScript strict mode: `strict`, `noImplicitAny`, `strictNullChecks`, `noUnusedLocals`, `noUnusedParameters`.

## Canonical npm Scripts

```bash
npm run build                  # nest build
npm run start:dev              # watch mode
npm run start:prod             # node dist/src/main
npm run test                   # unit
npm run test:e2e               # integration (requires Docker)
npm run lint                   # eslint --fix
npm run format                 # prettier
npm run migration:run
npm run migration:create --name=...
```

## Adding a New Feature (Checklist)

1. Entity in `src/app/domain/entities/` (with `validate()`).
2. Value objects in `src/app/domain/value-objects/` if needed.
3. Port (abstract class) in `src/app/domain/ports/`.
4. Result in `src/app/domain/results/`.
5. Repository in `src/app/infrastructure/persistence/`.
6. Bind port → impl in `infrastructure.module.ts`.
7. Register entity in `TypeOrmModule.forFeature([...])`.
8. Command/Query + Handler in `src/app/application/{commands|queries}/<domain>.<commands|queries>.ts`.
9. Mapper in `src/app/application/mappers/<domain>.mappers.ts`.
10. Request/Response DTOs in `src/app/api/dtos/<domain>.dtos.ts`.
11. Controller endpoint in `src/app/api/controllers/`.
12. Register handler + controller in `application.module.ts`.
13. Migration in `src/migrations/`.
14. Cache config (if cached query) in `cache-config.registry.ts` + invalidation in command handler.
15. Messaging entry (if event-driven) in `messaging.registry.ts` + consumer/publisher.
16. Factory in `test/factories/` + e2e test in `test/modules/<feature>/`.
