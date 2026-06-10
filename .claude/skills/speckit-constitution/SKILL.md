---
name: speckit-constitution
description: >
  Gestiona el archivo de gobernanza del proyecto (.specify/memory/constitution.md).
  Permite crear, ver, agregar/modificar/eliminar principios y versionar el documento.
---

# speckit-constitution

## Objetivo
CRUD sobre `.specify/memory/constitution.md` con versionado semántico.

## Acciones

### Ver
Mostrar principios actuales con su status (NON-NEGOTIABLE / RECOMMENDED).

### Agregar principio
1. Pedir nombre, contenido, nivel (NON-NEGOTIABLE / RECOMMENDED)
2. Asignar ID incremental (PRINCIPLE_N)
3. Bump versión MINOR

### Modificar principio
1. Seleccionar principio por ID
2. Editar contenido
3. Bump versión PATCH (si solo wording) o MINOR (si cambia significado)

### Eliminar principio
1. **NON-NEGOTIABLE no se pueden eliminar** — solo degradar a RECOMMENDED
2. RECOMMENDED se pueden eliminar
3. Bump versión MINOR

## Versionado
- MAJOR: cambio breaking (eliminar principio, cambiar stack)
- MINOR: nuevo principio, cambio de significado
- PATCH: corrección de redacción

Actualizar `Last Amended: {DATE}` en cada cambio.
