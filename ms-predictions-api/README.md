# MS-Predictions — Microservicio de Predicciones Meteorologicas

Microservicio NestJS para procesamiento y consulta de predicciones pluviometricas. Consume series temporales normalizadas via RabbitMQ, genera simulaciones con predicciones por percentil, y emite notificaciones cuando se superan umbrales de alerta.

## Stack Tecnologico

| Capa | Tecnologia |
|------|-----------|
| Runtime | Node.js >= 22 |
| Framework | NestJS 11 |
| Lenguaje | TypeScript 5.7+ (strict mode) |
| Base de datos | PostgreSQL 16 via TypeORM 0.3 |
| CQRS | @nestjs/cqrs 11 |
| Cache | Redis 7 via ioredis + CachingQueryBus |
| Mensajeria | RabbitMQ 3.13 via amqplib (consumidor) |
| HTTP Client | axios (para consultas a hydro-api) |
| Testing | Jest + Supertest + Testcontainers |
| API Docs | Swagger (OpenAPI) |

## Prerequisitos

- **Node.js** >= 22 (ver `.nvmrc`)
- **Docker** & **Docker Compose**
- **npm** >= 10.5
- **ms-model-api** corriendo (publica eventos `timeseries.ingested`)
- **ms-hydro-api** corriendo (opcional, para umbrales de alerta)

## Inicio Rapido

### 1. Clonar e instalar

```bash
git clone <repository-url>
cd ms-predictions-api
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

Esto inicia la API, PostgreSQL, Redis, RabbitMQ y ejecuta migraciones automaticamente.

- **API**: http://localhost:3005
- **Swagger**: http://localhost:3005/docs
- **Health**: http://localhost:3005/health

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

### Predicciones (`/predictions`)

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| `GET` | `/predictions/available-dates` | Obtener fechas de simulacion disponibles |
| `GET` | `/predictions/max-and-latest-values` | Valores maximos y ultimos por estacion |
| `GET` | `/predictions/precip-accumulated?source=observed\|harmonie\|eps&hours=1\|2\|4\|8\|12\|24` | Precipitacion acumulada por estacion en N horas (observado: ultimas N horas; prediccion: maximo de N horas seguidas). Se compara con los umbrales de aviso de lluvia de AEMET |
| `GET` | `/predictions/raw/:provider/:simulationDate` | Predicciones raw por proveedor y fecha |
| `GET` | `/predictions/by-percentile/:simulationDate` | Predicciones agrupadas por percentil |
| `GET` | `/predictions/historical/:stationId` | Historico de predicciones por estacion |

### Simulaciones (`/simulations`)

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| `POST` | `/simulations/with-predictions` | Crear simulacion con predicciones en batch |
| `GET` | `/simulations` | Listar simulaciones con filtros |
| `GET` | `/simulations/latest` | Obtener ultima simulacion finalizada |
| `GET` | `/simulations/historical` | Historico de simulaciones finalizadas |
| `GET` | `/simulations/available-dates` | Fechas de simulacion disponibles |
| `GET` | `/simulations/:simulationDate` | Obtener simulacion por fecha |
| `PATCH` | `/simulations/:id/finalize` | Finalizar una simulacion |

### Notificaciones (`/notifications`)

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| `GET` | `/notifications` | Listar notificaciones con filtros |
| `PATCH` | `/notifications/:id/verify` | Verificar una notificacion |
| `PATCH` | `/notifications/:id/read` | Marcar notificacion como leida |

Documentacion completa con esquemas request/response en `/docs` (Swagger UI).

---

## Flujo de Procesamiento

```
1. Evento RabbitMQ (de ms-model-api)
   → Exchange: model-events
   → Routing key: timeseries.ingested
   → Payload: { providerName, series[] }

2. TimeSeriesConsumer
   → Recibe series normalizadas
   → Ejecuta ProcessTimeSeriesCommand

3. ProcessTimeSeriesHandler (por cada serie)
   → Extrae percentil del parameterId (ej: "P.ens.forecast.75" → 75)
   → Crea/reutiliza Simulation (por forecastDate + modmeteo)
   → Crea/reutiliza PredictionType (por parameterId base)
   → Crea Prediction + PredictionResults (valores horarios)

4. Evaluacion de Umbrales
   → Consulta GET ms-hydro-api/stations/:id/threshold
   → Si valor maximo > umbral → crea Notification
   → Si hydro-api no disponible → skip (degradacion graceful)

5. Auto-finalizacion
   → Si todas las series del evento fueron procesadas
   → Simulation.status = FINALIZED
```

### Modelo de datos

```
Simulation (1) ──→ (N) Prediction ──→ (N) PredictionResult
                         │
                         └──→ (1) PredictionType

Notification ──→ referencia a Prediction
```

### Percentiles

Los archivos EPS contienen series con sufijo numerico que indica percentil:
- `P.ens.forecast.10` → percentil 10
- `P.ens.forecast.25` → percentil 25
- `P.ens.forecast.75` → percentil 75
- `P.ens.forecast.90` → percentil 90
- `P.ens.forecast.Med` → sin percentil (null)
- `P.harmonie.forecast` → sin percentil (null, Harmonie no tiene percentiles)

---

## Arquitectura

El proyecto sigue **Arquitectura Hexagonal** (Puertos y Adaptadores) con **CQRS**.

```
src/
├── main.ts                         # Bootstrap (hibrido HTTP + RabbitMQ)
├── app.module.ts                   # Modulo raiz
│
├── app/                            # Dominio de features
│   ├── api/                        # Adaptadores de entrada (HTTP)
│   │   ├── controllers/            # Prediction, Simulation, Notification
│   │   └── dtos/                   # Request/Response DTOs
│   │
│   ├── application/                # Casos de uso
│   │   ├── commands/               # ProcessTimeSeries, BatchIngest, Finalize
│   │   ├── queries/                # Listados, historico, by-percentile
│   │   ├── mappers/                # DTO <-> Command/Result
│   │   └── consumers/              # TimeSeriesConsumer (RabbitMQ)
│   │
│   ├── domain/                     # Logica de negocio
│   │   ├── entities/               # Simulation, Prediction, PredictionResult, PredictionType, Notification
│   │   ├── ports/                  # Repositorios, IStationThresholdService
│   │   ├── errors/                 # Jerarquia de errores
│   │   └── results/                # Objetos resultado
│   │
│   └── infrastructure/             # Adaptadores de salida
│       ├── cache/                  # CachingQueryBus + registry
│       ├── messaging/              # RabbitMQ (consume model-events)
│       ├── persistence/            # Repositorios TypeORM
│       └── services/               # StationThresholdService (HTTP a hydro-api)
│
├── common/                         # Excepciones, pipes, decoradores
├── configuration/                  # App, DB, Redis, RabbitMQ, Hydro-API
├── health/                         # Health check (Terminus)
├── swagger/                        # Swagger + decoradores
└── migrations/                     # Migraciones SQL
```

---

## Cache (Redis)

### Queries cacheadas

| Query | TTL | Cache Key |
|-------|-----|-----------|
| `ListSimulationsQuery` | 60s | `simulations:list:{filters}` |
| `GetSimulationByDateQuery` | 60s | `simulations:date:{date}` |
| `GetLatestSimulationQuery` | 60s | `simulations:latest` |
| `GetHistoricalSimulationsQuery` | 60s | `simulations:historical:{page,limit}` |
| `GetAvailableDatesQuery` | 300s | `simulations:available-dates` |
| `GetHistoricalPredictionsQuery` | 60s | `predictions:historical:{stationId}:{filters}` |
| `GetRawPredictionsQuery` | 60s | `predictions:raw:{provider}:{date}` |
| `GetByPercentileQuery` | 60s | `predictions:percentile:{date}:{percentile}` |
| `GetMaxAndLatestValuesQuery` | 60s | `predictions:max-latest:{filters}` |
| `GetPrecipAccumulationQuery` | 60s | `predictions:precip-accumulated:{source}:{hours}` |
| `ListNotificationsQuery` | 60s | `notifications:list:{filters}` |

### Invalidacion

Los command handlers invalidan automaticamente las cache keys despues de cada mutacion.

---

## Mensajeria (RabbitMQ)

### Eventos consumidos

| Exchange | Routing Key | Descripcion |
|----------|-------------|-------------|
| `model-events` | `timeseries.ingested` | Series temporales de ms-model-api |

### Cola

| Cola | Descripcion |
|------|-------------|
| `predictions-timeseries-processing` | Cola interna para procesamiento de series |

---

## Integracion con otros Microservicios

| Servicio | Direccion | Proposito |
|----------|-----------|-----------|
| **ms-model-api** | → predictions-api (RabbitMQ) | Publica `timeseries.ingested` |
| **ms-hydro-api** | ← predictions-api (HTTP) | Consulta umbrales de estaciones |

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
| `RABBITMQ_ENABLED` | `true` | Habilitar RabbitMQ |
| `RABBITMQ_HOST` | `127.0.0.1` | Host RabbitMQ |
| `RABBITMQ_PORT` | `5672` | Puerto RabbitMQ |
| `HYDRO_API_BASE_URL` | `http://localhost:3004` | URL de ms-hydro-api |
| `STATION_THRESHOLD_CACHE_TTL` | `300` | TTL cache de umbrales (segundos) |

Ver `.env.example` para la lista completa.

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
npm run test:e2e -- --testPathPattern=process-timeseries
```

Filosofia:
- Testear solo via endpoints HTTP (no acceso directo a DB)
- PostgreSQL real via Testcontainers
- Mock solo servicios externos (RabbitMQ, hydro-api)
- Verificar via API: crear via POST, confirmar via GET

---

## Docker

### Desarrollo

```bash
docker compose up
```

### Produccion

```bash
docker build --target prod -t ms-predictions-api .
```

Dockerfile multi-stage: `dev` → `build` → `prod` (imagen minima con `dist/` + deps de produccion).

---

## Licencia

UNLICENSED
