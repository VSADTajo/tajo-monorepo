---
name: start-all
description: >
  Levanta TODO el stack VSAD Tajo en Docker: infraestructura (Postgres, MongoDB,
  Redis, RabbitMQ) + microservicios NestJS + frontends. Un solo comando para tener
  el sistema completo corriendo.
---

# /start-all

Levanta el stack completo via Docker Compose. Usar cuando se quiere validar el sistema end-to-end (todos los servicios conversando entre si por RabbitMQ + cada uno apuntando a su DB).

## Comando

```bash
cd infra/infra
docker compose -f docker-compose.yml -f docker-compose.apps.yml up -d --build
```

Build inicial puede tardar varios minutos (Node 22 + nest build por cada servicio).

## Que levanta

### Infraestructura

| Container | Puerto |
|-----------|--------|
| `infra-redis` | 6379 |
| `infra-rabbitmq` | 5672 + 15672 |
| `infra-db-user` | 5433 |
| `infra-db-sftp` | 5435 |
| `infra-db-geoserver` | 5436 |
| `infra-db-predictions` | 5437 |
| `infra-db-hydro` | 5438 |
| `infra-db-model` | 5439 |
| `infra-db-notifications` | 5440 |
| `infra-db-meteo` | 5441 |
| `infra-mongo-logs` | 27017 |

### Microservicios NestJS

| Container | Puerto |
|-----------|--------|
| `ms-gateway-api` | 3000 |
| `ms-user-api` | 3001 |
| `ms-authentication-api` | 3002 |
| `ms-sftp-api` | 3003 |
| `ms-logs-api` (Express) | 3004 |
| `ms-hydro-api` | 3006 |
| `ms-predictions-api` | 3007 |
| `ms-model-api` | 3008 |
| `ms-notifications-api` | 3009 |
| `ms-meteo-api` | 3010 |

### Frontends

| Container | Puerto |
|-----------|--------|
| `vsad-tajo-frontend` (Vue 3 via nginx) | 8080 |
| `sftp-frontend` (React 19 via nginx) | 5174 |

Cada microservicio NestJS arranca con `npm run migration:run && npm run start:dev` (modo dev con volumen montado).

## Verificacion

```bash
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Health checks
for port in 3000 3001 3002 3003 3004 3006 3007 3008 3009 3010; do
  echo -n "Port $port: "; curl -s http://localhost:$port/health | head -c 50; echo
done

# Frontend
curl -I http://localhost:8080
```

## Logs

```bash
# Stream todos
docker compose -f docker-compose.yml -f docker-compose.apps.yml logs -f

# Solo un servicio
docker logs -f ms-user-api
```

## Parar

```bash
cd infra/infra
docker compose -f docker-compose.yml -f docker-compose.apps.yml down
```

Tambien borrar volumes (DESTRUYE LOS DATOS de todas las DBs):
```bash
docker compose -f docker-compose.yml -f docker-compose.apps.yml down -v
```

## Notas

- Las variables compartidas entre todos los servicios viven en los anchors `x-common-db-env` y `x-common-infra-env` de `docker-compose.apps.yml`.
- Si necesitas correr Jenkins tambien: `docker compose -f docker-compose.yml -f docker-compose.apps.yml -f docker-compose.jenkins.yml up -d`.
- Para iterar sobre un solo servicio sin levantar todo, usar `/start-service <name>`.
