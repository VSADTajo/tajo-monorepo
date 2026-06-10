---
name: speckit-implement
description: >
  Ejecuta las tareas de tasks.md en orden de dependencias para una feature dentro
  de un servicio NestJS del monorepo VSAD Tajo. Lee spec/plan/tasks, ejecuta fase
  por fase siguiendo TDD, y reporta progreso con checkboxes. No avanza de fase
  hasta que los tests pasen.
---

# /speckit-implement

## Prerequisitos
- `<ms-xxx>/.specify/specs/<feature>/tasks.md` aprobado.
- `plan.md` y `spec.md` disponibles.
- Constitution raiz `/.specify/memory/constitution.md` para validacion.

## Workflow

1. **Cargar artefactos**: `tasks.md`, `plan.md`, `spec.md`, constitution raiz (+ override del servicio si existe).
2. **Mostrar status actual**: tareas completadas vs pendientes por fase.
3. **Preguntar**: continuar desde la ultima incompleta o reiniciar?
4. **Ejecutar fase por fase**:
   ```
   Anunciar fase → Ejecutar tareas en orden → Marcar [x] → Gate de tests → Siguiente fase
   ```

### Por tipo de tarea

**Setup (T00X)**:
- Crear migracion TypeORM: `npm run migration:create --name=<name>` → archivo en `src/migrations/<timestamp>-<name>.ts`. Llenar `up`/`down` con raw SQL.
- Agregar dependencias en `package.json` (`npm install <pkg>`).
- Actualizar configuration modules en `src/configuration/` y `.env.example` si hace falta.

**Test (marcadas [TEST])**:
- Escribir test PRIMERO (Red en TDD): `<ms-xxx>/test/modules/<feature>/<action>.e2e-spec.ts`.
- Usar `createTestApp()` + Testcontainers Postgres reales. Mockear SOLO servicios externos (broker, cache).
- Helper functions NO async (devuelven supertest chain).
- Confirmar que FALLA con `npm run test:e2e -- --testPathPattern=<file>`.
- Marcar `[x]` en `tasks.md`.

**Implementacion**:
- Escribir codigo minimo para hacer pasar el test (Green).
- Seguir capas hexagonal + CQRS del plan:
  - Controller en `src/app/api/controllers/` — solo Mapper + CommandBus + try/catch.
  - Command + Handler en `src/app/application/commands/<domain>.commands.ts`.
  - Entity en `src/app/domain/entities/` (`BaseAuditEntity` + `IValidable` + `validate()`).
  - Port (abstract class) en `src/app/domain/ports/`. Binding en `infrastructure.module.ts`.
  - Repository en `src/app/infrastructure/persistence/`.
- Logger via `@Inject(Logger)` (`nestjs-pino`). NUNCA `console.log`.
- Path aliases (`@app/*`, `@domain/*`, etc.) en `src/`; relativos en `test/`.
- Cache invalidation via `ICacheService.del/delByPattern` con constantes de `cache-config.registry.ts`.
- Messaging: queue/topic names desde `messaging.registry.ts`; `ack/nack` explicito en consumers.
- Marcar `[x]` en `tasks.md`.

**Refactor**:
- Mejorar sin cambiar comportamiento.
- Re-correr tests para asegurar verde.

### Gate de fase (OBLIGATORIO)

Al terminar todas las tareas de una fase, desde el directorio del servicio:
```bash
cd <ms-xxx>
npm run lint
npm run test:e2e
```

NO avanzar a la siguiente fase si lint o tests fallan.

### Review de arquitectura (antes del completion signal)

- [ ] No hay logica de negocio en controllers (solo Mapper + CommandBus + try/catch).
- [ ] No hay imports de `infrastructure/` dentro de `domain/`.
- [ ] Ports definidos como **abstract classes** en `src/app/domain/ports/` y bound en `infrastructure.module.ts`.
- [ ] Entity registrada en `TypeOrmModule.forFeature([...])` Y en `entities` de tests.
- [ ] Migration en `src/migrations/` aplicada.
- [ ] Swagger se autogeneraria con `@ApiEndpoint` + `@ApiProperty`.
- [ ] `/health` (Terminus) responde OK.

### Completion signal

Solo emitir despues de:
1. Todas las fases completas.
2. `npm run test:e2e` verde.
3. `npm run lint` limpio.
4. Architecture review pasado.

Sugerir: "Implementacion completa. Invocar el agente `code-reviewer` para revision pre-PR."
