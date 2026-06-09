# Tajo Monorepo

Source of truth for the VSAD Tajo platform. Each subdirectory is mirrored to a standalone repo on every push to `main` — the standalone repos are what Jenkins watches and deploys to the Hetzner VM.

## Services

| Subdir | Standalone repo | Deploy |
|---|---|---|
| `ms-gateway-api/` | [VSADTajo/ms-gateway-api](https://github.com/VSADTajo/ms-gateway-api) | Jenkins → Hetzner |
| `ms-user-api/` | [VSADTajo/ms-user-api](https://github.com/VSADTajo/ms-user-api) | Jenkins → Hetzner |
| `ms-authentication-api/` | [VSADTajo/ms-authentication-api](https://github.com/VSADTajo/ms-authentication-api) | Jenkins → Hetzner |
| `ms-sftp-api/` | [VSADTajo/ms-sftp-api](https://github.com/VSADTajo/ms-sftp-api) | Jenkins → Hetzner |
| `ms-logs-api/` | [VSADTajo/ms-logs-api](https://github.com/VSADTajo/ms-logs-api) | Jenkins → Hetzner |
| `ms-hydro-api/` | [VSADTajo/ms-hydro-api](https://github.com/VSADTajo/ms-hydro-api) | Jenkins → Hetzner |
| `ms-predictions-api/` | [VSADTajo/ms-predictions-api](https://github.com/VSADTajo/ms-predictions-api) | Jenkins → Hetzner |
| `ms-model-api/` | [VSADTajo/ms-model-api](https://github.com/VSADTajo/ms-model-api) | Jenkins → Hetzner |
| `ms-notifications-api/` | [VSADTajo/ms-notifications-api](https://github.com/VSADTajo/ms-notifications-api) | Jenkins → Hetzner |
| `ms-meteo-api/` | [VSADTajo/ms-meteo-api](https://github.com/VSADTajo/ms-meteo-api) | Jenkins → Hetzner |
| `vsad-tajo-frontend/` | [VSADTajo/vsad-tajo-frontend](https://github.com/VSADTajo/vsad-tajo-frontend) | Jenkins → Hetzner |
| `tajo-toolkit/` | [VSADTajo/tajo-toolkit](https://github.com/VSADTajo/tajo-toolkit) | Published as `github:VSADTajo/tajo-toolkit` (no deploy) |

**Not part of this monorepo**: `infra/` (docker-compose stack, lives in its own repo), `vsad_tajo_geoserver`, `tajo-gisdb-backup`.

## How sync works

```
push to monorepo:main
    │
    ▼
.github/workflows/sync-subtrees.yml
    │
    ├─ Matrix of 12 services in parallel
    │   │
    │   ├─ git diff <before>..<after> to detect if this subdir changed
    │   │       (skipped if no change → fast no-op)
    │   │
    │   └─ git subtree split --prefix=<subdir> -b split-<subdir>
    │      git push <standalone> split-<subdir>:main --force
    │
    ▼
Each touched standalone repo gets main force-pushed
    │
    ▼
Jenkins multibranch pipeline on each standalone fires its deploy as today
```

The monorepo is the **source of truth**. Pushes directly to a standalone repo's `main` are overwritten on the next monorepo sync. Configure branch protection on each standalone to enforce this.

## Working in the monorepo

```bash
# Clone
git clone https://github.com/VSADTajo/tajo-monorepo.git
cd tajo-monorepo

# Work as usual inside any service subdir
cd ms-predictions-api
npm install
npm run start:dev

# Cross-service feature: edit multiple subdirs in a single branch + PR
```

## Pre-monorepo history

Each standalone repo carries a tag `pre-monorepo` that points to the last commit before the monorepo cut-over. Use that to inspect history that predates the monorepo, e.g.:

```bash
git clone https://github.com/VSADTajo/ms-predictions-api.git
cd ms-predictions-api
git log pre-monorepo --oneline | head -50
```

## One-time setup (already done, documented for transparency)

1. **PAT for cross-repo push**: a Personal Access Token with `repo` scope on the `VSADTajo` org is stored as the secret `SUBTREE_PUSH_TOKEN` in this repo's settings. The sync workflow uses it to push to each standalone.
2. **Bootstrap**: each subdir was added via `git subtree add --prefix=<dir> https://github.com/VSADTajo/<repo>.git main --squash`. The squash commit metadata is what lets future `git subtree split` commands faithfully extract per-subdir history.
3. **`pre-monorepo` tag** was placed on each standalone before the first sync to preserve original history.

## Manual sync trigger

If sync ever needs to run outside a push event (e.g., after a freeze, or to recover from an aborted run), go to **Actions → Sync to standalone repos → Run workflow**. With `workflow_dispatch`, every subdir is force-pushed regardless of whether it changed.

## What lives where

- **App code** for each service: under its subdir here.
- **Deploy pipeline (`Jenkinsfile`)**: inside each subdir, gets synced to the standalone — Jenkins keeps working unchanged.
- **Infra config (`docker-compose.yml`, `.env`)**: lives in a separate `infra` repo; this monorepo does not own it.
- **Secrets**: managed in Jenkins credentials store, never in source files.
