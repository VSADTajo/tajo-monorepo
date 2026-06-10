---
name: start-service
description: >
  Levanta un microservicio NestJS del monorepo VSAD Tajo localmente. Recibe el nombre
  del servicio como argumento (ej. ms-user-api) y elige entre modo local (npm run start:dev)
  o modo Docker (docker compose up). Corre migraciones automaticamente en local.
---

# /start-service

Levanta un microservicio NestJS especifico. Usar cuando se quiere iterar sobre un servicio individual sin levantar todo el stack.

## Input

`<service-name>` — uno de los servicios del monorepo (`ms-gateway-api`, `ms-user-api`, `ms-authentication-api`, `ms-sftp-api`, `ms-logs-api`, `ms-hydro-api`, `ms-predictions-api`, `ms-model-api`, `ms-notifications-api`, `ms-meteo-api`).

Si no se proporciona, pedir al usuario que lo indique.

## Prerequisitos

- Node.js >= 22 instalado (`node -v`).
- Docker corriendo (`docker ps`).
- Infraestructura levantada (`/start-infra` si no esta corriendo).

## Modo Local (recomendado para desarrollo activo)

```bash
cd <service-name>
npm install                                # primera vez o tras cambios en package.json
npm run migration:run                      # aplica migraciones pendientes
npm run start:dev                          # arranca en watch mode
```

El servicio queda escuchando en el puerto correspondiente:

| Servicio | Puerto |
|----------|--------|
| ms-gateway-api | 3000 |
| ms-user-api | 3001 |
| ms-authentication-api | 3002 |
| ms-sftp-api | 3003 |
| ms-logs-api | 3004 |
| ms-hydro-api | 3006 |
| ms-predictions-api | 3007 |
| ms-model-api | 3008 |
| ms-notifications-api | 3009 |
| ms-meteo-api | 3010 |

Variables de entorno se leen de `<service-name>/.env` (copiar de `.env.example` la primera vez y ajustar credenciales).

## Modo Docker (recomendado para validar integracion)

```bash
cd infra/infra
docker compose -f docker-compose.yml -f docker-compose.apps.yml up -d <service-name>
docker compose -f docker-compose.yml -f docker-compose.apps.yml logs -f <service-name>
```

El contenedor monta `<service-name>/` como volumen y corre `npm run migration:run && npm run start:dev`.

## Smoke tests

```bash
curl http://localhost:<port>/health        # Terminus check
curl http://localhost:<port>/docs          # Swagger UI
```

## Troubleshooting

- **Puerto ocupado**: matar el proceso (`lsof -i :<port>`) o el contenedor (`docker stop <service-name>`).
- **DB no responde**: validar que el contenedor Postgres del servicio (`infra-db-<short>`) este healthy con `docker ps`. Si no, `/start-infra` o ver `/docker-ops`.
- **Migration fail**: leer el output. Si la DB esta en un estado raro, drop la DB del servicio (`docker exec -it infra-db-<short> psql -U postgres -c "DROP DATABASE <db>; CREATE DATABASE <db>;"`) y reintentar `npm run migration:run`.
- **RabbitMQ unreachable**: validar `infra-rabbitmq` esta up. UI disponible en `http://localhost:15672` (guest/guest).
