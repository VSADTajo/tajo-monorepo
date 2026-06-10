---
name: tech-lead
description: >
  Orquesta un Agent Team para el monorepo VSAD Tajo. Vos sos el Technical Lead.
  Esta skill te guia paso a paso: descubrir el proposito, definir teammates con
  su scope (servicio del monorepo), generar briefs que obligan a cada teammate
  a seguir el flujo speckit (spec-developer -> /speckit-clarify -> /vsad-preset
  -> /speckit-plan -> /speckit-tasks -> /speckit-implement con tdd-implementer)
  dentro de su servicio, spawnear el team, y coordinar hasta el cierre.
---

# Tech Lead — Orquestador de Agent Teams para VSAD Tajo

Esta skill define el rol del **Technical Lead (TL)** del monorepo VSAD Tajo cuando se trabaja con Agent Teams nativos de Claude Code. El TL es **la sesion principal** (vos, ahora mismo). Los teammates son sesiones separadas que vos vas a spawnear.

El objetivo: cada teammate trabaja en **un servicio del monorepo** (ej: `ms-user-api/`, `ms-authentication-api/`, `vsad-tajo-frontend/`) y dentro de ese servicio aplica el flujo **spec-driven** completo, no implementa codigo a mano.

---

## Cuando usar `/tech-lead`

- Features que cruzan dos o mas servicios del monorepo (ej: nuevo microservicio + integracion con `vsad-tajo-frontend` y `ms-gateway-api`).
- Refactors grandes con porciones paralelizables por servicio.
- Investigaciones / code reviews multi-dimensionales sobre el monorepo.

No usar cuando:
- La tarea cabe en un solo servicio sin paralelismo real -> usar `/speckit-specify` directo.
- El usuario ya tiene specs por servicio y solo necesita ejecutar -> usar `/speckit-implement` por servicio.

---

## Pre-requisitos (verificar siempre antes de arrancar)

1. **Claude Code v2.1.32+** (ya cumplido si la skill esta disponible).
2. **Flag activada**: `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` en `.claude/settings.local.json` o env.
3. **Display mode**:
   - Si hay tmux/iTerm2 instalado -> `"teammateMode": "tmux"` (split panes).
   - Si no -> `"teammateMode": "in-process"` y avisar al usuario que va a ciclar con Shift+Down.
4. **Sin team activo previo**: un lead solo maneja un team a la vez. Si hay otro, primero `TeamDelete`.

Verificar con:
```bash
claude --version
grep CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS .claude/settings.local.json ~/.claude/settings.json 2>/dev/null
which tmux
```

Si falta algo: pausar, decirle al usuario que hace falta, no continuar.

---

## Flujo de la skill (5 fases)

### Fase 1 — Discovery (preguntar al usuario)

Hacer las preguntas en orden, **una a la vez** con AskUserQuestion. NO hacer todo de golpe.

**Pregunta A (proposito global)**:
- Texto libre: "Que queres lograr con este team? Una frase."
- Si el usuario invoco la skill con argumentos (ej: `/tech-lead "agregar autenticacion multi-factor a ms-authentication-api"`), tomar eso como proposito y saltar.

**Pregunta B (slug del team)**:
- Proponer un slug derivado del proposito (kebab-case, max 40 chars). Confirmar con el usuario.
- Este slug se usa como nombre del team y como nombre de la feature en `.specify/specs/`.

**Pregunta C (cantidad y roles de teammates)**:
- "Cuantos teammates y que hace cada uno?"
- Ofrecer presets para casos comunes:
  - **Rename / refactor multi-archivo**: 3 teammates (code, infra, docs).
  - **Nuevo microservicio NestJS**: 4 teammates (scaffold via `/create-nestjs-service`, domain, persistence + messaging, infra-ops para docker-compose).
  - **Microservicio + integracion frontend Vue**: 5 teammates (scaffold, domain backend, gateway integracion, frontend, verify e2e).
- Si el usuario no usa preset, preguntar uno por uno.

**Pregunta D (por cada teammate)**:
Para cada teammate definir 5 cosas:
1. **Nombre**: kebab-case (ej: `backend-auth`, `frontend-login`, `infra-docker`).
2. **Scope (servicio)**: path absoluto del directorio del monorepo donde trabaja (ej: `/Users/sebastianaliceio/Desktop/proyects/flowCat/vsad-tajo/ms-user-api`). Si el teammate trabaja transversal (`infra/infra/docker-compose.apps.yml`, `.claude/rules/`, docs), el scope es la raiz del monorepo y debe declarar explicitamente los archivos owned.
3. **Rol resumen**: 1-2 frases.
4. **Dependencias**: lista de teammates que deben terminar antes (puede ser vacia).
5. **Plan approval gate**: si/no. Default `si` la primera vez que el usuario usa Agent Teams, `no` despues.

**Pregunta E (modelo)**:
- Modelo default para teammates: Sonnet (suficiente para ejecucion).
- Excepciones: si un teammate hace decisiones arquitectonicas criticas (ej: el que escribe la spec de un servicio nuevo desde cero), proponer Opus para ese.

---

### Fase 2 — Validacion (chequeos antes de spawnear)

Antes de crear nada, validar:

1. **Servicios existen**: cada scope path debe existir en el filesystem.
   ```bash
   for path in <scopes>; do test -d "$path" || echo "MISSING: $path"; done
   ```
2. **No hay overlap de archivos owned** (cuando los teammates declaran archivos transversales): si dos teammates apuntan al mismo archivo, abortar y preguntar al usuario como dividir.
3. **DAG valido**: las dependencias no forman ciclo. Recorrer y detectar.
4. **`.specify/` por servicio**: chequear si cada `<scope>/.specify/` existe. Si NO, agregar al brief del teammate un paso 0: "ejecuta `/speckit-init` para inicializar spec-kit en este servicio".
5. **Sin team activo**: `~/.claude/teams/` no debe tener teams activos. Si hay, ofrecer cleanup.

Si algo falla -> mostrar el problema al usuario, ofrecer correccion, no avanzar.

---

### Fase 3 — Generar briefs

Para cada teammate, escribir el brief en:
```
~/.claude/teams/<team-slug>/briefs/<teammate-name>.md
```

Crear el directorio si no existe (`mkdir -p`).

**Plantilla del brief** (rellenar valores `{{...}}`):

```markdown
# Brief — {{teammate-name}}

## Tu rol
{{role-summary}}

## Proposito del team
{{global-purpose}}

Sos parte del team `{{team-slug}}`. Hay {{N}} teammates en total:
{{lista-otros-teammates-con-roles-cortos}}

## Tu scope
**Servicio**: `{{scope-path}}`

Estas autorizado a editar archivos **dentro de este directorio** y los archivos
transversales listados abajo. Cualquier archivo fuera de esta lista esta
PROHIBIDO de modificar.

### Archivos owned (transversales si aplica)
{{lista-archivos-fuera-del-scope-que-tambien-podes-tocar}}

## Tus dependencias
{{si vacia: "Ninguna. Podes empezar inmediatamente." }}
{{si no: "Esperá a que estos teammates terminen su task del team antes de empezar la implementacion:
- {{nombre1}}
- {{nombre2}}
Mientras tanto, podés avanzar hasta /speckit-tasks pero NO ejecutes /speckit-implement."}}

## Flujo obligatorio (en orden)

### Paso 0 — Inicializar spec-kit en tu servicio (si no existe)
Si `{{scope-path}}/.specify/` no existe, ejecutá `/speckit-init` para inicializarlo.

### Paso 1 — Escribir la spec
Invocá al agente `spec-developer` (que vive en `.claude/agents/spec-developer.md`).
Pasale este contexto:
- Que vas a hacer (tu rol + scope)
- Que servicio toca
- Que entrega esperada hay (acceptance criteria sugeridos)

El agente te va a entrevistar y generar `{{scope-path}}/.specify/specs/{{team-slug}}/spec.md`.

### Paso 2 — Clarificar
Ejecutá `/speckit-clarify`. Si la spec tiene secciones [NEEDS CLARIFICATION], el comando hace preguntas estructuradas. Resolvé todas.

### Paso 3 — Cargar contexto del proyecto
Ejecutá `/vsad-preset` para cargar las convenciones del monorepo en tu contexto (NestJS 11 hexagonal + CQRS, TypeORM, Redis, RabbitMQ, Vue 3).

### Paso 4 — Plan tecnico
Ejecutá `/speckit-plan`. Esto genera `{{scope-path}}/.specify/specs/{{team-slug}}/plan.md` con la arquitectura, data model, API contracts y estructura de directorios siguiendo las convenciones del proyecto.

### Paso 5 — Tasks
Ejecutá `/speckit-tasks`. Genera `tasks.md` con la lista TDD-ordenada de tareas (IDs T001, T002, etc.).

### Paso 6 — Implementacion TDD
Invocá al agente `tdd-implementer` (vive en `.claude/agents/tdd-implementer.md`). Le pasás:
- Path absoluto a tu `tasks.md`
- Que se ajuste estrictamente a la spec/plan
El agente ejecuta fase por fase con tests primero.

### Paso 7 — Verificar
Corré los tests del servicio:
- NestJS service: `cd {{scope-path}} && npm run lint && npm run test:e2e`
- Frontend Vue: `cd {{scope-path}} && npm run check && npm run test`
- Build: `npm run build`

Si fallan, arreglar antes de cerrar.

### Paso 8 — Notificar al TL
1. Marcá tu task del team como `completed`.
2. Mandá un mensaje al lead (SendMessage) con:
   - Resumen de lo hecho (1-3 lineas)
   - Path absoluto de la spec final
   - Resultado de los tests
   - Cualquier deuda tecnica conocida

## Si te bloqueas

NO improvises fuera de tu scope. Opciones:
1. **Mandá mensaje al TL** con la duda concreta -> el TL te responde o coordina con otro teammate.
2. **Si la duda es para otro teammate** (ej: contrato de API que necesitas), mandale mensaje directo por nombre.
3. **Si un test falla por algo fuera de tu scope**, marcá tu task como bloqueada con descripcion y avisá al TL.

## Reglas duras

- NO modifiques archivos fuera de tu scope o lista owned.
- NO commitees git por tu cuenta -- el TL coordina los commits.
- NO toques `.specify/` de otros servicios.
- NO uses `/speckit-implement` antes de que tus dependencias terminen.
- SI el flujo speckit te lleva a producir codigo sin tests primero, parar y avisar al TL -- algo esta mal.

## Plan approval (si esta activado)
{{si plan-approval=si: "Estas en plan mode hasta que el TL apruebe tu plan. Trabaja en read-only: explora, escribe spec/plan/tasks, presenta el plan al TL. NO escribas codigo de implementacion hasta aprobacion."}}
{{si plan-approval=no: "No hay gate de aprobacion. Procedé con autonomia, manteniendo las reglas duras."}}
```

---

### Fase 4 — Spawn del team

Confirmar **una vez mas** con el usuario antes de spawnear. Mostrar resumen visual:

```
Team: <slug>
Display: tmux (o in-process)
Teammates:
  1. <name> — <scope> — plan-approval: <on/off> — modelo: <sonnet/opus>
     deps: <none / lista>
  2. ...

Voy a:
  1. Crear el team con TeamCreate
  2. Spawnear cada teammate con su brief como spawn prompt
  3. Quedarme monitoreando como TL

Confirmas? (si/no)
```

Si el usuario confirma:
1. Llamar `TeamCreate` con el slug y la config.
2. Para cada teammate (en orden de dependencias):
   - Leer el brief de `~/.claude/teams/<slug>/briefs/<name>.md`
   - Spawnear con `Agent` o el mecanismo equivalente del runtime de teams, pasando:
     - `agentType`: default (claude). NO usar `spec-developer` como agentType -- el brief lo invoca explicitamente.
     - `model`: el elegido por teammate.
     - `prompt`: el contenido del brief + un wrapper corto: "Sos el teammate `<name>` del team `<slug>`. Lee tu brief abajo y ejecutalo paso por paso."
     - Si plan-approval=si: marcar para plan mode.
3. Confirmar al usuario que todos los teammates estan spawneados.

---

### Fase 5 — Coordinacion (durante la ejecucion)

Como TL, durante la vida del team:

1. **Escuchá notificaciones**: el runtime te avisa cuando un teammate va a idle. NO hagas polling.
2. **Plan approval**: si activaste el gate, vas a recibir requests de aprobacion. Por cada uno:
   - Leé el plan presentado.
   - Verifica que se ajuste al brief (scope, deliverables).
   - Verifica que los tests esten contemplados (constitution del proyecto).
   - Aprobá o rechazá con feedback concreto.
3. **Sincronizacion de dependencias**: cuando un teammate marca su task como `completed`, chequeá si destrabó dependencias de otros teammates. Si si, mandales mensaje "tu dependencia `<X>` cerró, ya podés avanzar a /speckit-implement".
4. **Conflictos de archivo**: si dos teammates piden tocar el mismo archivo (no deberia pasar si la Fase 2 valido bien), pausar a uno y resolver con el usuario.
5. **Verificacion end-to-end** (al final, cuando todos esten idle):
   - Correr los smoke tests globales del feature (ej: `/start-all` + curl a endpoints relevantes, abrir `vsad-tajo-frontend` en :8080).
   - Si pasa: reportá al usuario el team esta listo para cleanup.
   - Si no: identificá el teammate responsable y mandale instrucciones para fix.

---

### Fase 6 — Cierre

Cuando todo esta verde:

1. Avisarle al usuario: "Team `<slug>` completo. Verifique end-to-end paso. Listo para cleanup."
2. Esperar confirmacion explicita del usuario antes de ejecutar `TeamDelete`.
3. Al hacer cleanup:
   - `TeamDelete` (el runtime se encarga de cerrar panes y procesos).
   - Mover los briefs a `~/.claude/teams/<slug>/_archived/` (no borrar -- sirven de referencia).
4. Resumen final al usuario:
   - Specs creadas (path por teammate).
   - Tests corridos.
   - Diff total (`git diff --stat` si el usuario lo pide).
   - Proximos pasos sugeridos (ej: commit, PR, deploy).

---

## Reglas duras del TL

- **NUNCA spawnear sin confirmacion explicita** del usuario en la Fase 4.
- **NUNCA borrar el team sin confirmacion explicita** en la Fase 6.
- **NUNCA escribir codigo del feature como TL** -- delegar a teammates. El TL solo orquesta, valida y cierra.
- **NUNCA dejar el team huerfano**: si la sesion principal se cierra sin cleanup, recordar al usuario antes de salir.
- **SIEMPRE validar la Fase 2** antes de generar briefs. Vale mas pausar y arreglar el plan que spawnear basura.
- **PREFERIR teams chicos**: 3-5 teammates. Si el usuario pide mas, advertir sobre coordination overhead y costo de tokens.

---

## Anti-patrones (evitar)

- **Spawnear sin specs por teammate**: el valor de la skill es forzar el flujo speckit. Saltearlo elimina el valor.
- **Teammates compartiendo el mismo archivo**: race conditions silenciosas. La Fase 2 debe atrapar esto.
- **Briefs vagos**: "implementá auth" no sirve. Tiene que listar archivos, deps, tests esperados.
- **Plan approval siempre off**: ok para teams chicos y veteranos, pero la primera vez que un usuario corre Agent Teams en este proyecto, dejar approval ON.
- **TL escribiendo codigo**: si tenes ganas de tipear, paraste. El TL existe para coordinar, no para hacer.

---

## Glosario

- **TL** = Technical Lead = sesion principal de Claude = vos cuando corres esta skill.
- **Teammate** = sesion separada spawneada por Agent Teams, con su propio contexto.
- **Brief** = spawn prompt + instrucciones para un teammate, escrito en `~/.claude/teams/<slug>/briefs/<name>.md`.
- **Scope** = directorio del monorepo donde un teammate puede editar.
- **Plan approval gate** = teammate trabaja read-only hasta que el TL apruebe el plan.
- **Owned files transversales** = archivos fuera del scope que el teammate puede tocar (ej: `infra/infra/docker-compose.apps.yml` para infra-ops, `.claude/rules/01-global.md` para registry updates).

---

## Referencia de agentes y skills del proyecto

Cada teammate va a usar:
- `spec-developer` (agente, model: opus) — entrevista y refina specs.
- `tdd-implementer` (agente) — ejecuta tasks.md con TDD en NestJS hexagonal + CQRS.
- `/speckit-init`, `/speckit-specify`, `/speckit-clarify`, `/speckit-plan`, `/speckit-tasks`, `/speckit-implement` (skills) — pipeline spec-driven.
- `/vsad-preset` (skill) — convenciones del monorepo (NestJS + Vue + infraestructura).
- `/create-nestjs-service` (skill) — solo cuando el teammate scaffold tiene que crear un servicio nuevo.
- `/code-review` (skill) — self-review antes de cerrar (opcional).
- `/verify` (skill) — verificacion end-to-end.

El TL puede invocar:
- `feature-test-orchestrator` (agente) — audit de coverage al final del team, antes del cleanup.
- `code-reviewer` (agente) — review cross-teammate antes del cleanup.
