# MS-Model — Microservicio de Ingestion de Datos Meteorologicos

Microservicio NestJS para ingestion automatizada de datos de modelos meteorologicos (Harmonie, EPS) desde archivos Delft-FEWS via SFTP. Gestiona proveedores de datos, ejecuta polling programado y publica series temporales normalizadas via RabbitMQ.

## Stack Tecnologico

| Capa | Tecnologia |
|------|-----------|
| Runtime | Node.js >= 22 |
| Framework | NestJS 11 |
| Lenguaje | TypeScript 5.7+ (strict mode) |
| Base de datos | PostgreSQL 16 via TypeORM 0.3 |
| CQRS | @nestjs/cqrs 11 |
| Cache | Redis 7 via ioredis + CachingQueryBus |
| Mensajeria | RabbitMQ 3.13 via amqplib (productor) |
| Scheduler | @nestjs/schedule (polling configurable) |
| HTTP Client | axios |
| Testing | Jest + Supertest + Testcontainers |
| API Docs | Swagger (OpenAPI) |

## Prerequisitos

- **Node.js** >= 22 (ver `.nvmrc`)
- **Docker** & **Docker Compose**
- **npm** >= 10.5
- **ms-sftp-api** corriendo (para ingestion de archivos)

## Inicio Rapido

### 1. Clonar e instalar

```bash
git clone <repository-url>
cd ms-model-api
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

- **API**: http://localhost:3004
- **Swagger**: http://localhost:3004/docs
- **Health**: http://localhost:3004/health

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

### Provider Configs (`/provider-configs`)

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| `POST` | `/provider-configs` | Crear configuracion de proveedor |
| `GET` | `/provider-configs` | Listar todos los proveedores |
| `GET` | `/provider-configs/:id` | Obtener proveedor por ID |
| `PUT` | `/provider-configs/:id` | Actualizar proveedor |
| `PATCH` | `/provider-configs/:id/toggle` | Activar/desactivar proveedor (y su cron) |
| `POST` | `/provider-configs/:id/trigger` | Disparar ingestion manual inmediata |
| `DELETE` | `/provider-configs/:id` | Eliminar proveedor |

### WISKI Catalog (`/wiski-catalog`)

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| `GET` | `/wiski-catalog` | Listar el catalogo de variables WISKI |
| `POST` | `/wiski-catalog/sync` | Sembrar el catalogo desde el CSV de WISKI (SFTP o `csvText`) |

### Ingestion Runs (`/ingestion-runs`)

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| `GET` | `/ingestion-runs` | Listar ejecuciones (filtro opcional por `providerConfigId`) |
| `GET` | `/ingestion-runs/:id` | Obtener ejecucion por ID |

Documentacion completa con esquemas request/response en `/docs` (Swagger UI).

---

## Flujo de Ingestion

```
1. Cron (ProviderSchedulerService)
   → Cada N minutos por proveedor activo (pollingIntervalMinutes)

2. TriggerIngestionHandler
   → Crea IngestionRun con status RUNNING
   → Llama al DataProvider (SftpFileProviderService)

3. SftpFileProviderService
   → GET ms-sftp-api/files?directory=X         (listar archivos)
   → GET ms-sftp-api/files/download?path=X     (descargar JSON)
   → Parsea formato Delft-FEWS → NormalizedTimeSeries
   → DELETE ms-sftp-api/files?path=X           (borrar archivo procesado)

4. Publicacion RabbitMQ
   → Exchange: model-events
   → Routing key: timeseries.ingested
   → Payload: { providerName, series[] }

5. Actualizacion IngestionRun
   → status: SUCCESS, seriesCount, eventsCount
```

### Tipos de proveedor

| `type` | Transporte | Que lee |
|--------|-----------|---------|
| `SFTP_FILE` | fichero en el SFTP | JSON PI (`Q_mod_input_*.json`) |
| `CSV_FILE` | fichero en el SFTP | CSV de WISKI (`Tagus_FlowCast*.csv`) |
| `FEWS_API` | HTTP GET | PI-JSON del PI REST de FEWS |
| `WISKI_API` | HTTP GET | Observados del servicio WISKI de la CH Tajo |

`WISKI_API` lee los mismos datos que `CSV_FILE` pero yendo a buscarlos por HTTP en vez de esperar
el fichero en el SFTP. Los dos producen el mismo `(locationId, parameterId)`, asi que activar uno y
desactivar el otro cambia el origen sin tocar nada aguas abajo.

El endpoint devuelve la estacion y la serie concatenadas en un unico campo
(`E_08` + `VICT01.Validado` -> `E_08VICT01.Validado`) y sin nombre de estacion, unidades ni
coordenadas: eso lo resuelve la tabla `wiski_variable_catalog`, sembrada desde el CSV via
`POST /wiski-catalog/sync`. Sin catalogo la variable se parte por su gramatica y la corrida lo
avisa en el log (`derivedCount`).

### Ejemplo de Provider Config

```json
{
  "name": "Harmonie Pluviometria",
  "type": "SFTP_FILE",
  "baseUrl": "http://ms-sftp-api:3003",
  "settings": {
    "filePath": "predicciones/pluvio",
    "filePrefix": "Harmonie"
  },
  "pollingIntervalMinutes": 360
}
```

```json
{
  "name": "WISKI Observados (API)",
  "type": "WISKI_API",
  "baseUrl": "https://apisaih.saihchtajo.es",
  "settings": {
    "endpointPath": "/wiski/tagus_flowcast_observado/",
    "sourceTimezone": "Europe/Madrid",
    "onUnknownVariable": "heuristic"
  },
  "pollingIntervalMinutes": 60
}
```

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
│   │   ├── controllers/            # ProviderConfig, IngestionRun
│   │   └── dtos/                   # Request/Response DTOs
│   │
│   ├── application/                # Casos de uso
│   │   ├── commands/               # ProviderConfig CRUD, TriggerIngestion
│   │   ├── queries/                # Listados y consultas
│   │   └── mappers/                # DTO <-> Command/Result
│   │
│   ├── domain/                     # Logica de negocio
│   │   ├── entities/               # ProviderConfig, IngestionRun
│   │   ├── value-objects/          # PollingInterval
│   │   ├── ports/                  # IDataProvider, repositorios
│   │   ├── errors/                 # Jerarquia de errores
│   │   └── results/                # NormalizedTimeSeries, etc.
│   │
│   └── infrastructure/             # Adaptadores de salida
│       ├── cache/                  # CachingQueryBus + registry
│       ├── messaging/              # RabbitMQ (topics: model-events)
│       ├── persistence/            # Repositorios TypeORM
│       └── services/               # SftpFileProvider, FewsApiProvider, Scheduler
│
├── common/                         # Excepciones, pipes, decoradores
├── configuration/                  # App, DB, Redis, RabbitMQ, SFTP, FEWS
├── health/                         # Health check (Terminus)
├── swagger/                        # Swagger + decoradores
└── migrations/                     # Migraciones SQL
```

---

## Cache (Redis)

| Query | TTL | Cache Key |
|-------|-----|-----------|
| `ListProviderConfigsQuery` | 300s | `provider-config:list` |
| `GetProviderConfigByIdQuery` | 60s | `provider-config:{id}` |

### Invalidacion

Los command handlers invalidan automaticamente las cache keys despues de cada mutacion.

---

## Mensajeria (RabbitMQ)

### Eventos publicados

| Exchange | Routing Key | Descripcion |
|----------|-------------|-------------|
| `model-events` | `timeseries.ingested` | Series temporales normalizadas listas para procesamiento |

El evento `timeseries.ingested` es consumido por **ms-predictions-api** para generar predicciones, simulaciones y notificaciones de umbral.

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
| `SFTP_API_BASE_URL` | `http://localhost:3003` | URL de ms-sftp-api |
| `FEWS_API_BASE_URL` | `http://localhost:8080` | URL de FEWS API (reservado) |
| `WISKI_API_BASE_URL` | *(vacio)* | Raiz del servicio WISKI; solo resuelve dentro de la red de la CH Tajo |
| `WISKI_API_PATH` | `/wiski/tagus_flowcast_observado/` | Path del recurso de observados |
| `WISKI_API_TIMEZONE` | `Europe/Madrid` | Zona horaria asumida de `lastchange` (el JSON no trae offset) |
| `WISKI_API_REQUEST_TIMEOUT_MS` | `120000` | Timeout de la peticion |
| `WISKI_API_MAX_RESPONSE_BYTES` | `52428800` | Tope del cuerpo de respuesta |

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
npm run test:e2e -- --testPathPattern=create-provider
```

Filosofia:
- Testear solo via endpoints HTTP (no acceso directo a DB)
- PostgreSQL real via Testcontainers
- Mock solo servicios externos (SFTP, RabbitMQ)
- Verificar via API: crear via POST, confirmar via GET

---

## Docker

### Desarrollo

```bash
docker compose up
```

### Produccion

```bash
docker build --target prod -t ms-model-api .
```

Dockerfile multi-stage: `dev` → `build` → `prod` (imagen minima con `dist/` + deps de produccion).

---

## Licencia

UNLICENSED
