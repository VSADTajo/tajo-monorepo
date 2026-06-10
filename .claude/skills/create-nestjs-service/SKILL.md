---
name: create-nestjs-service
description: >
  Crea un nuevo microservicio NestJS clonando ms-gateway-api como template. Ajusta
  package.json (nombre, puerto), bootstrap, configura un Postgres dedicado en
  docker-compose.yml, agrega el servicio a docker-compose.apps.yml, inicializa
  .specify/ local, y registra el servicio en .claude/rules/01-global.md.
  Usar cuando se necesita un nuevo servicio en el monorepo.
---

# /create-nestjs-service

Esta skill orquesta el alta de un nuevo microservicio NestJS en el monorepo VSAD Tajo. No hay un "boilerplate" central — el template canonico es `ms-gateway-api/`.

## Inputs requeridos

1. `SERVICE_NAME` (slug, ej. `ms-billing-api`). Debe empezar con `ms-` y terminar con `-api` por convencion.
2. `PORT` (int unico, siguiente disponible despues de 3010; ej. 3011).
3. `DB_NAME` (postgres database name, ej. `billing`).
4. `DB_HOST_PORT` (puerto externo del Postgres dedicado, siguiente despues de 5441; ej. 5442).
5. `DESCRIPTION` (1 linea para el registry).

## Pasos

### 1. Clonar el template
```bash
cp -r /Users/sebastianaliceio/Desktop/proyects/flowCat/vsad-tajo/ms-gateway-api \
      /Users/sebastianaliceio/Desktop/proyects/flowCat/vsad-tajo/${SERVICE_NAME}
cd ${SERVICE_NAME}
rm -rf node_modules dist .git
```

### 2. Ajustar `package.json`
- `name`: `${SERVICE_NAME}`
- `version`: `0.1.0`
- `description`: `${DESCRIPTION}`
- Mantener todos los scripts (`start:dev`, `test:e2e`, `migration:*`, etc.).

### 3. Ajustar bootstrap (`src/main.ts` + `src/configuration/app/`)
- `APP_NAME` default → `${SERVICE_NAME}`.
- `APP_PORT` default → `${PORT}`.

### 4. Vaciar dominio del template
- Borrar entidades, value objects, commands, queries, mappers, controllers, repositories y migrations del template (user-roles, etc.).
- Conservar la infraestructura compartida: `BaseAuditEntity`, ports `ICacheService` / `IMessageBroker`, `RedisCacheService`, `RabbitmqService`, error hierarchy, exception filter, validation pipe, swagger setup, health module.
- Mantener `cache-config.registry.ts` y `messaging.registry.ts` con estructura vacia (sin entries todavia).

### 5. `.env.example`
- Renombrar `DB_DATABASE` default → `${DB_NAME}`.
- Mantener el resto (Redis, RabbitMQ, etc.).

### 6. Postgres dedicado en `infra/infra/docker-compose.yml`
Agregar bloque (siguiendo el patron de `db-user`):
```yaml
  db-${SERVICE_NAME#ms-}:
    image: postgres:16.4-alpine
    container_name: infra-db-${SERVICE_NAME#ms-api}
    ports:
      - "${DB_HOST_PORT}:5432"
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-postgres}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-secret}
      POSTGRES_DB: ${DB_NAME}
    volumes:
      - pg-${SERVICE_NAME#ms-}-data:/var/lib/postgresql/data
      - ./postgres/init-extensions.sql:/docker-entrypoint-initdb.d/init-extensions.sql:ro
    networks: [infra-network]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 10
```
Y agregar el volume al final del archivo: `pg-${SERVICE_NAME#ms-}-data:`.

### 7. App service en `infra/infra/docker-compose.apps.yml`
Agregar (usando los anchors `x-common-db-env` / `x-common-infra-env`):
```yaml
  ${SERVICE_NAME}:
    container_name: ${SERVICE_NAME}
    build:
      context: ../${SERVICE_NAME}
      target: dev
    command: sh -c "npm run migration:run && npm run start:dev"
    environment:
      <<: [*common-db-env, *common-infra-env]
      APP_NAME: ${SERVICE_NAME}
      APP_PORT: '${PORT}'
      DB_HOST: infra-db-${SERVICE_NAME#ms-api}
      DB_DATABASE: ${DB_NAME}
    expose: ['${PORT}']
    volumes:
      - ../${SERVICE_NAME}:/app
      - /app/node_modules
    depends_on:
      db-${SERVICE_NAME#ms-api}: { condition: service_healthy }
      redis: { condition: service_healthy }
      rabbitmq: { condition: service_healthy }
    networks: [infra-network]
```

### 8. Inicializar `.specify/` local
```bash
mkdir -p ${SERVICE_NAME}/.specify/{memory,specs,templates}
# Copiar templates del template
cp /Users/sebastianaliceio/Desktop/proyects/flowCat/vsad-tajo/ms-gateway-api/.specify/templates/* \
   ${SERVICE_NAME}/.specify/templates/
# Crear feature.json vacio
echo '{"dir": ""}' > ${SERVICE_NAME}/.specify/feature.json
```
La constitution especifica del servicio (`${SERVICE_NAME}/.specify/memory/constitution.md`) es opcional — solo crearla si hay reglas que extienden la del root. Por default, el servicio hereda `/.specify/memory/constitution.md`.

### 9. Registrar en `.claude/rules/01-global.md`
Agregar fila a la tabla del registry:
```
| ${SERVICE_NAME} | ${PORT} | NestJS 11 | ${SERVICE_NAME}/ | ${DESCRIPTION} |
```

### 10. Registrar en `infra/CLAUDE.md`
Agregar fila al registry de servicios + entrada en la tabla de infraestructura.

### 11. Crear CLAUDE.md del servicio
Empezar copiando `ms-gateway-api/CLAUDE.md` al `${SERVICE_NAME}/CLAUDE.md` y reemplazar las menciones del boilerplate por el nombre + proposito del nuevo servicio.

### 12. Verificar
```bash
cd ${SERVICE_NAME}
npm install
npm run build                # debe pasar
cd ..
cd infra/infra
docker compose up -d db-${SERVICE_NAME#ms-api}
docker compose -f docker-compose.yml -f docker-compose.apps.yml up -d ${SERVICE_NAME}
curl http://localhost:${PORT}/health    # debe responder
```

## Resultado

Un microservicio NestJS funcional, hexagonal + CQRS, integrado al docker-compose, con `.specify/` local y registrado en las reglas. Listo para arrancar features via `/speckit-specify`.

## Notas
- NO usar el flow Go (`go.mod`, `go.work`, `Makefile`, `serverless.yml`). Eso es legado.
- NO commitear `node_modules/` ni `dist/`.
- Confirmar con el usuario los inputs antes de ejecutar — la creacion toca varios archivos compartidos (`docker-compose*.yml`, `.claude/rules/01-global.md`, `infra/CLAUDE.md`).
