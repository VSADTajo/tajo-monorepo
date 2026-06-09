# MS-SFTP — Microservicio de Gestion de Archivos SFTP

Microservicio NestJS para gestion de archivos con soporte SFTP, transformacion de formatos y servidor SFTP embebido.

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
| SFTP | ssh2 (cliente y servidor embebido) |
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
cd ms-sftp-api
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

Esto inicia la API, PostgreSQL, Redis y ejecuta migraciones automaticamente.

- **API**: http://localhost:3003
- **Swagger**: http://localhost:3003/docs
- **Frontend**: http://localhost:5173
- **Health**: http://localhost:3003/health

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

### Archivos Locales (`/files`)

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| `POST` | `/files/upload` | Subir archivo al storage local (multipart) |
| `GET` | `/files?directory=X` | Listar archivos de un directorio |
| `GET` | `/files/download?path=X` | Descargar archivo (con transformacion si hay schema activo) |
| `POST` | `/files/move` | Mover/renombrar archivo |
| `DELETE` | `/files?path=X` | Eliminar archivo |

### Cliente SFTP (`/sftp`)

Operaciones contra servidores SFTP **remotos**. Todos los endpoints reciben las credenciales de conexion en el body.

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| `POST` | `/sftp/list` | Listar archivos en servidor SFTP remoto |
| `POST` | `/sftp/download` | Descargar archivo desde SFTP remoto (stream) |
| `POST` | `/sftp/download-to-local` | Transferir archivo de SFTP remoto a storage local |
| `POST` | `/sftp/move` | Mover archivo en servidor SFTP remoto |
| `POST` | `/sftp/delete` | Eliminar archivo en servidor SFTP remoto |

### Mapping Schemas (`/mapping-schemas`)

Definen como se transforman los archivos al descargarlos (ej: XML a CSV).

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| `POST` | `/mapping-schemas` | Crear schema de mapeo |
| `GET` | `/mapping-schemas` | Listar todos los schemas |
| `GET` | `/mapping-schemas/:id` | Obtener schema por ID |
| `PUT` | `/mapping-schemas/:id` | Actualizar schema |
| `DELETE` | `/mapping-schemas/:id` | Eliminar schema |
| `PATCH` | `/mapping-schemas/:id/toggle` | Activar/desactivar schema |

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
│   │   ├── controllers/            # File, SFTP, MappingSchema
│   │   └── dtos/                   # Request/Response DTOs
│   │
│   ├── application/                # Casos de uso
│   │   ├── commands/               # Operaciones de escritura
│   │   ├── queries/                # Operaciones de lectura
│   │   ├── mappers/                # DTO <-> Command/Result
│   │   └── consumers/              # Consumidores RabbitMQ
│   │
│   ├── domain/                     # Logica de negocio
│   │   ├── entities/               # Entidades TypeORM
│   │   ├── value-objects/          # Tipos inmutables validados
│   │   ├── ports/                  # Clases abstractas (contratos DI)
│   │   ├── errors/                 # Jerarquia de errores
│   │   └── results/                # Objetos resultado
│   │
│   └── infrastructure/             # Adaptadores de salida
│       ├── cache/                  # CachingQueryBus + registry
│       ├── messaging/              # RabbitMQ service + registry
│       ├── persistence/            # Repositorios TypeORM
│       └── services/               # Servicios externos + SFTP server
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
            → Repositorio/Servicio (implementacion)
              → Result
    → Mapper.toResponseDto(result)
  → HTTP Response
```

---

## Transformacion de Archivos

Los **Mapping Schemas** definen como transformar archivos al descargarlos. Cuando un directorio tiene un schema activo, los archivos descargados se transforman automaticamente.

### Formatos soportados

| Input | Output |
|-------|--------|
| XML | CSV, JSON |
| CSV | JSON |
| Parquet | CSV, JSON |
| JSON | CSV |
| DAT | CSV |

### Flujo de transformacion

```
GET /files/download?path=forecast/data.xml
  → FileController descarga el archivo raw
  → Busca MappingSchema activo para el directorio "forecast/"
  → Si existe: transforma XML → CSV segun field mappings
  → Retorna archivo transformado con content-type y extension correctos
```

---

## Servidor SFTP Embebido

La app puede levantar un servidor SFTP (ssh2) para que terceros se conecten y dejen archivos sin usar la API REST.

### Configuracion

| Variable | Default | Descripcion |
|----------|---------|-------------|
| `SFTP_SERVER_ENABLED` | `false` | Habilitar servidor SFTP |
| `SFTP_SERVER_PORT` | `8212` | Puerto de escucha |
| `SFTP_SERVER_HOST_KEY_PATH` | `/data/sftp/host_key` | Ruta a llave privada del host |
| `SFTP_SERVER_AUTO_GENERATE_HOST_KEY` | `true` | Auto-generar llave ed25519 si no existe |
| `SFTP_SERVER_MAX_CONNECTIONS` | `10` | Maximo de conexiones concurrentes |
| `SFTP_SERVER_USERS` | `[]` | JSON con usuarios permitidos |

### Formato de usuarios

```json
[
  {
    "username": "vendor1",
    "password": "s3cret",
    "rootDirectory": "vendor1/inbox"
  },
  {
    "username": "vendor2",
    "publicKey": "ssh-ed25519 AAAA...",
    "rootDirectory": "vendor2/inbox"
  }
]
```

Cada usuario queda confinado (chroot) a su `rootDirectory` dentro de `STORAGE_BASE_PATH`.

### Uso

```bash
# Conectar al servidor SFTP embebido
sftp -P 8212 vendor1@localhost

# Subir un archivo
sftp> put archivo.xml
```

Los archivos quedan en `STORAGE_BASE_PATH/vendor1/inbox/`.

---

## Cache (Redis)

Las queries pasan por `CachingQueryBus` que consulta Redis antes de ir a la base de datos.

### Queries cacheadas

| Query | TTL | Cache Key |
|-------|-----|-----------|
| `ListFilesQuery` | 300s | `files:list:{directory}` |
| `ListMappingSchemasQuery` | 600s | `mapping-schemas:list` |
| `GetMappingSchemaByIdQuery` | 600s | `mapping-schemas:{id}` |
| `GetActiveMappingSchemaByPathQuery` | 300s | `mapping-schemas:active:{path}` |

### Invalidacion

Los command handlers invalidan automaticamente las cache keys relevantes despues de cada mutacion (create, update, delete, toggle, upload, move).

### Variables de entorno

| Variable | Default | Descripcion |
|----------|---------|-------------|
| `REDIS_HOST` | `127.0.0.1` | Host Redis |
| `REDIS_PORT` | `6379` | Puerto Redis |
| `REDIS_DEFAULT_TTL` | `300` | TTL default en segundos |

---

## Mensajeria (RabbitMQ)

La app puede correr como **aplicacion hibrida**: servidor HTTP + consumidor RabbitMQ en el mismo proceso.

### Variables de entorno

| Variable | Default | Descripcion |
|----------|---------|-------------|
| `RABBITMQ_ENABLED` | `false` | Habilitar RabbitMQ |
| `RABBITMQ_HOST` | `127.0.0.1` | Host |
| `RABBITMQ_PORT` | `5672` | Puerto |
| `RABBITMQ_USER` | `guest` | Usuario |
| `RABBITMQ_PASSWORD` | `guest` | Password |
| `RABBITMQ_PREFETCH` | `10` | Mensajes concurrentes por consumidor |

---

## Configuracion Completa

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
| `STORAGE_BASE_PATH` | `/data/files` | Directorio base de storage |
| `STORAGE_MAX_FILE_SIZE` | `524288000` | Tamano maximo de archivo (500MB) |
| `SFTP_CONNECTION_TIMEOUT` | `10000` | Timeout conexion SFTP cliente (ms) |
| `SFTP_OPERATION_TIMEOUT` | `60000` | Timeout operacion SFTP cliente (ms) |

Ver `.env.example` para la lista completa incluyendo Redis, RabbitMQ y SFTP Server.

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
npm run test:e2e -- --testPathPattern=sftp-list-files
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

Servicios:
- **ms-sftp-api** — API NestJS (puerto 3003)
- **ms-sftp-frontend** — Frontend Vite (puerto 5173)
- **ms-sftp-db** — PostgreSQL 16 (puerto 5435)

### Produccion

```bash
docker build --target prod -t ms-sftp-api .
```

Dockerfile multi-stage: `dev` → `build` → `prod` (imagen minima con `dist/` + deps de produccion).

---

## Licencia

UNLICENSED
