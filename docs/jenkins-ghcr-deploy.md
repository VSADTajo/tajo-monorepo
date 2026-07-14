# Jenkins → GHCR → multi-server deploy

Team direction: **Jenkins stays the CI/CD orchestrator** (no GitHub Actions
minute limits). We keep GitHub only for the **subtree sync** (monorepo → per
service repos). The portable image-based deploy we built stays — Jenkins just
drives it instead of GitHub Actions.

Goal (Sebastian): *push to main → via Jenkins deploy on our server AND on the
client's server.*

---

## Architecture

```
push to main
   │
   ▼  (GitHub, kept)
sync-subtrees  ──►  per-service repos (VSADTajo/ms-*)
                        │
                        ▼  Jenkins multibranch (per repo, on our VM)
                   test → docker build → PUSH to GHCR
                        │                    │
                        │                    ▼   ghcr.io/vsadtajo/<svc>:<tag>
                        ▼
                 publish-and-deploy.sh
                        ├─ our server:    redeploy.sh  (image-swap, in place)
                        └─ client server: redeploy.sh over SSH  (pull from GHCR)
```

The image registry (GHCR) is the shared backbone: build once, any server pulls.

---

## What Jenkins needs (credentials)

| Credential | Use |
|------------|-----|
| `GHCR_USER` / `GHCR_TOKEN` | `docker login ghcr.io` to push (write:packages) and pull (read:packages) |
| `CLIENT_HOSTS` (optional) | space-separated `user@host` of client servers already running the stack |
| SSH key to client host(s) | for the client redeploy over SSH |

The runtime app/DB secrets live on each server's containers (or its
`infra/.env`), never in Jenkins — the image-swap copies the live config verbatim.

---

## The Jenkinsfile change (reference)

Replace the old `Deploy` stage (local `docker run`) with **push + deploy**:

```groovy
stage('Docker Build') {
    steps { sh "DOCKER_BUILDKIT=1 docker build --target prod -t ${APP_NAME}:${IMAGE_TAG} ." }
}
stage('Publish & Deploy') {
    when { branch 'main' }
    steps {
        withCredentials([usernamePassword(credentialsId: 'ghcr',
                          usernameVariable: 'GHCR_USER', passwordVariable: 'GHCR_TOKEN')]) {
            sh """
                SERVICE=${APP_NAME} \
                LOCAL_IMAGE=${APP_NAME}:${IMAGE_TAG} \
                REGISTRY=ghcr.io/vsadtajo \
                TAG=main-${GIT_COMMIT_SHORT} \
                CLIENT_HOSTS='${CLIENT_HOSTS}' \
                bash infra/publish-and-deploy.sh
            """
        }
    }
}
```

`infra/publish-and-deploy.sh` + `infra/redeploy.sh` come into each service repo
via the subtree sync, so every service gets the same, reviewed deploy logic.

---

## Our server vs a fresh client server

| | Our server (already running) | Fresh client server (first time) |
|--|------------------------------|----------------------------------|
| Bring-up | already up | `git clone` + `infra/.env` + `bin/tajo up` (pulls from GHCR) |
| Ongoing deploys | `redeploy.sh` (image-swap, auto-rollback) | `redeploy.sh` (same, once running) |

`redeploy.sh` swaps an existing container using its live config — perfect for
updates. The **first** bring-up on a brand-new host uses `bin/tajo up` (compose).

---

## Status

- ✅ **Ready:** GHCR publish, our-server image-swap (`redeploy.sh`, validated),
  auto-rollback, `bin/tajo`, backup, cutover runbook.
- 🔨 **Pending for a fresh CLIENT bring-up via `tajo up`:** finish aligning the
  unified compose with prod (sftp/meteo/model env, GeoServer image decision) —
  see `docs/migration-progress.md`. Not needed to deploy on our (already
  running) server.

---

## Rollback

`redeploy.sh` keeps the previous container as `<svc>-prev` until the new one
passes health; on failure it restores automatically. Manual, per service:

```bash
docker stop <svc> && docker rm <svc>
docker rename <svc>-prev <svc> && docker start <svc>
```
