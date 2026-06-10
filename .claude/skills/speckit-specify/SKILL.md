---
name: speckit-specify
description: >
  Crea o actualiza una feature spec en .specify/specs/<feature>/spec.md.
  Toma una descripcion en lenguaje natural y genera un documento estructurado
  con user stories, functional requirements y success criteria technology-agnostic.
---

# speckit-specify

## Objetivo
Crear un spec.md completo y technology-agnostic a partir de una descripción en lenguaje natural.

## Pasos

1. **Verificar prerequisitos**:
   - `.specify/` existe (si no → sugerir `/speckit-init`)
   - `.specify/memory/constitution.md` existe y tiene principios

2. **Determinar feature**:
   - Si `.specify/feature.json` tiene un `dir` activo, preguntar si continuar o crear nuevo
   - Generar slug: `kebab-case` del nombre del feature
   - Crear directorio: `.specify/specs/<feature-slug>/`
   - Actualizar `feature.json`: `{ "dir": ".specify/specs/<feature-slug>" }`

3. **Fase de clarificación** (max 3 preguntas):
   - Preguntar solo lo que tenga alto impacto en el diseño
   - Cada pregunta con opciones sugeridas
   - No preguntar cosas que se pueden asumir razonablemente

4. **Generar spec.md** con esta estructura:
   ```markdown
   # Feature: {nombre}

   ## Overview
   {2-3 oraciones describiendo qué y por qué}

   ## User Scenarios

   ### US-01: {título}
   **As a** {actor}
   **I want** {acción}
   **So that** {beneficio}

   #### Acceptance Criteria
   - **Given** {contexto} **When** {acción} **Then** {resultado}
   - ...

   ## Functional Requirements

   | ID | Requirement | Priority |
   |----|-------------|----------|
   | FR-01 | ... | Must |
   | FR-02 | ... | Should |

   ## Success Criteria
   - [ ] {criterio medible y testeable}

   ## Assumptions
   - ...

   ## Out of Scope
   - ...
   ```

5. **Validar contra constitution**: verificar que no viole principios NON-NEGOTIABLE

6. **Presentar al usuario** y preguntar si está conforme o quiere ajustar

## Reglas
- Specs son **technology-agnostic** — nada de Go, React, SQL, etc.
- Acceptance criteria deben ser **testeables** — nada de "debe ser rápido"
- Un spec por feature, no mezclar features
