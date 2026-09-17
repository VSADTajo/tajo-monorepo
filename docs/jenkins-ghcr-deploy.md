# Jenkins → GHCR → multi-server deploy

Team direction: **Jenkins stays the CI/CD orchestrator** (no GitHub Actions
minute limits). We keep GitHub only for the **subtree sync** (monorepo → per
service repos). The portable image-based deploy we built stays — Jenkins just
drives it instead of GitHub Actions.

Goal: *push to main → coherent release across every service → client's `bin/tajo
up` pulls that release atomically.*

---

## Architecture (post version.env)

```
push to monorepo/main
    │
    ▼   (GitHub, kept)
  sync-subtrees.yml  ──►  per-service repos (VSADTajo/ms-*)
                              │
                              ▼   Jenkins multibranch per repo
                          test → docker build → push :main-<sha>       (per-service hotfix track)
                              │                    │
                              │                    ▼   ghcr.io/vsadtajo/<svc>:main-<sha>
                              ▼
                       publish-and-deploy.sh    →  redeploy.sh on OUR VM only
                                                    (pinned to :main-<sha>)


push to monorepo/main
    │
    ▼   Jenkins multibranch on the MONOREPO (new job: `tajo-release`)
Jenkinsfile.release
   ├─ compute RELEASE_TAG = vYYYY.MM.DD.<BUILD_N>
   ├─ parallel { docker build+push each of 13 backend services :vX.Y.Z }
   ├─ clone vsad-tajo-frontend, build+push :vX.Y.Z
   └─ commit infra/version.env with TAG=vX.Y.Z [skip ci] → push to monorepo/main
                              │
                              ▼   client's cron: git pull && bin/tajo up
                              ▼   docker compose pulls :vX.Y.Z for every service atomically
```

**Two tracks coexist**:
- `:main-<sha>` per-service — used by our own VM's `redeploy.sh`, useful for granular hotfix rebuilds.
- `:vYYYY.MM.DD.N` coordinated — the ONLY thing clients consume. Coherent across all services because one pipeline stamps all 14 with the same tag.

The `:latest` tag is **deprecated** — `publish-and-deploy.sh` no longer publishes it.

## Setting up the `tajo-release` Jenkins job (one-time)

The `Jenkinsfile.release` needs its own multibranch pipeline job. Configure:

1. **Jenkins → New Item → Multibranch Pipeline** → name `tajo-release`
2. **Branch Sources → GitHub** → repo `VSADTajo/tajo-monorepo`, credentials `ghcr` (or a token with `repo` scope for private repo access)
3. **Behaviours → Discover branches**: `Exclude branches that are also filed as PRs` + limit to `main` only
4. **Build Configuration → Script Path** → `infra/Jenkinsfile.release`
5. **Scan repository triggers** → Periodically if not otherwise run: `5 minutes` (fallback in case webhook fails)
6. **Add credential `monorepo-push`** in Jenkins Credentials: same PAT as `SUBTREE_PUSH_TOKEN` from GitHub Actions (must have `contents:write` on the monorepo, which `SUBTREE_PUSH_TOKEN` already does)
7. **Save + Scan Multibranch Pipeline Now** → confirms main is discovered

First run of the job will publish the initial `vYYYY.MM.DD.1` tag and commit the bump. From then on, every push to main auto-releases.

**Watch for loop**: the commit-back from the pipeline has `chore(release): ... [skip ci]` in the message. `Jenkinsfile.release` aborts early on those commits. If it doesn't (misconfigured), the pipeline will loop forever — kill the job and check the `Skip our own release-bump commits` stage.

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
