# Cutover runbook — Jenkins → GitHub Actions (image-swap)

The **cutover** is the moment we switch production from the Jenkins-built
containers to the GHCR image-based containers. Same VM, same databases, same
network — only the source of the service images changes. Expect **~2–5 min of
downtime** while the 12 app containers are swapped.

This runbook covers the **first, manual cutover** (image-swap). Ongoing deploys
after the cutover are automated by `.github/workflows/deploy.yml`.

> The actual swap script (`/opt/cutover/swap.sh`) is generated on the VM and is
> NOT in git — it contains the live env (secrets) copied verbatim from the
> running containers.

---

## Scope

**Swapped (12):** ms-gateway-api, ms-user-api, ms-authentication-api, ms-sftp-api,
ms-logs-api, ms-logs-ui, ms-hydro-api, ms-predictions-api, ms-model-api,
ms-notifications-api, ms-meteo-api, vsad-tajo-frontend.

**NOT touched:** all Postgres DBs, Redis, RabbitMQ, MongoDB, the custom GeoServer
(`vsad-tajo-geoserver`), and `sftp-frontend`. They keep running as-is.

---

## Prerequisites (must be green before scheduling)

- [ ] **Images match prod** — GHCR images built from an up-to-date `main`; the
      migration dry-check (below) shows **no image behind its DB**.
- [ ] **Backup taken** and copied off-host (`bin/tajo backup` or the pg_dump +
      mongodump recipe). Verify the archive exists and is non-empty.
- [ ] **VM can pull GHCR** — `docker login ghcr.io` done on the VM with a
      `read:packages` token; images pre-pulled.
- [ ] **Deploy secrets set** (Environment `production`): `DEPLOY_SSH_KEY`,
      `DEPLOY_HOST`, `DEPLOY_USER` — for the post-cutover automated deploys.
- [ ] **Team coordinated** — window agreed, no one deploying/merging during it.

---

## Pre-flight (no downtime)

### 1. Pause Jenkins
So a push can't re-deploy the old way and clobber the swap. Jenkins is **paused,
not removed** (fallback). Confirm `quietingDown: true`, or disable the pipeline
jobs.

### 2. Migration dry-check (the key safety gate)
For every DB-backed service, compare migrations **applied in the DB** vs those
**in the image**:

- `DB == IMG` → no-op, safe.
- `IMG > DB` → the image has pending migrations; review them before proceeding.
- `DB > IMG` → **image is behind prod** — STOP, rebuild images from current `main`.

### 3. Baseline
Record current health of the 12 services (to compare after).

---

## Cutover (downtime starts)

1. Run the generated swap script:
   ```bash
   bash /opt/cutover/swap.sh
   ```
   Per service it does: `docker rename <svc> <svc>-jenkins-bak` → `docker stop
   <svc>-jenkins-bak` → `docker run` the GHCR image with the **same** config.

2. Verify health of all 12 (see below).

---

## Verification

```bash
# all app containers up?
docker ps --format '{{.Names}}  {{.Status}}' | grep -E 'ms-|vsad-'

# per-service health (NestJS services expose /health on their APP_PORT)
curl -fsS http://localhost:3000/health   # gateway
# frontend serves, geoserver responds:
curl -fsS http://localhost:8080/ -o /dev/null
```

Smoke test a real user flow through the gateway before declaring success.

---

## Rollback (per service, ~1 min)

The old container is preserved as `<svc>-jenkins-bak`:

```bash
docker stop <svc> && docker rm <svc>
docker rename <svc>-jenkins-bak <svc>
docker start <svc>
```

**Data rollback** (only if a bad migration ran): restore the affected DB from the
backup taken in prerequisites.

---

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Migration alters real data | low (dry-check gates it) | backup + dry-check |
| A service doesn't come up | low (verbatim config) | per-service rollback |
| Jenkins re-deploys over the swap | — | Jenkins paused in pre-flight |
| Transient inter-service errors during swap | expected | resolves once all up |

---

## Post-cutover

- [ ] Keep `<svc>-jenkins-bak` containers for an **observation window** (a few days).
- [ ] Enable `deploy.yml` for automated future deploys.
- [ ] After the window: remove `-jenkins-bak`, prune old images (`tajo gc`).
- [ ] **Rotate secrets** that were exposed during the migration.
- [ ] Keep Jenkins paused as a fallback until fully confident.

---

## Day-of checklist (copy for the team)

1. Confirm no one is deploying/merging. Freeze `main`.
2. Pre-flight: pause Jenkins → dry-check → baseline. (no downtime)
3. Announce start of the window.
4. Run `swap.sh`. (downtime ~2–5 min)
5. Verify health + smoke test.
6. 🟢 all green → announce done, start observation window.
   🔴 problem → rollback the affected service(s), announce, regroup.
