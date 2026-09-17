# Guía de despliegue — VSAD Tajo en una VM nueva (cliente)

Instalación del stack completo (14 servicios + GeoServer + infra) en una máquina
virgen con Docker, desde imágenes GHCR, con el CLI `bin/tajo`. Pensada para la VM
del cliente o cualquier host limpio.

---

## 1. Requisitos de la VM

- Linux con **Docker Engine** + plugin **docker compose v2**.
- **~8 GB de RAM** libres y **~40 GB de disco** (imágenes + volúmenes de datos).
- Acceso de red de salida a `ghcr.io` (imágenes) y `docker.osgeo.org` (GeoServer).
- Un **GitHub PAT** con scope `read:packages` que tenga acceso a los packages de la
  organización `VSADTajo` (para pull de GHCR).

## 2. Clonar el repo

```bash
git clone <URL-del-monorepo> tajo
cd tajo
```

## 3. Configurar el `.env`

```bash
cp infra/.env.example infra/.env
$EDITOR infra/.env
```

Valores a definir (los `PUBLIC_*` son la **cara pública del cliente** — su dominio
o IP; de acá salen las URLs que se inyectan en los frontends en runtime):

| Variable | Ejemplo | Notas |
|----------|---------|-------|
| `POSTGRES_USER` / `POSTGRES_PASSWORD` | `postgres` / `<secreto>` | credenciales de todas las Postgres |
| `MONGO_INITDB_ROOT_USERNAME` / `..._PASSWORD` | `root` / `<secreto>` | Mongo de logs |
| `MONGO_URI` | `mongodb://root:<secreto>@infra-mongo-logs:27017/apilogs?authSource=admin` | usar el mismo password |
| `RABBITMQ_USER` / `RABBITMQ_PASSWORD` | `guest` / `<secreto>` | |
| `JWT_SECRET` | `<secreto largo>` | **obligatorio** |
| `X_API_KEY` | `<secreto>` | **obligatorio** (auth interna) |
| `ALLOWED_ORIGINS` | `https://tajo.cliente.com` | CORS del user-api (NO dejar `*` en prod) |
| `PUBLIC_API_URL` | `https://tajo.cliente.com` | gateway público (frontends) |
| `PUBLIC_LOGS_API_URL` | `https://tajo.cliente.com:3004` | logs-api público |
| `PUBLIC_GEOSERVER_URL` | `https://tajo.cliente.com:8085/geoserver` | geoserver público |
| `AEMET_API_KEY` | `<key AEMET>` | ingesta meteo |
| `REGISTRY` | `ghcr.io/vsadtajo` | dejar por defecto |
| `TAG` | **no setear en `.env`** | vive en `infra/version.env`, pineado por CI. Sólo overridear en `.env` para rollback puntual (ej. `TAG=v2026.09.10.42`). |

## 4. Login a GHCR

```bash
echo <TU_GITHUB_PAT> | docker login ghcr.io -u <tu-usuario-github> --password-stdin
```

## 5. Levantar el stack

```bash
bin/tajo up          # crea la red, pull de GHCR, levanta todo
```

## 6. Migraciones (primera vez)

```bash
bin/tajo migrate     # crea el schema en cada servicio con DB
```

## 7. Cargar datos iniciales de GeoServer (una vez)

`ms-hydro-api` y `ms-meteo-api` consultan capas espaciales de la base PostGIS de
GeoServer (p. ej. `cht_puntos_saih`). En una instalación limpia hay que sembrar
esos datos con un dump provisto por el equipo:

```bash
# 1. dump desde un entorno con datos (una vez, por el equipo):
docker exec infra-db-geoserver pg_dump -U postgres geoserver_db > geoserver-seed.sql

# 2. cargar en la VM del cliente:
docker exec -i infra-db-geoserver psql -U postgres -d geoserver_db < geoserver-seed.sql
bin/tajo restart ms-hydro-api ms-meteo-api
```

> Además, la data de GeoServer (workspaces/layers) vive en el volumen
> `tajo_geoserver-data`; si el cliente necesita las capas ya publicadas, copiar
> también `/opt/geoserver/` (ver `bin/tajo backup`/`restore`).

## 8. Verificar

```bash
bin/tajo status
curl -s http://localhost:3000/health        # gateway
curl -s http://localhost:3004/api/health     # logs-api (Express)
curl -s http://localhost:3011/health         # calculator (Python)
```

| Componente | URL |
|------------|-----|
| Frontend (Vue) | `http://<host>:8080` |
| Logs UI | `http://<host>:3005` |
| SFTP / Mapping Engine UI | `http://<host>:5174` |
| GeoServer | `http://<host>:8085/geoserver` |

---

## Operación

```bash
bin/tajo logs [servicio]         # tail de logs
bin/tajo restart <servicio>      # reiniciar uno
bin/tajo status                  # estado + health
TAG=v1.2.3 bin/tajo up           # fijar/rollback a una versión concreta
bin/tajo backup                  # tar de todos los volúmenes -> backups/<ts>/
bin/tajo restore backups/<ts>/   # restaurar datos
bin/tajo down                    # parar (con -v también borra los volúmenes)
```

### Actualizar a la última versión

La versión pineada de la plataforma vive en `infra/version.env` (managed por
`infra/Jenkinsfile.release`, bumpeado en cada merge a main con `TAG=vYYYY.MM.DD.N`).

```bash
git pull             # trae el nuevo TAG en infra/version.env
bin/tajo doctor      # (recomendado) valida GHCR login, imágenes disponibles, .env
bin/tajo up          # pull del set completo pineado + recrea lo que cambió
bin/tajo migrate     # sólo si anunciamos migraciones nuevas
```

### Auto-update por cron (recomendado en VMs de cliente)

Un cron que combina `git pull` (para traer la nueva versión pineada) con
`bin/tajo up`:

```bash
# /etc/cron.d/tajo-autoupdate  (o `sudo crontab -e`)
*/10 * * * * root cd /opt/tajo && git pull --quiet && /opt/tajo/bin/tajo up >> /var/log/tajo-autoupdate.log 2>&1
```

Cuando publicamos un release, `Jenkinsfile.release` hace commit al monorepo
bumpeando `infra/version.env`. El próximo `git pull` del cron trae ese commit,
`bin/tajo up` levanta el nuevo TAG. Si no hubo release desde la última corrida,
`git pull` no trae nada y `bin/tajo up` confirma que ya está actualizado.

- Log de auditoría: `/var/log/tajo-autoupdate.log`.
- Un pull fallido (`unauthorized`, red caída) aborta la corrida con mensaje
  visible en el log — no hay updates silenciosos con imagen vieja.
- Migraciones **no** están en el cron. Cuando anunciamos un cambio de
  esquema, hay que correr `bin/tajo migrate` a mano.

Alternativa activa (push desde Jenkins) requiere exponer un SSH inbound
en la VM del cliente y wire de `CLIENT_HOSTS` en los `Jenkinsfile` — más
complejo y con menos aislamiento; sólo tiene sentido si el SLA exige
propagación en segundos.

## Troubleshooting

- **`unauthorized` al hacpull**: falta `docker login ghcr.io` con un PAT que tenga
  `read:packages` y acceso a la org.
- **Un servicio reinicia con `EnvVariablesValidator ... failed`**: falta una env en
  `infra/.env` — el mensaje dice cuál.
- **`hydro`/`meteo` no llegan a healthy**: falta el seed de GeoServer (paso 7).
- **Postgres con password viejo tras cambiarlo**: el password sólo aplica en la
  primera inicialización del volumen; ver `.claude/rules/04-infrastructure.md`.
