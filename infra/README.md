# infra — unified Docker stack

Single source of truth for running the VSAD Tajo platform via Docker Compose. Combined with the `bin/tajo` CLI at the repo root, it gives you one command to bring up (or migrate) the whole system on any host with Docker installed.

## TL;DR

```bash
cd /path/to/tajo-monorepo

# 1. Customize secrets
cp infra/.env.example infra/.env
$EDITOR infra/.env

# 2. (Production only) Authenticate to GHCR so docker can pull images
echo "$GHCR_TOKEN" | docker login ghcr.io -u <github-user> --password-stdin

# 3. Bring everything up
bin/tajo up                # default = production mode, pulls images from GHCR
bin/tajo up --dev          # local build with hot-reload (no GHCR required)

# 4. Check health
bin/tajo status
```

## File map

| File | Purpose |
|------|---------|
| `.env.example` | Template — copy to `.env` and customize. Single env source for the whole stack. |
| `docker-compose.base.yml` | Data stores: Redis, RabbitMQ, MongoDB, 8 Postgres instances (one per service). Volumes are named & persistent. |
| `docker-compose.apps.yml` | All application services + GeoServer + frontend. Pulls images from `${REGISTRY}/<svc>:${TAG}` by default. |
| `docker-compose.prod.yml` | Prod override: `pull_policy: always`, `restart: always`, bounded log files. |
| `docker-compose.dev.yml` | Dev override: builds locally with `target: dev`, bind-mounts source for hot-reload, runs migrations on start. |
| `postgres/init-extensions.sql` | Loaded once per Postgres DB to enable `uuid-ossp` + `pgcrypto`. |
| `postgres/init-postgis.sql` | Same for the GeoServer + meteo PostGIS DBs. |

## What `tajo up` actually runs

```text
docker compose \
    -p tajo \
    -f infra/docker-compose.base.yml \
    -f infra/docker-compose.apps.yml \
    -f infra/docker-compose.<dev|prod>.yml \
    up -d
```

Compose merges the files in order — `apps.yml` defines image-based services, the override swaps in `build:` for dev or tightens prod settings.

## Network

A single `infra-network` bridge connects every container. Service discovery is by container name (e.g. `http://ms-user-api:3001`, `redis://infra-redis:6379`).

## Volumes (persisted on host)

Named under the compose project (`tajo`) — survive `tajo down`, wiped only by `tajo down -v` (with confirmation).

```
tajo_db-user-data           tajo_db-sftp-data            tajo_db-predictions-data
tajo_db-hydro-data          tajo_db-model-data           tajo_db-notifications-data
tajo_db-meteo-data          tajo_db-geoserver-data
tajo_mongo-logs-data        tajo_redis-data              tajo_rabbitmq-data
tajo_sftp-files             tajo_sftp-keys               tajo_logs-files-results
tajo_geoserver-data
```

Back up with `tajo backup`, restore with `tajo restore backups/<timestamp>/`.

## Switching environments

The image tag is controlled by `TAG` in `.env` (or inline):

```bash
TAG=v1.2.3 bin/tajo up        # pin to a release
TAG=sha-a1b2c3d bin/tajo up   # roll back to a specific commit
```

## Adding a new service

1. Add the service to `docker-compose.apps.yml`, reusing the `*common-db-env` / `*common-infra-env` anchors.
2. If it owns a Postgres, add a new instance to `docker-compose.base.yml` (next port in the 543X range).
3. Add a matrix entry in `.github/workflows/build-and-push.yml` so its image gets built and pushed.
4. Update `bin/tajo` arrays (`NEST_DB_SERVICES`, `db_container_for`, `db_name_for`) if the new service has a DB.
5. Update `.claude/rules/01-global.md` + `.claude/rules/04-infrastructure.md` so the docs match.

## Troubleshooting

See `docs/migration-runbook.md` for the full migration playbook, including rollback procedure and the Postgres password-desync gotcha.
