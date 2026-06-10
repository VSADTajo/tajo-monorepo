---
name: start-infra
description: >
  Levanta la infraestructura local del monorepo VSAD Tajo: PostgreSQL (una DB por
  servicio), MongoDB (ms-logs-api), Redis 7 (cache) y RabbitMQ 3.13 (messaging).
  Usar cuando se necesita la base de datos y los brokers antes de correr los servicios.
---

# /start-infra

Levanta la infraestructura compartida del monorepo. Es el primer paso antes de levantar cualquier servicio NestJS.

## Comando

```bash
cd infra/infra
docker compose up -d
```

Eso levanta los siguientes contenedores en la red `infra-network`:

| Container | Puerto host | Imagen | Rol |
|-----------|-------------|--------|-----|
| `infra-redis` | 6379 | `redis:7-alpine` | Cache (CachingQueryBus, ioredis) |
| `infra-rabbitmq` | 5672 + 15672 | `rabbitmq:3.13-management-alpine` | Messaging + management UI |
| `infra-db-user` | 5433 | `postgres:16.4-alpine` | ms-user-api |
| `infra-db-sftp` | 5435 | `postgres:16.4-alpine` | ms-sftp-api |
| `infra-db-geoserver` | 5436 | `postgis/postgis:17-3.5-alpine` | GeoServer + spatial |
| `infra-db-predictions` | 5437 | `postgres:16.4-alpine` | ms-predictions-api |
| `infra-db-hydro` | 5438 | `postgres:16.4-alpine` | ms-hydro-api |
| `infra-db-model` | 5439 | `postgres:16.4-alpine` | ms-model-api |
| `infra-db-notifications` | 5440 | `postgres:16.4-alpine` | ms-notifications-api |
| `infra-db-meteo` | 5441 | `postgres:16.4-alpine` | ms-meteo-api |
| `infra-mongo-logs` | 27017 | `mongo:7.0.28` | ms-logs-api |

## Verificar

```bash
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"  # todos UP
docker exec infra-redis redis-cli ping                          # PONG
docker exec infra-db-user pg_isready -U postgres                # accepting connections
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:15672 # 200 (RabbitMQ UI)
```

## Acceso rapido

- **Redis CLI**: `docker exec -it infra-redis redis-cli`
- **RabbitMQ Management UI**: http://localhost:15672 (user: `guest`, pass: `guest`)
- **Postgres (ej. user)**: `docker exec -it infra-db-user psql -U postgres -d user_db`
- **MongoDB**: `docker exec -it infra-mongo-logs mongosh -u <user> -p <pass>`

## Parar

```bash
cd infra/infra
docker compose down
```

Borrar tambien los volumes (DESTRUYE LOS DATOS):
```bash
docker compose down -v
```

## Inicializacion automatica

`infra/postgres/init-extensions.sql` se ejecuta en cada Postgres en el primer arranque y crea la extension `uuid-ossp`. Si la base ya existe (volumen persistente), no se vuelve a correr.

## Troubleshooting

- **Puerto ocupado**: matar el proceso (`lsof -i :<puerto>`) o cambiar el mapping en `docker-compose.yml`.
- **PostgreSQL password desync**: el password de `docker-compose.yml` solo aplica al primer init del volumen. Si lo cambiaste despues, hace `docker exec <container> psql -U postgres -c "ALTER USER postgres PASSWORD 'new'"`. Ver `.claude/rules/04-infrastructure.md`.
- **Mongo no arranca**: revisar `MONGO_INITDB_ROOT_USERNAME` y `MONGO_INITDB_ROOT_PASSWORD` en `.env`.
- **RabbitMQ inaccessible**: validar que `infra-rabbitmq` este `healthy` (`docker ps`).

Ver `/docker-ops` para mas operaciones sobre contenedores activos.
