# MS-Hydro — Microservicio de Datos de Referencia Hidrologica

Microservicio NestJS para gestion de datos maestros hidrologicos: cuencas, subcuencas, estaciones y umbrales de alerta.

## Stack Tecnologico

| Capa | Tecnologia |
|------|-----------|
| Runtime | Node.js >= 22 |
| Framework | NestJS 11 |
| Lenguaje | TypeScript 5.7+ (strict mode) |
| Base de datos | PostgreSQL 16 via TypeORM 0.3 |
| CQRS | @nestjs/cqrs 11 |
| Cache | Redis 7 via ioredis + CachingQueryBus |
| Mensajeria | RabbitMQ 3.13 via amqplib (opcional) |
| Testing | Jest + Supertest + Testcontainers |
| API Docs | Swagger (OpenAPI) |

## Prerequisitos

- **Node.js** >= 22 (ver `.nvmrc`)
- **Docker** & **Docker Compose**
- **npm** >= 10.5

## Inicio Rapido

### 1. Clonar e instalar

```bash
git clone <repository-url>
cd ms-hydro-api
nvm use
npm install
```

### 2. Configurar entorno

```bash
cp .env.example .env
```

### 3. Levantar con Docker

```bash
docker compose up
```

Esto inicia la API, PostgreSQL y Redis, y ejecuta migraciones automaticamente.

- **API**: http://localhost:3006
- **Swagger**: http://localhost:3006/docs
- **Health**: http://localhost:3006/health

### 4. Levantar localmente (sin Docker)

```bash
npm run migration:run
npm run start:dev
```

---

## Endpoints API

### Health

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| `GET` | `/health` | Health check (app + base de datos) |

### Cuencas (`/basins`)

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| `GET` | `/basins` | Listar cuencas con filtros opcionales |
| `POST` | `/basins` | Crear nueva cuenca |
| `GET` | `/basins/:id` | Obtener cuenca por ID con sus subcuencas |
| `PUT` | `/basins/:id` | Actualizar cuenca |
| `PATCH` | `/basins/:id/toggle` | Activar/desactivar cuenca |
| `DELETE` | `/basins/:id` | Soft delete (desactivar cuenca) |

### Subcuencas (`/sub-basins`)

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| `GET` | `/sub-basins` | Listar subcuencas con filtros opcionales |
| `POST` | `/sub-basins` | Crear nueva subcuenca |
| `GET` | `/sub-basins/:id` | Obtener subcuenca por ID con sus estaciones |
| `PUT` | `/sub-basins/:id` | Actualizar subcuenca |
| `PATCH` | `/sub-basins/:id/toggle` | Activar/desactivar subcuenca |
| `DELETE` | `/sub-basins/:id` | Soft delete (desactivar subcuenca) |

### Estaciones (`/stations`)

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| `GET` | `/stations` | Listar estaciones con filtros opcionales |
| `POST` | `/stations` | Crear nueva estacion |
| `GET` | `/stations/:id` | Obtener estacion por ID |
| `GET` | `/stations/by-sub-basin-name/:subBasinName` | Obtener estacion por nombre de subcuenca |
| `PUT` | `/stations/:id` | Actualizar estacion |
| `PATCH` | `/stations/:id/toggle` | Activar/desactivar estacion |
| `PUT` | `/stations/:id/threshold` | Actualizar umbral de alerta |
| `GET` | `/stations/:id/threshold` | Obtener umbral de alerta |
| `DELETE` | `/stations/:id` | Soft delete (desactivar estacion) |

Documentacion completa con esquemas request/response en `/docs` (Swagger UI).

---

## Arquitectura

El proyecto sigue **Arquitectura Hexagonal** (Puertos y Adaptadores) con **CQRS**.

```
src/
├── main.ts                         # Bootstrap
├── app.module.ts                   # Modulo raiz
│
├── app/                            # Dominio de features
│   ├── api/                        # Adaptadores de entrada (HTTP)
│   │   ├── controllers/            # Basin, SubBasin, Station
│   │   └── dtos/                   # Request/Response DTOs
│   │
│   ├── application/                # Casos de uso
│   │   ├── commands/               # Operaciones de escritura
│   │   ├── queries/                # Operaciones de lectura
│   │   └── mappers/                # DTO <-> Command/Result
│   │
│   ├── domain/                     # Logica de negocio
│   │   ├── entities/               # Basin, SubBasin, Station
│   │   ├── value-objects/          # Tipos inmutables validados
│   │   ├── ports/                  # Clases abstractas (contratos DI)
│   │   ├── errors/                 # Jerarquia de errores
│   │   └── results/                # Objetos resultado
│   │
│   └── infrastructure/             # Adaptadores de salida
│       ├── cache/                  # CachingQueryBus + registry
│       ├── messaging/              # RabbitMQ (opcional)
│       ├── persistence/            # Repositorios TypeORM
│       └── services/               # Servicios externos
│
├── common/                         # Excepciones, pipes, decoradores
├── configuration/                  # Configuracion (@nestjs/config)
├── health/                         # Health check (Terminus)
├── swagger/                        # Swagger + decoradores
└── migrations/                     # Migraciones SQL
```

### Flujo de Request

```
HTTP Request
  → Controller
    → Mapper.toCommand(dto)
      → CommandBus.execute(command) / CachingQueryBus.execute(query)
        → Handler
          → Port (clase abstracta)
            → Repositorio (implementacion)
              → Result
    → Mapper.toResponseDto(result)
  → HTTP Response
```

---

## Cache (Redis)

Las queries pasan por `CachingQueryBus` que consulta Redis antes de ir a la base de datos.

### Queries cacheadas

| Query | TTL | Cache Key |
|-------|-----|-----------|
| `GetBasinByIdQuery` | 300s | `basin:{id}` |
| `ListBasinsQuery` | 300s | `basins:list` |
| `GetSubBasinByIdQuery` | 300s | `sub-basin:{id}` |
| `ListSubBasinsQuery` | 300s | `sub-basins:list` |
| `GetStationByIdQuery` | 300s | `station:{id}` |
| `GetStationBySubBasinNameQuery` | 300s | `station:name:{subBasinName}` |
| `GetStationThresholdQuery` | 600s | `station:threshold:{id}` |
| `ListStationsQuery` | 300s | `stations:list` |

### Invalidacion

Los command handlers invalidan automaticamente las cache keys relevantes despues de cada mutacion (create, update, delete, toggle).

---

## Integracion con otros Microservicios

- **ms-predictions-api** consulta `GET /stations/:id/threshold` para obtener umbrales de alerta al procesar predicciones. Si esta API no esta disponible, predictions-api degrada gracefully (no genera notificaciones de umbral).

---

## Configuracion

| Variable | Default | Descripcion |
|----------|---------|-------------|
| `APP_NAME` | `nestjs-boilerplate` | Nombre de la app |
| `NODE_ENV` | `development` | Entorno |
| `APP_PORT` | `3000` | Puerto HTTP |
| `APP_LOG_LEVEL` | `info` | Nivel de log |
| `DB_HOST` | `127.0.0.1` | Host PostgreSQL |
| `DB_PORT` | `5432` | Puerto PostgreSQL |
| `DB_USERNAME` | `postgres` | Usuario DB |
| `DB_PASSWORD` | `secret` | Password DB |
| `DB_DATABASE` | `boilerplate` | Nombre DB |
| `DB_SYNCHRONIZE` | `false` | Auto-sync schema (nunca en prod) |
| `REDIS_HOST` | `127.0.0.1` | Host Redis |
| `REDIS_PORT` | `6379` | Puerto Redis |
| `REDIS_DEFAULT_TTL` | `300` | TTL default en segundos |
| `RABBITMQ_ENABLED` | `false` | Habilitar RabbitMQ |

Ver `.env.example` para la lista completa incluyendo RabbitMQ.

---

## Scripts

| Script | Descripcion |
|--------|-------------|
| `npm run build` | Compilar TypeScript |
| `npm run start:dev` | Dev mode con watch |
| `npm run start:prod` | Modo produccion |
| `npm run lint` | ESLint + auto-fix |
| `npm run format` | Prettier |
| `npm run test` | Tests unitarios |
| `npm run test:e2e` | Tests de integracion (requiere Docker) |
| `npm run migration:run` | Ejecutar migraciones pendientes |
| `npm run migration:create --name=<name>` | Crear migracion vacia |

---

## Testing

Tests de integracion con **Testcontainers** (PostgreSQL real en Docker).

```bash
npm run test:e2e

# Test especifico
npm run test:e2e -- --testPathPattern=create-basin
```

Filosofia:
- Testear solo via endpoints HTTP (no acceso directo a DB)
- PostgreSQL real via Testcontainers
- Mock solo servicios externos
- Verificar via API: crear via POST, confirmar via GET

---

## Docker

### Desarrollo

```bash
docker compose up
```

### Produccion

```bash
docker build --target prod -t ms-hydro-api .
```

Dockerfile multi-stage: `dev` → `build` → `prod` (imagen minima con `dist/` + deps de produccion).

---

## Licencia

UNLICENSED
