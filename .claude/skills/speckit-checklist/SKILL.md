---
name: speckit-checklist
description: >
  Genera un checklist de calidad de requisitos (no de codigo) para una feature
  dentro de un servicio NestJS del monorepo VSAD Tajo. Verifica que spec.md sea
  completa, clara, consistente y medible. Guarda en
  <ms-xxx>/.specify/specs/<feature>/checklists/<domain>.md
---

# /speckit-checklist

## Objetivo

Quality gate: verificar que el spec esta listo para planificacion tecnica.

## Dimensiones de evaluacion

### 1. Completeness
- [ ] Todos los actores identificados.
- [ ] Acceptance criteria para cada user story.
- [ ] Escenarios de error definidos.
- [ ] Out of scope explicito.

### 2. Clarity
- [ ] Requisitos testeables (no "debe ser rapido").
- [ ] Success criteria medibles.
- [ ] Sin jerga ambigua.

### 3. Consistency
- [ ] Alineado con la constitution raiz (`/.specify/memory/constitution.md`).
- [ ] Alineado con la extension del servicio (`<ms-xxx>/.specify/memory/constitution.md`) si existe.
- [ ] Requisitos no se contradicen entre si.
- [ ] User stories cubren los functional requirements.

### 4. Measurability
- [ ] Cada success criterion tiene umbral observable (tiempo de respuesta, throughput, error rate).
- [ ] Criterios de aceptacion verificables automaticamente desde un test e2e.

### 5. Project-Specific (VSAD Tajo)
- [ ] Servicio target identificado (cual `<ms-xxx>` aloja la feature).
- [ ] Si requiere persistencia: entidad nueva o reuso identificado.
- [ ] Si requiere autenticacion: integracion con `ms-authentication-api` declarada.
- [ ] Si publica/consume eventos RabbitMQ: queue/topic identificado.
- [ ] Si requiere cache: query cacheable + politica de invalidacion declarada.
- [ ] Si toca contrato HTTP: endpoints, request/response shapes, status codes.
- [ ] Si toca frontend: integracion con `vsad-tajo-frontend` (Vue 3) o UI embebida.
- [ ] Compatibilidad con stack: NestJS 11, TypeORM 0.3, Redis 7, RabbitMQ 3.13.

## Output

Score: HIGH / MEDIUM / LOW.

- Si **LOW** → redirigir al agente `spec-developer` para mejora.
- Si **MEDIUM** → advertir pero permitir continuar.
- Si **HIGH** → proceder a `/vsad-preset` + `/speckit-plan`.

El checklist completo se persiste en `<ms-xxx>/.specify/specs/<feature>/checklists/<domain>.md`.
