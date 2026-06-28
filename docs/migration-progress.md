# Server migration — progress log

State of the work to package the VSAD Tajo platform into a single, portable Docker stack that any new VM can run with one command. Living document — update as we go.

## Goal

Migrate the platform from the current Hetzner VM (65.21.97.113) to a new client VM. End state: a fresh Ubuntu host runs the full system after `bootstrap.sh + edit .env + tajo up`.

## Decisions taken (locked)

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | **Image registry**: GHCR (`ghcr.io/vsadtajo/<service>`) via GitHub Actions | Free, integrated with the repo, decouples build from the VM |
| 2 | **Frontend env vars**: build-time (current behavior, baked into image) | Simpler; trade-off is one image per environment, accepted |
| 3 | **GeoServer**: bundled in `docker-compose.apps.yml` (single `tajo up` brings everything up) | Single host, single lifecycle |
| 4 | **Jenkins**: drop on the new VM. GH Actions handles build + deploy via SSH | Removes duplicate CI/CD, ~2GB RAM, public :9080 attack surface. JCasC means we can resurrect Jenkins in ~30 min if needed. |

## What's done

11 new files in this branch:

```
infra/
├── .env.example                       # unified env template
├── docker-compose.base.yml            # 8 Postgres + Redis + RabbitMQ + Mongo + healthchecks + volumes
├── docker-compose.apps.yml            # 11 backends + frontend + GeoServer; pulls from ${REGISTRY}/<svc>:${TAG}
├── docker-compose.dev.yml             # local-build override (target: dev, bind mounts, hot reload)
├── docker-compose.prod.yml            # prod override (pull_policy: always, log rotation)
├── postgres/init-extensions.sql       # uuid-ossp + pgcrypto
├── postgres/init-postgis.sql          # + PostGIS for geoserver + meteo DBs
└── README.md                          # quick start

bin/tajo                               # CLI: up/down/logs/status/restart/pull/build/shell/migrate/psql/backup/restore

.github/workflows/build-and-push.yml   # matrix per service → GHCR (tags :latest, :main, :sha-X, :vX.Y.Z)

docs/migration-runbook.md              # step-by-step playbook (fresh VM + data-migration variant)
docs/migration-progress.md             # this file
```

Validated locally:
- `bash -n bin/tajo` → syntax OK
- `docker compose ... config --quiet` → prod merge valid
- `docker compose ... config --quiet` → dev merge valid
- `bin/tajo help` → runs

## Production audit findings (from `ssh root@65.21.97.113`)

Captured while inspecting the live VM. These need to be reflected in the new compose before it's a true drop-in:

1. **Production currently runs `target: dev`** — hot-reload + bind mounts + `npm run start:dev` in prod. My compose uses real prod images; that's an upgrade, not a 1:1 mirror.
2. **Volume name prefix is `infra_`** on the live VM (e.g. `infra_pg-user-data`, `infra_mongo-logs-data`, `infra_sftp-storage`). My compose uses default project `tajo_*`. Backup/restore won't match without aligning.
3. **DB env var names differ**: live uses `DB_USER`, `DB_SFTP`, `DB_PREDICTIONS`, `DB_HYDRO`, `DB_MODEL`, `DB_NOTIFICATIONS`, `DB_METEO`, `DB_GEOSERVER`, `MONGO_DB`. My `.env.example` uses `DB_USER_DATABASE` etc. Services read the live names.
4. **Missing service**: `sftp-frontend` (the Mapping Engine UI for ms-sftp-api) runs as a separate container in prod (`:5174`), not bundled inside the backend image as the docs imply.
5. **Missing env vars** in my `.env.example`:
   - `X_API_KEY` — used across services for inter-service auth
   - `SMTP_USER`, `SMTP_PASSWORD` — ms-logs-api alert emails (Gmail)
   - `AEMET_API_KEY`, `AEMET_BASE_URL`, `AEMET_DEFAULT_AREA` — ms-meteo-api
   - `METEO_*` family (`METEO_SYNC_CRON`, `METEO_RETENTION_CRON`, `METEO_RETENTION_DAYS`, `METEO_RETENTION_MODE`, `METEO_INGEST_CONCURRENCY`, `METEO_BASE_PATH`, `METEO_GEOTIFF_DIR`)
   - `GEOSERVER_DB_*` — ms-hydro-api + ms-meteo-api write to the GeoServer DB cross-service
   - `STORAGE_BASE_PATH`, `STORAGE_MAX_FILE_SIZE`, `SFTP_CONNECTION_TIMEOUT`, `SFTP_OPERATION_TIMEOUT` — ms-sftp-api
   - `SFTP_API_INTERNAL_CALLER` — ms-meteo-api → ms-sftp-api
   - `HYDRO_API_BASE_URL` for ms-predictions-api
   - `FEWS_API_BASE_URL` for ms-model-api
6. **Port mappings on prod**:
   - `ms-gateway-api`: `80:3000` (public HTTP on port 80, no reverse proxy)
   - `vsad-tajo-geoserver`: `443:8080` (port 443 — likely TLS terminated upstream by Cloudflare, or HTTP-on-443; needs confirmation)
   - `sftp-frontend`: `5174:80`
   - DBs and brokers: bound to `127.0.0.1` (loopback only)
7. **GeoServer image** in prod is custom (`vsad-tajo-geoserver`), built from the separate `VSADTajo/vsad_tajo_geoserver` repo. Not the vanilla `docker.osgeo.org/geoserver:2.24.2` I used. Need to decide: ship that custom image as another GHCR package, or use vanilla + mount `/opt/geoserver/geoserver_data`.
8. **Image accumulation**: dozens of `<branch>-<sha>` tags pile up (`ms-predictions-api` alone has 10+ × 721MB). Disk is at 73% / 436GB. Need a `tajo gc` command.
9. **Persistent volumes** for Redis and RabbitMQ are missing from the live compose (data is lost on container restart). My new compose adds them.
10. **GeoServer data**: `/opt/geoserver/datasets` and `/opt/geoserver/geoserver_data` are bind-mounted from the host (not in volumes). Migration plan must `rsync` these dirs to the new VM.

## Pending — refactor checklist

Before this is shippable to a client VM:

- [ ] **Align volume names** — set `COMPOSE_PROJECT_NAME=infra` (or rename volumes explicitly) so backup/restore works between OLD and NEW hosts
- [ ] **Rename DB env vars** in `.env.example` and in `docker-compose.apps.yml` to match prod (`DB_USER`, `DB_SFTP`, etc.)
- [ ] **Add `sftp-frontend`** service to `docker-compose.apps.yml`
- [ ] **Complete `.env.example`** with all the vars listed in item 5 above
- [ ] **Fix port mappings**: `ms-gateway-api` → `80:3000`; configurable via `GATEWAY_PUBLIC_PORT` for client VMs that want a different port
- [ ] **GeoServer**: either (a) add `vsad-tajo-geoserver` to the GHCR build matrix and use that, or (b) use vanilla GeoServer + host bind mounts for `/opt/geoserver/{datasets,geoserver_data}`
- [ ] **`tajo gc`** subcommand — `docker image prune` scoped to GHCR images older than N tags
- [ ] **`docker-compose.proxy.yml`** with Caddy in front (TLS via Let's Encrypt) — optional, for client VMs without their own reverse proxy
- [ ] **`infra/bootstrap.sh`** — fresh-Ubuntu → ready-to-up. Installs Docker, creates `deploy` user, makes `/opt/tajo` + `/opt/geoserver/*`, clones repo, copies `.env.example` → `.env`
- [ ] **`.github/workflows/deploy.yml`** — SSH-based deploy from GH Actions to the VM. Triggered by `workflow_run` after build-and-push completes.
- [ ] **Update `docs/migration-runbook.md`** to reflect the corrected port mappings, volume names, and GeoServer setup decision.

## Future / optional

- Replace SSH-deploy with self-hosted runner on the VM (if outbound-only is preferred to inbound SSH from GH)
- Off-host backups: rsync `backups/` to S3/B2 via cron
- Multi-host HA: migrate compose → Swarm (`docker stack deploy`) — out of scope for current client
- Resource limits per service (`deploy.resources.limits`) — pending real-world memory profiling

## How to pick this up next session

1. Read this file end to end.
2. Skim `docs/migration-runbook.md` for the conceptual flow.
3. Pick items from "Pending — refactor checklist" in order. Each is independent and small.
4. Most likely next move: **align volume + env var names** (items 1 + 2), since everything else depends on those.

## Useful one-liners

```bash
# audit current production state (read-only)
ssh root@65.21.97.113 'docker ps; docker volume ls'

# validate the unified compose locally
cp infra/.env.example infra/.env
docker compose -p tajo -f infra/docker-compose.base.yml -f infra/docker-compose.apps.yml -f infra/docker-compose.prod.yml config --quiet && echo OK

# try the CLI
bin/tajo help
TAJO_MODE=dev bin/tajo build vsad-tajo-frontend
```
