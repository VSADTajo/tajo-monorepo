---
name: speckit-analyze
description: >
  Analisis read-only de consistencia entre spec.md, plan.md y tasks.md de una
  feature dentro de un servicio NestJS del monorepo VSAD Tajo. Detecta
  inconsistencias, ambiguedades, gaps de cobertura y violaciones de constitution.
  No modifica archivos sin aprobacion.
---

# /speckit-analyze

## Objetivo

Auditoria de consistencia READ-ONLY entre los artefactos del spec pipeline para una feature concreta. Se ejecuta despues de `/speckit-tasks` y antes de pasar a implementacion.

## Inputs

Detectar el directorio activo de la feature: `<ms-xxx>/.specify/specs/<feature>/`. Necesita los 3 artefactos (`spec.md`, `plan.md`, `tasks.md`).

## 6 pasadas de deteccion

### Pass 1: Constitution Alignment

Validar contra `/.specify/memory/constitution.md` (raiz) + opcionalmente `<ms-xxx>/.specify/memory/constitution.md`:

- [ ] Estructura `api/ → application/ → domain/ ← infrastructure/` respetada.
- [ ] Ports definidos como **abstract classes** (no interfaces TS) en `domain/ports/`.
- [ ] CQRS: cada operacion va por `CommandBus` o `CachingQueryBus`.
- [ ] Entities con `validate()` + extiende `BaseAuditEntity`.
- [ ] Migrations TypeORM raw SQL en `src/migrations/`.
- [ ] Tests e2e via HTTP (sin `dataSource.getRepository()`).
- [ ] Cache invalidation via `ICacheService.del/delByPattern` usando constantes del registry.
- [ ] Messaging via `IMessageBroker` y `messaging.registry.ts`.
- [ ] Tech stack alineado (Node 22, NestJS 11, TypeORM 0.3, Redis 7, RabbitMQ 3.13).

### Pass 2: Spec ↔ Plan consistency

- [ ] Cada user story tiene componentes en el plan.
- [ ] No hay componentes en el plan sin user story correspondiente.
- [ ] Success criteria del spec son alcanzables con la arquitectura propuesta.
- [ ] El plan declara migrations, eventos RabbitMQ, claves de cache si aplica.

### Pass 3: Plan ↔ Tasks consistency

- [ ] Cada componente del plan tiene tareas.
- [ ] Paths en tasks coinciden con la estructura `src/app/{api,application,domain,infrastructure}/...`.
- [ ] Dependencias de tareas son coherentes (test antes que impl; entity antes que repo; port antes que binding).

### Pass 4: Coverage gaps

- [ ] Tareas faltantes para user stories.
- [ ] Tests faltantes para acceptance criteria (cada AC deberia mapear a un test e2e).
- [ ] Migration faltante para entidades nuevas.
- [ ] Cache registry update faltante si plan menciona cache.
- [ ] `messaging.registry.ts` update faltante si plan menciona eventos.
- [ ] Swagger (`@ApiEndpoint` + `@ApiProperty`) implicito si plan agrega endpoints.

### Pass 5: Ambiguity detection

- [ ] Requisitos no-testeables ("debe ser rapido" → falta umbral).
- [ ] Descripciones de tareas vagas.
- [ ] `[NEEDS CLARIFICATION]` sin resolver.
- [ ] Tipos numericos sin precision (monto sin numeric(12,2), fechas sin TZ).

### Pass 6: Duplication

- [ ] Tareas duplicadas (mismo paso aparece en dos fases).
- [ ] Requisitos repetidos entre user stories.

## Output

```markdown
## Analysis Report — <ms-xxx>/<feature>

| ID | Severity | Pass | Finding | Artifact | Section |
|----|----------|------|---------|----------|---------|
| A1 | CRITICAL | 2 | US-03 sin componentes en plan | spec.md | User Stories |
| A2 | HIGH | 4 | Falta migration para tabla X | tasks.md | Phase 0 |
| A3 | HIGH | 1 | Port definido como interface TS, debe ser abstract class | plan.md | Architecture |
| A4 | MEDIUM | 5 | T025 con descripcion vaga | tasks.md | Phase 2 |

## Recommendations
- {accion 1}
- {accion 2}
```

Si hay findings **CRITICAL** → bloquear avance a implementacion, sugerir correcciones especificas (con paths/codigos).

## Notas

- Esta skill NO modifica archivos. Es solo auditoria.
- Despues del fix, re-correr `/speckit-analyze` antes de invocar `tdd-implementer`.
