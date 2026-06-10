---
name: speckit-tasks
description: >
  Genera tasks.md con la lista de tareas de implementacion ordenada por dependencias
  para una feature dentro de un servicio NestJS del monorepo VSAD Tajo. Usa IDs
  T001/T002, marca paralelas con [P], marca tests con [TEST] y sigue TDD.
---

# /speckit-tasks

## Prerequisitos
- `spec.md` y `plan.md` aprobados.
- `/speckit-analyze` ejecutado (consistency check sin findings CRITICAL).

## Estructura de tasks.md

```markdown
# Tasks: {feature name}

## Phase 0: Setup
- [ ] T001: Create TypeORM migration `src/migrations/<timestamp>-<name>.ts` (raw SQL up/down)
- [ ] T002: Add any new npm dependencies (`npm install <pkg>`)
- [ ] T003: Update `.env.example` and `<ms-xxx>/.env` with any new vars

## Phase 1: Foundational
- [ ] T010: Define port (abstract class) `src/app/domain/ports/<entity>-repository.port.ts`
- [ ] T011: Define entity `src/app/domain/entities/<entity>.entity.ts` (extends BaseAuditEntity + IValidable + validate())
- [ ] T012: Define value object(s) `src/app/domain/value-objects/<vo>.value-object.ts`
- [ ] T013: Define result class `src/app/domain/results/<result>.result.ts`
- [ ] T014: Implement repository `src/app/infrastructure/persistence/<entity>.repository.ts`
- [ ] T015: Bind port to repo in `src/app/infrastructure/infrastructure.module.ts` + register entity in `TypeOrmModule.forFeature([...])`

## Phase 2: User Stories

### US-01: {titulo}
- [ ] T020: [TEST] Write e2e spec `<ms-xxx>/test/modules/<feature>/<action>.e2e-spec.ts`
- [ ] T021: Add factory in `<ms-xxx>/test/factories/<entity>.factory.ts`
- [ ] T022: Define Command + Handler in `src/app/application/commands/<domain>.commands.ts`
- [ ] T023: Define Mapper in `src/app/application/mappers/<domain>.mappers.ts`
- [ ] T024: Define Request/Response DTOs in `src/app/api/dtos/<domain>.dtos.ts`
- [ ] T025: Add endpoint to controller `src/app/api/controllers/<feature>.controller.ts` (try/catch + @ApiEndpoint)
- [ ] T026: Register Handler + Controller in `src/app/application/application.module.ts`
- [ ] T027: Verify T020 passes: `cd <ms-xxx> && npm run test:e2e -- --testPathPattern=<action>`

### US-02: {titulo}
- [ ] T030: [TEST] ...
- [ ] T031: ...

## Phase 3: Integration & Polish
- [ ] T040: [TEST] Edge cases coverage (errors, duplicates, not found)
- [ ] T041: Cache config — add keys to `cache-config.registry.ts` + invalidation in command handlers (if plan defines cache)
- [ ] T042: Messaging — add queue/topic in `messaging.registry.ts` + consumer/publisher (if plan defines events)
- [ ] T043: Update `<ms-xxx>/CLAUDE.md` if new endpoints/queues changed the public contract
- [ ] T044: Verify `cd <ms-xxx> && npm run lint && npm run test:e2e` passes

## Dependency Map
T001 → T010, T011
T010, T011 → T014
T014 → T015
T015 → T020, T030
T020 → T021 → T022 → T023 → T024 → T025 → T026 → T027

## MVP Scope
Minimum tasks for feature functionality: T001-T027 (US-01 only).
```

## Reglas
- IDs de 3 digitos con gaps entre fases (T001-T009, T010-T019, T020-T029...).
- `[TEST]` marca tareas de test e2e — SIEMPRE preceden a la tarea de implementacion que cubren.
- `[P]` marca tareas paralelizables (sin dependencia entre si).
- Cada tarea incluye **file path absoluto al archivo objetivo** dentro del servicio.
- Toda fase termina con un verify task (correr lint + test:e2e).
- Si la feature toca cache: incluir tareas de registro + invalidacion.
- Si la feature toca eventos: incluir tareas de queue/topic + consumer/publisher.
- Si la feature toca contratos publicos: incluir tarea de actualizar `<ms-xxx>/CLAUDE.md`.
