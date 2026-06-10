---
name: speckit-clarify
description: >
  Refina una feature spec resolviendo ambiguedades antes de pasar a /speckit-plan.
  Lee spec.md, detecta secciones NEEDS CLARIFICATION y hace hasta 5 preguntas
  estructuradas con opciones sugeridas.
---

# speckit-clarify

## Objetivo
Resolver ambigüedades en spec.md antes de generar el plan técnico.

## Pasos

1. **Cargar artefactos**:
   - `.specify/feature.json` → feature activo
   - `spec.md` del feature activo
   - `.specify/memory/constitution.md`

2. **Detectar ambigüedades**:
   - Secciones con `[NEEDS CLARIFICATION]`
   - Requisitos vagos o no-testeables
   - Criterios de aceptación incompletos
   - Assumptions cuestionables
   - Múltiples interpretaciones posibles

3. **Presentar preguntas** (máx 5, ordenadas por impacto):
   ```
   ### Q1 (HIGH IMPACT): {pregunta}
   **Contexto**: {por qué importa}
   **Opciones sugeridas**:
   A) {opción} — {implicancia}
   B) {opción} — {implicancia}
   C) Otro: {texto libre}
   ```

4. **Actualizar spec.md** con las respuestas:
   - Remover marcas `[NEEDS CLARIFICATION]`
   - Ajustar acceptance criteria
   - Agregar requisitos descubiertos

5. **Reportar resumen**:
   - Ambigüedades resueltas: N
   - Requisitos modificados: N
   - Próximo paso: `/go-spec-preset` + `/speckit-plan`
