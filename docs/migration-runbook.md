# VSAD Tajo — server migration runbook

This is the canonical, end-to-end procedure for bringing the platform up on a fresh server (and for moving it from one server to another while preserving data). It assumes the unified Docker stack under `infra/` and the `bin/tajo` CLI.

## Topology

```
┌──────────────────────────────────────────────────────────────────────────┐
│  any Linux host with Docker 24+ and the compose v2 plugin                │
│  ┌──────────────────┐  ┌───────────────────┐                             │
│  │ infra-network    │  │ named volumes     │  ← all data lives here      │
│  │  (bridge)        │  │ (tajo_db-*-data,  │                             │
│  └──┬──────────┬────┘  │  tajo_redis-data, │                             │
│     │          │       │  …)               │                             │
│  ┌──▼──┐  ┌────▼────┐  └───────────────────┘                             │
│  │ 11  │  │ 8 PG +  │                                                    │
│  │ apps│  │ Mongo + │   one DB per service; Redis & RabbitMQ shared.     │
│  │     │  │ Redis + │   GeoServer on 8085. Frontend (nginx) on 8080.     │
│  └─────┘  │ RabbitMQ│   Gateway on 3000. SFTP also on 8212.              │
│           └─────────┘                                                    │
└──────────────────────────────────────────────────────────────────────────┘
```

Single host, three layers: data stores → apps → frontend. Images come from GHCR. Data lives in named volumes — back them up and you can move the platform to any host.

---

## Part A — fresh server (no existing data)

### A.1 Provision the host

Minimum recommended specs for the full stack: **4 vCPU / 16 GB RAM / 80 GB disk**. Ubuntu 22.04 or 24.04.

Install Docker + the compose plugin:

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER     # log out & back in for the group change
docker compose version             # must print v2.x
```

Optional but recommended: `ufw` open only the ports you need (3000 gateway, 8080 frontend, 8085 GeoServer, 8212 SFTP, 22 ssh).

### A.2 Clone the monorepo

```bash
sudo mkdir -p /opt && sudo chown $USER:$USER /opt
git clone https://github.com/VSADTajo/tajo-monorepo.git /opt/tajo
cd /opt/tajo
```

### A.3 Configure secrets

```bash
cp infra/.env.example infra/.env
$EDITOR infra/.env
```

At minimum, change:
- `POSTGRES_PASSWORD` — root for every Postgres.
- `MONGO_INITDB_ROOT_PASSWORD` + reflect it in `MONGO_URI`.
- `JWT_SECRET` — long random string.
- `GEOSERVER_ADMIN_PASSWORD`.
- `PUBLIC_API_URL` + `PUBLIC_GEOSERVER_URL` — the public hostnames clients will use.
- `REGISTRY` + `TAG` — leave `ghcr.io/vsadtajo` + `latest` unless you're using a private registry or pinning a version.

### A.4 Authenticate to GHCR

If the GHCR packages are public, skip this. Otherwise:

```bash
# Create a fine-grained PAT with `read:packages` scope at
# https://github.com/settings/tokens, then:
echo "$GHCR_TOKEN" | docker login ghcr.io -u <github-username> --password-stdin
```

### A.5 Bring the stack up

```bash
./bin/tajo up
```

This pulls every image at `TAG`, starts the data stores, waits for them to be healthy, then starts apps. Migrations run automatically on container start (the `entrypoint.sh` baked into each NestJS image runs `npm run migration:run:prod` before `exec node dist/src/main.js`).

### A.6 Verify

```bash
./bin/tajo status                                       # all services should be "healthy" / "running"
curl -fsS http://localhost:3000/health    | jq         # gateway health
curl -fsS http://localhost:8085/geoserver/web/ -o /dev/null   # GeoServer is responding
```

Open the frontend at `http://<host>:8080`.

---

## Part B — migrating data from an existing server

The migration is fundamentally: **back up volumes on the old host → restore them on the new host → start the stack on the new host pointing at the same TAG.**

### B.1 On the OLD host — capture state

```bash
cd /opt/infra        # or wherever the existing repo lives
./bin/tajo backup    # writes to backups/<UTC-timestamp>/
```

Output ends with the absolute path to a directory containing `*.tar.gz` per data volume.

(If the old host pre-dates this CLI, do it manually with the same recipe `bin/tajo` uses — for every named volume, run `docker run --rm -v <vol>:/data:ro -v "$(pwd)/backups":/backup alpine tar -czf /backup/<vol>.tar.gz -C /data .`.)

### B.2 Transfer to the NEW host

```bash
# from your laptop, or directly host-to-host
rsync -avzP root@OLD_HOST:/opt/infra/backups/<timestamp>/ root@NEW_HOST:/opt/tajo/backups/<timestamp>/
```

### B.3 On the NEW host — do steps A.1–A.4 above (clone, configure, login to GHCR). DO NOT run `tajo up` yet.

### B.4 Restore the volumes

```bash
cd /opt/tajo
./bin/tajo restore backups/<timestamp>/
```

This recreates the named volumes (`tajo_db-user-data`, etc.) and extracts each archive in place. It prompts before overwriting.

### B.5 Start the stack on the new host

```bash
./bin/tajo up
./bin/tajo status
```

Apps come up against the restored DBs. **No migrations will run** (they're already at the target version), unless the new host's `TAG` is newer than the data — in which case the entrypoint runs the new migrations.

### B.6 Cut over DNS

Point your domain at the new host. Old host stays untouched until the new one is verified.

### B.7 Decommission the old host

```bash
# on OLD host
./bin/tajo down       # stop services but KEEP volumes (insurance for a week)
# verify new host for ~1 week, then:
./bin/tajo down -v    # wipe volumes
```

---

## Operational recipes

### Update to a new image version

```bash
TAG=v1.4.0 ./bin/tajo up        # pulls v1.4.0 of every service, restarts them
```

Or edit `infra/.env` and run `./bin/tajo up` without inline override.

### Roll back

```bash
TAG=sha-a1b2c3d ./bin/tajo up   # pin to a known-good commit
```

Image tags `:sha-<short>` are published for every push to main — you can always pin to one.

### Run a one-off migration

Migrations normally run on container start. To force-run them (e.g. after restoring a backup from an older schema):

```bash
./bin/tajo migrate ms-user-api        # one service
./bin/tajo migrate                    # every DB-backed service
```

### Inspect a database

```bash
./bin/tajo psql ms-predictions-api
```

Drops you into `psql` inside the relevant Postgres container, authenticated as `${POSTGRES_USER}`.

### Tail logs

```bash
./bin/tajo logs                       # everything
./bin/tajo logs ms-gateway-api        # just one
```

### Postgres password desync (legacy gotcha from the old VM)

Docker's `POSTGRES_PASSWORD` only applies on **first volume initialization**. If you change the password in `.env` but the volume already exists, the DB keeps the old password. The fix:

```bash
docker exec infra-db-user psql -U postgres -c "ALTER USER postgres PASSWORD 'new-password';"
```

Then update `.env` to match and `./bin/tajo restart ms-user-api`.

---

## Rollback procedure (something went wrong on the new host)

If the new host fails verification:

1. **Don't run `tajo down -v` on the old host** — that's your safety net.
2. Point DNS back to the old host.
3. On the new host, capture logs (`./bin/tajo logs > rollback.log`).
4. Tear down: `./bin/tajo down -v` (only after data is no longer needed).
5. Investigate, fix, retry from B.1.

---

## What's NOT covered here

- **TLS termination**. Put a reverse proxy (nginx, Caddy, Traefik) in front of the stack on ports 80/443. The gateway listens on 3000 plaintext.
- **Off-host backups**. `tajo backup` writes to local disk. Sync `backups/` to S3/B2/rsync.net via cron.
- **Multi-host scaling**. The compose stack is single-host. For HA, evolve to Docker Swarm (`docker stack deploy`) or k3s — the compose files are largely portable.
- **Jenkins / CI integration**. With GHCR images built by GitHub Actions, the old Jenkins deploy step (`ssh + docker run`) becomes `ssh + tajo pull && tajo up`. See `.github/workflows/build-and-push.yml`.
