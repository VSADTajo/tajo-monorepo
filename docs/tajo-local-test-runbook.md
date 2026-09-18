# Probar el stack completo en un host limpio (`tajo up`)

Simula lo que hará el cliente: una máquina/VM virgen con Docker → un comando → el
stack entero andando desde imágenes GHCR. Correlo en tu máquina (host limpio),
que hace las veces de "VM del cliente".

## 1. Requisitos

- Docker + docker compose v2.
- ~8 GB de RAM libres (15 servicios + 8 Postgres + Mongo/Redis/RabbitMQ).
- Acceso de lectura a las imágenes GHCR (`docker login`).

## 2. Clonar + branch

```bash
git clone <monorepo-url> tajo-monorepo
cd tajo-monorepo
git checkout feature/tajo-cli
```

## 3. Configurar el `.env`

```bash
cp infra/.env.example infra/.env
```

Editá `infra/.env`. Mínimo para arrancar:

```ini
JWT_SECRET=cualquier-secreto
X_API_KEY=cualquier-secreto            # AGREGAR: falta en el .env.example
POSTGRES_USER=postgres
POSTGRES_PASSWORD=secret
MONGO_INITDB_ROOT_USERNAME=root
MONGO_INITDB_ROOT_PASSWORD=secret
MONGO_URI=mongodb://root:secret@infra-mongo-logs:27017/apilogs?authSource=admin
RABBITMQ_USER=guest
RABBITMQ_PASSWORD=guest

# URLs públicas — en la prueba local apuntan a localhost (el browser corre acá):
PUBLIC_API_URL=http://localhost:3000
PUBLIC_LOGS_API_URL=http://localhost:3004

# Imágenes GHCR — TAG lo lee `bin/tajo` de infra/version.env por default
# (bumpeado en cada release). Setear acá SOLO para probar un tag específico:
REGISTRY=ghcr.io/vsadtajo
# TAG=v2026.09.17.42
```

## 4. Login a GHCR (para poder pull)

```bash
echo <GHCR_TOKEN> | docker login ghcr.io -u <github-user> --password-stdin
```

## 5. Levantar

```bash
bin/tajo up          # crea infra-network, pull de GHCR, compose up
```

## 6. Migraciones (primera vez)

```bash
bin/tajo migrate     # corre las migraciones TypeORM en cada servicio con DB
```

## 7. Verificar (smoke test)

```bash
bin/tajo status
curl -s localhost:3000/health       # gateway  -> {"status":"ok",...}
curl -s localhost:3004/api/health   # logs-api  (Express)
curl -s localhost:3011/health       # calculator (Python)
```

Frontends en el browser:

| URL | Frontend | Portable? |
|-----|----------|-----------|
| http://localhost:8080 | vsad-tajo-frontend | ✅ runtime config |
| http://localhost:3005 | logs-ui | ✅ runtime config |
| http://localhost:5174 | sftp-frontend | ✅ runtime config |

Los tres frontends leen sus URLs en runtime (envsubst en el arranque), así que
apuntan al gateway local con la config del `.env` — sin rebuild.

## Nota sobre `vsad-tajo-frontend`

Su imagen GHCR portable todavía no está publicada (la migración vive en la branch
`feature/ghcr-runtime-config` de su repo, sin mergear a main). Para incluirlo en la
prueba, buildealo local y tagealo como lo espera el compose:

```bash
git clone -b feature/ghcr-runtime-config \
    git@github-tajo:VSADTajo/vsad-tajo-frontend.git /tmp/vtf
docker build --target prod -t ghcr.io/vsadtajo/vsad-tajo-frontend:${TAG:-latest} /tmp/vtf
```

Con la imagen ya presente localmente, `tajo up` la usa (el pull la ignora si ya
existe). Los otros dos frontends salen directo de GHCR.

## Notas generales
- Bajar todo: `bin/tajo down` (con `-v` borra también los volúmenes/datos, pide
  confirmación).
- Ver logs: `bin/tajo logs [servicio]`.
