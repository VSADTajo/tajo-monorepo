---
name: speckit-plan
description: >
  Genera el plan tecnico de implementacion (plan.md) a partir de una spec aprobada,
  para una feature dentro de un servicio NestJS del monorepo VSAD Tajo. Propone
  arquitectura hexagonal + CQRS, data model TypeORM, API contracts, eventos
  RabbitMQ, cache Redis y estructura de directorios siguiendo los patrones del
  monorepo.
---

# /speckit-plan

## Prerequisitos
- `spec.md` aprobado (quality HIGH o MEDIUM).
- `/vsad-preset` ejecutado (convenciones cargadas en sesion).
- `/.specify/memory/constitution.md` disponible.

## Pasos

1. **Cargar artefactos**: `spec.md`, constitution raiz, `<ms-xxx>/CLAUDE.md` del servicio target.
2. **Validar spec contra constitution** — gate validation.
3. **Confirmar servicio target**: cual `<ms-xxx>/` aloja la feature. Si la feature cruza servicios, generar un plan por servicio mas un plan paraguas en `/.specify/specs/<feature>/plan.md`.

4. **Generar plan.md** con esta estructura:

```markdown
# Plan: {feature name}

## Summary
{1-2 parrafos sobre el approach tecnico}

## Technical Context
- Service: <ms-xxx>
- New dependencies: {npm packages nuevos}
- Storage: {tablas TypeORM nuevas o modificadas, cache keys, etc.}
- Events: {queues / topic exchanges en RabbitMQ}

## Architecture

### Directory Structure
{archivos nuevos y modificados con paths completos}

### Component Diagram
{relaciones entre Controller / Mapper / Handler / Port / Repository / Consumer}

## Data Model
{entities TypeORM nuevas: tabla, columnas, tipos, relaciones, indexes}
{migrations propuestas en src/migrations/}

## API Contracts
{endpoints HTTP nuevos: method + path + Request DTO + Response DTO + status codes + errores}
{decorators Swagger sugeridos via @ApiEndpoint}

## Events
- **Publish**: {queue/topic, payload schema}
- **Consume**: {queue, payload, handler}

## Cache
- Query: {QueryName}, key: {pattern}, TTL: {seconds}
- Invalidation: {commands que disparan del/delByPattern}

## Constitution Compliance
| Principle | Status | Notes |
|-----------|--------|-------|
| Hexagonal layers | ✅ | api/application/domain/infrastructure |
| Ports as abstract classes | ✅ | IFooRepository, IBarService |
| Entity validate() | ✅ | invoked in handler before persist |
| Tests via endpoints | ✅ | testcontainers postgres |
| ... | | |

## Migration Plan
{orden de cambios para deployment seguro: 1) migration up, 2) deploy code, 3) post-deploy backfill si aplica}

## Open Questions
{decisiones pendientes a resolver antes de tasks.md}
```

5. **Estructura de directorios NestJS hexagonal + CQRS** que el plan debe usar:

```
<ms-xxx>/src/
├── app/
│   ├── api/
│   │   ├── controllers/<feature>.controller.ts
│   │   └── dtos/<domain>.dtos.ts                    # Request + Response DTOs
│   ├── application/
│   │   ├── commands/<domain>.commands.ts            # Command + Handler
│   │   ├── queries/<domain>.queries.ts              # Query + Handler
│   │   ├── mappers/<domain>.mappers.ts              # Mapper
│   │   └── consumers/<feature>.consumer.ts          # opcional, RabbitMQ
│   ├── domain/
│   │   ├── entities/<entity>.entity.ts              # extends BaseAuditEntity
│   │   ├── value-objects/<vo>.value-object.ts
│   │   ├── ports/<port>.port.ts                     # abstract class
│   │   ├── results/<result>.result.ts
│   │   └── errors/<error>.error.ts                  # solo si hace falta uno nuevo
│   └── infrastructure/
│       ├── persistence/<entity>.repository.ts
│       └── services/<service>.service.ts            # solo si hay integracion externa
├── migrations/<timestamp>-<name>.ts                  # raw SQL
└── app/application/application.module.ts            # registrar handler + controller + consumer
```

Bindings en `src/app/infrastructure/infrastructure.module.ts`:
- `TypeOrmModule.forFeature([NewEntity])`
- `{ provide: INewRepository, useClass: NewRepository }`
- `{ provide: ICacheService, useClass: RedisCacheService }` (ya existe)
- `{ provide: IMessageBroker, useClass: RabbitmqService }` (ya existe)

Cache registry (`src/app/infrastructure/cache/cache-config.registry.ts`):
- Agregar constantes `<Entity>CacheKeys = { byId, list, pattern }`.
- Agregar entradas a `CACHE_REGISTRY` para queries cacheables.

Messaging registry (`src/app/infrastructure/messaging/messaging.registry.ts`):
- Agregar nombres a `Queues` o `Topics` si la feature publica/consume eventos.

6. **Presentar plan al usuario y esperar aprobacion**.

## Notas

- El plan es technology-aware: mencionar NestJS / TypeORM / RabbitMQ / Redis explicitamente, en contraste con el spec que es technology-agnostic.
- Cualquier deviation de las reglas de la constitution debe declararse en una seccion "Complexity Justification" del plan.
- Cuando la feature impacta multiples servicios, el plan paraguas en raiz declara orden de despliegue y contratos compartidos; los planes por servicio detallan implementacion local.
