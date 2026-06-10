---
name: vsad-preset
description: >
  Carga el contexto completo de convenciones del proyecto VSAD Tajo en la sesion antes de
  usar /speckit-plan. Stack NestJS 11 hexagonal + CQRS, TypeORM + PostgreSQL, Redis 7
  (CachingQueryBus), RabbitMQ 3.13, Vue 3 frontend. Tambien resume infraestructura Docker
  Compose y patrones de testing.
---

# /vsad-preset

Cuando se invoca esta skill, debes inyectar el siguiente contexto en la conversacion antes de cualquier intento de generar plan tecnico (`/speckit-plan`) o tasks (`/speckit-tasks`). Es el resumen ejecutivo que un planner necesita para producir contenido alineado al monorepo VSAD Tajo.

## Stack

| Layer | Tecnologia | Version |
|-------|-----------|---------|
| Runtime | Node.js | >= 22 |
| Framework backend | NestJS | 11 |
| Lenguaje | TypeScript | 5.7+ strict |
| ORM | TypeORM | 0.3 (raw SQL migrations) |
| DB | PostgreSQL | 16 (una por servicio) |
| Logs DB | MongoDB | 7 (solo `ms-logs-api`) |
| Cache | Redis 7 via `ioredis` + `CachingQueryBus` | — |
| Messaging | RabbitMQ 3.13 via `amqplib` + `@nestjs/microservices` | — |
| CQRS | `@nestjs/cqrs` | 11 |
| Validation | `class-validator` + `class-transformer` | — |
| Logging | `nestjs-pino` + `pino-pretty` | — |
| Swagger | `@nestjs/swagger` + custom `@ApiEndpoint` | — |
| Testing | Jest + Supertest + `@testcontainers/postgresql` | — |
| Frontend principal | Vue 3.5 + Vite 6 + Vuetify 3 + Pinia | — |
| Frontend tests | Vitest + Vue Test Utils + Cypress | — |
| Excepcion | `ms-logs-api` = Express 5 + Mongoose + MongoDB |

## Arquitectura (NestJS hexagonal + CQRS)

```
src/
├── main.ts                                # bootstrap hibrido (HTTP + RabbitMQ consumer)
├── app.module.ts
├── app/
│   ├── api/                                # INPUT
│   │   ├── controllers/
│   │   └── dtos/<domain>.dtos.ts
│   ├── application/                        # USE CASES
│   │   ├── commands/<domain>.commands.ts
│   │   ├── queries/<domain>.queries.ts
│   │   ├── mappers/<domain>.mappers.ts
│   │   ├── consumers/                      # @MessagePattern / @EventPattern
│   │   └── application.module.ts
│   ├── domain/                             # BUSINESS (zero framework deps)
│   │   ├── entities/                       # extiende BaseAuditEntity, implementa IValidable
│   │   ├── value-objects/
│   │   ├── ports/                          # abstract classes (DI tokens)
│   │   ├── errors/                         # ApiError, EntityError, RepositoryError, ProviderError, RetryError
│   │   ├── results/
│   │   └── types/
│   └── infrastructure/                     # OUTPUT
│       ├── cache/                          # CachingQueryBus + cache-config.registry.ts
│       ├── messaging/                      # RabbitmqService + messaging.registry.ts
│       ├── persistence/                    # TypeORM repositories
│       ├── services/                       # external integrations
│       └── infrastructure.module.ts        # bindings port → impl
├── common/                                 # exception filter, pipes, decorators
├── configuration/                          # @nestjs/config (app, postgres, redis, rabbitmq)
├── health/                                 # Terminus /health
├── swagger/                                # @ApiEndpoint
└── migrations/                             # TypeORM raw SQL migrations
```

Reglas duras:
- Controllers son finos: `Mapper.toCommand → CommandBus.execute → Mapper.toResponseDto` + try/catch (`EntityError → 400`, `ApiError → ApiError.statusCode`, else `500`).
- Ports son **abstract classes** (no interfaces), bound en `infrastructure.module.ts`.
- Entities extienden `BaseAuditEntity`, implementan `IValidable`, exponen `validate()` — llamado explicitamente por el handler antes de persistir.
- Cache invalidation manual via `ICacheService.del/delByPattern` usando constantes de `cache-config.registry.ts`.
- Messaging: queue/topic names viven en `messaging.registry.ts`; consumers `ack/nack` explicito.
- Migrations: raw SQL en `src/migrations/<timestamp>-<name>.ts`, `synchronize: false`.

## Path Aliases

`@app/*`, `@api/*`, `@domain/*`, `@application/*`, `@infrastructure/*`, `@config/*`, `@common/*`, `@health/*`, `@swagger/*` — siempre en `src/`. En `test/`, imports relativos.

## Comandos npm canonicos

```bash
npm run build                   # nest build
npm run start:dev               # watch
npm run test                    # unit
npm run test:e2e                # integration (requiere Docker)
npm run lint
npm run migration:run
npm run migration:create --name=<name>
```

## Testing (NON-NEGOTIABLE)

- e2e via HTTP endpoints unicamente. NO `dataSource.getRepository()` en asserts.
- Real Postgres via `@testcontainers/postgresql`. NUNCA SQLite/in-memory.
- Mockear SOLO servicios externos (broker, cache, third-party APIs). Repos y DB son reales.
- `createTestApp()` compone el modulo manualmente. NO importa `ApplicationModule`.
- Helpers en `test/` NO son async (devuelven supertest chain).
- Test files: `test/modules/<feature>/<action>.e2e-spec.ts`.

## Servicios del monorepo

`ms-gateway-api` (:3000), `ms-user-api` (:3001), `ms-authentication-api` (:3002), `ms-sftp-api` (:3003), `ms-logs-api` (:3004, Express), `ms-hydro-api` (:3006), `ms-predictions-api` (:3007), `ms-model-api` (:3008), `ms-notifications-api` (:3009), `ms-meteo-api` (:3010). Frontend: `vsad-tajo-frontend` (Vue 3, :8080).

Cada servicio NestJS tiene su propia DB Postgres (`infra-db-<service>` en `5433-5441`). Redis (`infra-redis:6379`) y RabbitMQ (`infra-rabbitmq:5672` + `:15672` UI) son compartidos.

## Output esperado

Despues de cargar este preset, los siguientes prompts (especialmente `/speckit-plan` y `/speckit-tasks`) deben producir contenido que:
- Use rutas y estructura `src/app/{api,application,domain,infrastructure}` correctamente.
- Refleje CQRS (Command/Query + Handler + Mapper).
- Defina ports como abstract classes.
- Liste migrations TypeORM raw SQL.
- Programe phase gates con `npm run test:e2e`.
- Mencione cache + messaging cuando aplique.
- NO mencione Go, Lambda, Serverless, zerolog, decimal.Decimal, testify, mockery ni client_id.

## Fuentes de verdad ampliadas

- Constitution raiz: `/.specify/memory/constitution.md`
- Reglas detalladas: `.claude/rules/02-nestjs.md`, `.claude/rules/04-infrastructure.md`, `.claude/rules/05-testing.md`
- Boilerplate canonico: `ms-gateway-api/CLAUDE.md`
