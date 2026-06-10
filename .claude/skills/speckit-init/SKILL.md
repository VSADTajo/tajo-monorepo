---
name: speckit-init
description: >
  Inicializa spec-kit en un servicio del monorepo VSAD Tajo. Crea <ms-xxx>/.specify/
  con feature.json, templates, y opcionalmente una constitution local que extiende la
  del root. La constitution compartida vive en /.specify/memory/constitution.md.
---

# /speckit-init

## Objetivo

Bootstrappear `<ms-xxx>/.specify/` con la estructura necesaria para spec-driven development. La constitution **compartida** del monorepo vive en `/.specify/memory/constitution.md` y NO se duplica por servicio — solo se extiende si hace falta.

## Parametros

- `SERVICE` — slug del servicio target (`ms-user-api`, `ms-gateway-api`, etc.). Si no se provee, preguntar al usuario.

## Pasos

1. **Verificar constitution raiz**:
   - Si `/.specify/memory/constitution.md` NO existe, crear primero el monorepo-wide skeleton (avisar al usuario antes — esto suele ser un evento raro).
   - Si existe, usarla como fuente de verdad.

2. **Crear estructura del servicio**:
   ```
   <SERVICE>/.specify/
   ├── feature.json
   ├── memory/                 # opcional, solo si el servicio extiende la constitution raiz
   ├── specs/
   └── templates/
   ```

3. **Copiar templates** desde el servicio canonico (`ms-gateway-api/.specify/templates/`):
   ```bash
   cp -r /Users/sebastianaliceio/Desktop/proyects/flowCat/vsad-tajo/ms-gateway-api/.specify/templates \
         <SERVICE>/.specify/
   ```
   Templates: `spec-template.md`, `plan-template.md`, `tasks-template.md`, `checklist-template.md`, `constitution-template.md`, `agent-file-template.md`.

4. **Crear `feature.json`**:
   ```json
   { "dir": "" }
   ```

5. **(Opcional)** Crear `<SERVICE>/.specify/memory/constitution.md` SOLO si el servicio necesita reglas adicionales que NO contradicen la raiz. Estructura sugerida:
   ```markdown
   # <SERVICE> Constitution Extensions
   > Version: 1.0.0 | Ratified: <DATE>
   > Extends /.specify/memory/constitution.md

   ## PRINCIPLE_X: <topic>
   <regla adicional especifica del servicio>
   ```

6. Reportar completado y sugerir:
   - "Constitution heredada de `/.specify/memory/constitution.md`."
   - "Templates listos en `<SERVICE>/.specify/templates/`."
   - "Usa `/speckit-specify` para crear el primer spec dentro de este servicio."

## Notas

- NO sobrescribir `feature.json` si ya existe (puede tener feature activa).
- NO copiar templates si ya existen — preguntar al usuario antes.
- Si la constitution raiz no existe todavia, generarla usando el template canonico (`ms-gateway-api/.specify/templates/constitution-template.md`) y completando los principios NestJS hexagonal + CQRS del monorepo.
