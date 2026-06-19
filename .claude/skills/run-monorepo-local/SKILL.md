---
name: run-monorepo-local
description: >
  Bring up the full VSAD Tajo monorepo locally end-to-end: infra in Docker (Postgres
  per service, RabbitMQ, Redis), every NestJS service running via npm with
  hot-reload, migrations applied in the right order, plus an E2E smoke test that
  exercises the manual simulation pipeline across ms-predictions-api, ms-model-api,
  ms-sftp-api and the GIS read path through ms-hydro-api. Includes the gotchas
  found while validating that flow (RabbitMQ cookie permission errors, Redis cache
  blocking SFTP listings, migration timestamp ordering, multipart field names).
---

# /run-monorepo-local

Run the entire VSAD Tajo platform on your machine using the monorepo as the single source of truth. The infra runs in Docker, each NestJS service runs locally (`npm run start:dev`) so you get hot-reload and direct stack traces.

This is the recipe used to validate the **manual simulation flow** end-to-end. Follow it top to bottom the first time; later you only need the relevant sections.

---

## 1. Prerequisites

| Tool       | Version    | Notes |
|------------|------------|-------|
| Node.js    | **22+**    | `nvm install 22 && nvm use 22`. The `.nvmrc` of every service pins 22 — running on 18 breaks `testcontainers`/`docker-modem` with `TypeError: Right-hand side of 'instanceof' is not callable`. |
| Docker     | 27+        | Docker Desktop or Colima. RabbitMQ needs ~512 MB free. |
| psql CLI   | 16 (opt.)  | For poking at the per-service DBs. |
| `curl`, `jq` | any      | For smoke tests. |
| `gh`       | any        | For PR work. |

Make sure the active Node is 22 in **every** terminal you open:

```bash
source ~/.nvm/nvm.sh && nvm use 22
node -v   # → v22.x
```

---

## 2. Start the shared infrastructure

```bash
cd infra/infra
docker compose up -d redis rabbitmq db-predictions db-model db-sftp db-hydro
docker ps --filter "name=infra-" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

Wait until each one reports `(healthy)`:

```bash
until docker ps --filter "health=healthy" --format "{{.Names}}" | grep -q "infra-db-predictions"; do sleep 2; done
```

Ports you will see:

| Container              | External port | Service that owns it       |
|------------------------|---------------|----------------------------|
| `infra-redis`          | 6379          | All NestJS services (cache) |
| `infra-rabbitmq`       | 5672 + 15672  | All NestJS services (messaging + management UI) |
| `infra-db-user`        | 5433          | ms-user-api                |
| `infra-db-sftp`        | 5435          | ms-sftp-api                |
| `infra-db-geoserver`   | 5436          | GeoServer + ms-meteo-api   |
| `infra-db-predictions` | 5437          | ms-predictions-api         |
| `infra-db-hydro`       | 5438          | ms-hydro-api               |
| `infra-db-model`       | 5439          | ms-model-api               |
| `infra-db-notifications` | 5440        | ms-notifications-api       |
| `infra-db-meteo`       | 5441          | ms-meteo-api               |
| `infra-mongo-logs`     | 27017         | ms-logs-api                |

> **Gotcha — RabbitMQ cookie permissions.** If `infra-rabbitmq` flips to `(unhealthy)` with `Error when reading /var/lib/rabbitmq/.erlang.cookie: eacces`, the Erlang cookie inside the volume was created with wrong perms (often after a hard restart). Fix:
>
> ```bash
> docker compose stop rabbitmq && docker compose rm -f rabbitmq
> docker volume rm infra_rabbitmq_data    # destroys queue state
> docker compose up -d rabbitmq
> ```
>
> Only do the `volume rm` if you can afford to lose queue contents (in local dev that's fine).

---

## 3. Per-service `.env`

Each `<service>/` has an `.env.example`. Copy and edit. Minimum changes from the template:

```bash
cd <service>
cp .env.example .env
```

| Service              | `APP_PORT` | `DB_PORT` | `DB_DATABASE`      | Other overrides |
|----------------------|------------|-----------|--------------------|-----------------|
| ms-gateway-api       | 3000       | (no DB)   | —                  | — |
| ms-user-api          | 3001       | 5433      | `ms_user`          | — |
| ms-authentication-api| 3002       | 5433      | `ms_user`          | shares user DB |
| ms-sftp-api          | 3003       | 5435      | `ms_sftp`          | `STORAGE_BASE_PATH=/tmp/vsad-sftp-storage` (local FS) |
| ms-logs-api          | 3004       | (mongo)   | —                  | `MONGO_URI=mongodb://localhost:27017/logs` |
| ms-hydro-api         | 3006       | 5438      | `ms_hydro`         | + geoserver DB on 5436 |
| ms-predictions-api   | 3007       | 5437      | `ms_predictions`   | `SFTP_API_URL=http://127.0.0.1:3003` |
| ms-model-api         | 3008       | 5439      | `ms_model`         | `SIMULATION_POLL_INTERVAL_MINUTES=1` for fast E2E |
| ms-notifications-api | 3009       | 5440      | `ms_notifications` | — |
| ms-meteo-api         | 3010       | 5441      | `ms_meteo`         | + geoserver DB on 5436 |

`RABBITMQ_ENABLED=true` in every service that publishes or consumes events (`ms-predictions-api`, `ms-model-api`, `ms-logs-api`, …). `ms-sftp-api` doesn't need RabbitMQ — leave it `false` to keep startup snappy.

---

## 4. Apply migrations

```bash
# In each service that has src/migrations/, in any order
cd <service> && npm ci && npm run migration:run
```

> **Gotcha — migration timestamp ordering.** TypeORM applies migrations sorted by the leading numeric prefix. If a new migration references a table created by an older one, its timestamp must be **larger** than the older migration's. Example incident: `1750000000000-add-maneuvers-table.ts` had a smaller timestamp than `1771553100000-create-simulations-table.ts` and ran first, failing with `relation "simulations" does not exist`. Rename your migration file (and its class `name` field) to a timestamp larger than the highest existing one.

Verify per service:

```bash
docker exec infra-db-predictions psql -U postgres -d ms_predictions -c "\dt"
```

Expected for `ms_predictions`: `simulations`, `predictions`, `prediction_results`, `prediction_types`, `maneuvers`, `migrations`.

---

## 5. Start the services

Open one terminal per service. They all use `nest start --watch` so file edits hot-reload.

```bash
# Terminal A — SFTP (start first; predictions depends on it for upload)
cd ms-sftp-api && npm run start:dev

# Terminal B — Model API (RabbitMQ consumer + cron poller)
cd ms-model-api && npm run start:dev

# Terminal C — Predictions API (depends on SFTP being up at boot? No — only at request time)
cd ms-predictions-api && npm run start:dev

# Terminal D (optional) — Hydro API for the downstream-stations endpoint
cd ms-hydro-api && npm run start:dev

# Terminal E (optional) — Gateway, if you want to hit public endpoints with auth
cd ms-gateway-api && npm run start:dev
```

Wait for each `/health` to return `{"status":"ok"}`:

```bash
until curl -s http://127.0.0.1:3007/health | grep -q '"status":"ok"'; do sleep 3; done && echo "predictions UP"
```

> **Gotcha — every NestJS service has a `ClientWhitelistMiddleware`** that rejects requests without `x-internal-caller`. Allowed values vary per service; the common safe one is `ms-gateway-api`. From the host you must always send `-H "x-internal-caller: ms-gateway-api"`.

---

## 6. End-to-end smoke test — manual simulation pipeline

This exercises every part of the new manual simulation flow. The poller interval has to be short (set `SIMULATION_POLL_INTERVAL_MINUTES=1` in `ms-model-api/.env`) or you'll be waiting forever.

```bash
# 1. Create the simulation. x-user-name is what becomes `createdBy` in the DB.
SIM_RESPONSE=$(curl -s -X POST http://127.0.0.1:3007/simulations/manual \
  -H "Content-Type: application/json" \
  -H "x-internal-caller: ms-gateway-api" \
  -H "x-user-name: Sebasti%C3%A1n%20Aliceio" \
  -d '{
    "simulationDate": "20260625120000",
    "description": "E2E smoke test",
    "maneuvers": [{ "reservoirCode": "R002", "outputFlowValue": 25.0 }]
  }')
SIM_ID=$(echo "$SIM_RESPONSE" | jq -r .id)
echo "Created simulation: $SIM_ID"
echo "$SIM_RESPONSE" | jq

# Expected: status=MODEL_PROCESSING, createdBy="Sebastián Aliceio"

# 2. Confirm the input file landed in the SFTP storage
ls -la /tmp/vsad-sftp-storage/simulations/$SIM_ID/input/

# 3. Confirm ms-model-api created the SimulationRun via RabbitMQ consume
sleep 3
docker exec infra-db-model psql -U postgres -d ms_model -c \
  "SELECT \"simulationId\", status FROM simulation_runs WHERE \"simulationId\"='$SIM_ID';"
# Expected: 1 row, status=WAITING_RESULT

# 4. Drop a fake result file as if the external model wrote it
OUT_DIR="/tmp/vsad-sftp-storage/simulations/$SIM_ID/output"
mkdir -p "$OUT_DIR"
cat > "$OUT_DIR/result.json" <<EOF
{"timeSeries":[{
  "header":{
    "locationId":"R002","parameterId":"Q.sim.forecast","moduleInstanceId":"manual",
    "stationName":"R002","lat":"40","lon":"-3","x":"0","y":"0","z":"0","units":"m3/s",
    "timeStep":{"unit":"hour","multiplier":"1"},
    "forecastDate":{"date":"2026-06-25","time":"12:00:00"},
    "startDate":{"date":"2026-06-25","time":"12:00:00"},
    "endDate":{"date":"2026-06-25","time":"13:00:00"},
    "missVal":"-999"
  },
  "events":[
    {"date":"2026-06-25","time":"12:00:00","value":"25.0","flag":"0"}
  ]
}]}
EOF

# 5. CRITICAL — ms-sftp-api caches directory listings in Redis. The file was
#    created by writing to the FS directly (not through the upload API), so the
#    cache entry for that directory is stale. Flush it manually:
docker exec infra-redis redis-cli DEL "files:list:simulations/$SIM_ID/output"

# 6. Wait for the poller (default 1 minute when SIMULATION_POLL_INTERVAL_MINUTES=1)
until docker exec infra-db-predictions psql -U postgres -d ms_predictions -tAc \
      "SELECT status FROM simulations WHERE id='$SIM_ID';" | grep -qE "FINALIZED|MODEL_FAILED"; do
  sleep 5
done

# 7. Final state
docker exec infra-db-predictions psql -U postgres -d ms_predictions -c \
  "SELECT id, status, \"createdBy\" FROM simulations WHERE id='$SIM_ID';"
docker exec infra-db-predictions psql -U postgres -d ms_predictions -c \
  "SELECT \"stationId\", \"simulationId\" FROM predictions WHERE \"simulationId\"='$SIM_ID';"
docker exec infra-db-predictions psql -U postgres -d ms_predictions -c \
  "SELECT date, value, flag FROM prediction_results pr
   JOIN predictions p ON pr.\"predictionId\"=p.id
   WHERE p.\"simulationId\"='$SIM_ID' ORDER BY date;"
ls -la /tmp/vsad-sftp-storage/simulations/$SIM_ID/output/historial/

# Expected final state:
#   simulations.status = FINALIZED
#   simulations.createdBy = "Sebastián Aliceio"  (UTF-8 decoded from x-user-name)
#   1 prediction + 1 prediction_result row
#   result.json moved from output/ to output/historial/
```

If everything turns green you've exercised:

```
HTTP POST → predictions-api → upload to sftp-api (multipart) → simulation.manual.dispatched
                                                    │
                                                    ▼
                                  model-api consumer → SimulationRun(WAITING_RESULT)
                                  cron poller → list SFTP output → download + parse + move
                                  → publish timeseries.ingested with simulationId
                                                    │
                                                    ▼
                                  predictions-api consumer → persist predictions
                                  → Simulation → FINALIZED
```

---

## 7. End-to-end smoke test — downstream stations endpoint

This is read-only against the GIS materialized view `mv_estaciones_aguas_abajo`. It requires the GIS DB to be reachable (port 5436, container `infra-db-geoserver`).

```bash
# Through ms-hydro-api directly
curl -s -H "x-internal-caller: ms-gateway-api" \
  "http://127.0.0.1:3006/stations/downstream?codes[]=E001&codes[]=E002" | jq

# Or through the gateway (requires Bearer token in production):
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://127.0.0.1:3000/stations/downstream?codes[]=E001&codes[]=E002" | jq
```

Expected: `{ items: [{codigoDestino, nombreDestino, tipoDestino}, ...], count: N }`.

---

## 8. Common gotchas (checklist)

- **`HTTP 403 "Client not allowed"`** from any service → missing `x-internal-caller` header. Allowed values per service live in `src/common/middleware/client-whitelist.middleware.ts` and (where applicable) `src/app/infrastructure/middleware/auth.middleware.ts`.
- **`HTTP 401 "Missing or invalid Authorization header"`** from `ms-sftp-api` → the caller's `x-internal-caller` is not whitelisted in `ms-sftp-api`'s auth middleware. Add it to `allowedInternalCallers` (e.g. `ms-predictions-api` had to be added).
- **`HTTP 503 "Failed to upload simulation input file"`** → `ms-sftp-api` not running on `127.0.0.1:3003`, or `SFTP_API_URL` in `ms-predictions-api/.env` points elsewhere (e.g. `ms-sftp-api:3003` — that's the Docker hostname; from the host use `127.0.0.1`).
- **`HTTP 400 "Invalid path: access outside base directory is not allowed"`** from `ms-sftp-api` → the `path` field has a leading `/`. SFTP API paths are relative to `STORAGE_BASE_PATH`.
- **Poller logs "No JSON files found" even though the file exists** → Redis cache hit on the directory listing. The cache is only invalidated by `POST /files/upload` and `POST /files/move`. If you wrote the file directly to disk, flush manually: `docker exec infra-redis redis-cli DEL "files:list:<directory>"`.
- **`relation "x" does not exist` during migration** → migration timestamp ordering. Rename the file and class so its timestamp is larger than the migration that creates `x`.
- **`Application is running` but `/health` returns 503** → the DB connection died and TypeORM is in retry mode. Most often the DB container restarted. Check `docker ps` then restart the service.
- **`amqplib: Channel ended, no reply will be forthcoming`** → RabbitMQ closed the connection (heartbeat missed). The service won't auto-reconnect; restart it. If it keeps happening, restart RabbitMQ.
- **Two processes on the same port (`EADDRINUSE`)** → previous `npm run start:dev` is still alive. `lsof -ti :<port> | xargs kill -9`.

---

## 9. Stopping everything

```bash
# Stop each npm process: Ctrl-C in its terminal
# Stop infra
cd infra/infra && docker compose down

# Wipe local SFTP storage if you want a clean slate:
rm -rf /tmp/vsad-sftp-storage
```

To also destroy DB data (volumes):

```bash
cd infra/infra && docker compose down -v
```

---

## 10. Related skills

- `/start-all` — boots everything (including microservices) inside Docker. Slower iteration, no hot-reload. Use for full E2E from a clean state.
- `/start-infra` — only the infra containers.
- `/start-service <name>` — boots a single service in dev mode.
- `/run-local` — older, more concise companion to this skill.
