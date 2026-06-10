---
name: docker-ops
description: >
  Guia practica para operar contenedores Docker Compose del monorepo VSAD Tajo.
  Cubre logs, exec, rebuild, troubleshooting de servicios caidos, inspeccion de las
  PostgreSQL por servicio, MongoDB (logs), Redis y RabbitMQ (con management UI).
---

# Docker Operations — VSAD Tajo

## Start / Stop

```bash
cd infra/infra

# Solo infraestructura (Postgres, Mongo, Redis, RabbitMQ)
docker compose up -d
docker compose down

# Stack completo (infra + microservicios + frontends)
docker compose -f docker-compose.yml -f docker-compose.apps.yml up -d
docker compose -f docker-compose.yml -f docker-compose.apps.yml down

# Borrar volumes (DESTRUYE LOS DATOS)
docker compose down -v
```

Atajos con skills: `/start-infra`, `/start-all`, `/start-service <name>`, `/start-frontend`.

## Container Registry

### Infraestructura
| Container | Puerto | Imagen | Tipo |
|-----------|--------|--------|------|
| `infra-redis` | 6379 | redis:7-alpine | Cache |
| `infra-rabbitmq` | 5672 + 15672 | rabbitmq:3.13-management-alpine | Messaging |
| `infra-db-user` | 5433 | postgres:16.4-alpine | DB ms-user-api |
| `infra-db-sftp` | 5435 | postgres:16.4-alpine | DB ms-sftp-api |
| `infra-db-geoserver` | 5436 | postgis/postgis:17-3.5-alpine | Spatial DB |
| `infra-db-predictions` | 5437 | postgres:16.4-alpine | DB ms-predictions-api |
| `infra-db-hydro` | 5438 | postgres:16.4-alpine | DB ms-hydro-api |
| `infra-db-model` | 5439 | postgres:16.4-alpine | DB ms-model-api |
| `infra-db-notifications` | 5440 | postgres:16.4-alpine | DB ms-notifications-api |
| `infra-db-meteo` | 5441 | postgres:16.4-alpine | DB ms-meteo-api |
| `infra-mongo-logs` | 27017 | mongo:7.0.28 | DB ms-logs-api |

### Apps (modo Docker)
| Container | Puerto | Stack |
|-----------|--------|-------|
| `ms-gateway-api` | 3000 | NestJS |
| `ms-user-api` | 3001 | NestJS |
| `ms-authentication-api` | 3002 | NestJS |
| `ms-sftp-api` | 3003 | NestJS |
| `ms-logs-api` | 3004 | Express |
| `ms-hydro-api` | 3006 | NestJS |
| `ms-predictions-api` | 3007 | NestJS |
| `ms-model-api` | 3008 | NestJS |
| `ms-notifications-api` | 3009 | NestJS |
| `ms-meteo-api` | 3010 | NestJS |
| `vsad-tajo-frontend` | 8080 | Vue 3 + nginx |
| `sftp-frontend` | 5174 | React 19 + nginx |

## Logs

```bash
docker logs -f --tail 200 ms-user-api
docker logs -f --since 5m infra-rabbitmq
docker logs --tail 100 infra-db-meteo
```

Stream multi-servicio:
```bash
cd infra/infra
docker compose -f docker-compose.yml -f docker-compose.apps.yml logs -f ms-gateway-api ms-user-api
```

## Inspeccionar PostgreSQL

```bash
# Acceder al psql del container
docker exec -it infra-db-user psql -U postgres -d user_db

# Desde host (si tenes psql instalado)
PGPASSWORD=secret psql -h localhost -p 5433 -U postgres -d user_db

# Queries utiles
\dt                                              # listar tablas
\d+ users                                        # esquema de la tabla
SELECT count(*) FROM users;
SELECT * FROM users ORDER BY "createdAt" DESC LIMIT 5;
```

Si el esquema usa camelCase (TypeORM default), envolver columnas en doble comilla: `"createdAt"`.

## Inspeccionar MongoDB

```bash
docker exec -it infra-mongo-logs mongosh -u <user> -p <pass>

# Dentro del shell
use logs
db.entries.find().limit(5)
db.entries.countDocuments({})
```

## Redis

```bash
docker exec -it infra-redis redis-cli
> KEYS *                                          # listar todas las keys (cuidado en prod)
> KEYS 'role:*'                                  # patron
> TTL <key>
> GET <key>
> INFO memory
> FLUSHALL                                       # limpiar TODO (solo dev!)
```

## RabbitMQ

```bash
# CLI
docker exec -it infra-rabbitmq rabbitmqctl list_queues name messages_ready consumers
docker exec -it infra-rabbitmq rabbitmqctl list_exchanges name type
docker exec -it infra-rabbitmq rabbitmqctl list_bindings

# Management UI
open http://localhost:15672                       # user: guest / pass: guest
```

## Rebuild de un servicio

```bash
cd infra/infra
docker compose -f docker-compose.yml -f docker-compose.apps.yml build ms-user-api --no-cache
docker compose -f docker-compose.yml -f docker-compose.apps.yml up -d ms-user-api --force-recreate
```

## Troubleshooting

```bash
# Estado general
docker compose -f docker-compose.yml -f docker-compose.apps.yml ps

# Container que no arranca
docker logs <container> --tail 50
docker inspect <container> | jq '.[0].State'

# Recursos
docker stats --no-stream

# Health checks
docker inspect infra-db-user | jq '.[0].State.Health'

# Networking
docker network inspect infra_infra-network
```

### Postgres password desync

`POSTGRES_PASSWORD` solo aplica al primer arranque del volumen. Si ya existia:
```bash
docker exec infra-db-user psql -U postgres -c "ALTER USER postgres PASSWORD 'new_password';"
```

### Servicio NestJS arranca y muere
Usualmente migraciones fallidas o env vars rotas:
```bash
docker logs -f ms-<service>            # buscar "ECONNREFUSED" (DB no lista) o errores TypeORM
docker exec -it ms-<service> sh        # entrar para chequear .env
```

### Cleanup
```bash
docker compose down -v                  # volumes del proyecto
docker system prune -f                  # imagenes sin uso
docker volume prune -f                  # volumes dangling
```

## Dev local sin Docker (apps)

Solo levanta la infra en Docker y corre los servicios + frontend localmente:

```bash
# Terminal 1
/start-infra                           # docker compose up -d en infra/infra

# Terminal 2
/start-service ms-user-api             # npm run start:dev en el servicio

# Terminal 3
/start-frontend                        # vsad-tajo-frontend en :8080
```
