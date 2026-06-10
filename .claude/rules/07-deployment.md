# Deployment Conventions

## CI/CD: Jenkins + Hetzner + Docker

The monorepo deploys to a single Hetzner VM via `docker run`, orchestrated by a Jenkins instance running in the same infrastructure.

### Production server

- **Host**: 65.21.97.113 (Hetzner, Ubuntu 24.04)
- **Repo path**: `/opt/infra/`
- **Compose / env files**: `/opt/infra/infra/`
- **Access**: `ssh root@65.21.97.113`

### Jenkins

- **Container**: `infra-jenkins` (port 9080)
- **Configuration**: Configuration-as-Code via `jenkins/casc.yaml`
- **Bootstrap script**: `jenkins/setup.sh`
- **Dockerfile**: `jenkins/Dockerfile`

Jenkins monitors the VSADTajo GitHub organization. Each repo has a multibranch pipeline. For every push:

```
push to <repo>:<branch>
       │
       ▼
Jenkins clones the branch
       │
       ▼
CI tests (npm run test / test:e2e / lint)
       │
       ▼
docker build (multi-stage; targets prod)
       │
       ▼
ssh root@65.21.97.113 + docker run (replace running container)
```

### Repository registry (Jenkins-monitored)

The VSADTajo GitHub org hosts these repos (each its own pipeline):

- `ms-gateway-api`, `ms-user-api`, `ms-authentication-api`, `ms-sftp-api`, `ms-logs-api`, `ms-hydro-api`, `ms-predictions-api`, `ms-model-api`, `ms-notifications-api`, `ms-meteo-api`
- `vsad-tajo-frontend`
- `vsad_tajo_geoserver`
- `tajo-toolkit` (published as `github:VSADTajo/tajo-toolkit`)
- `infra` (this monorepo container — but each service is its own repo for deployment)

## Branching

- `main` — production
- `feature/*` — feature branches
- PR to `main` triggers full CI; merge to `main` triggers CI + Docker build + deploy to the VM.

## Secrets

- `.env` is gitignored; `.env.example` is the template per repo.
- Jenkins injects secrets via its Credentials store and a `withCredentials` block in the pipeline.
- Per-environment values live in the VM at `/opt/infra/infra/.env` and are loaded by Docker Compose.

## Troubleshooting

### Container fails on start
```bash
ssh root@65.21.97.113
docker logs --tail 200 <container>
```

### Restart a service
```bash
ssh root@65.21.97.113
cd /opt/infra/infra
docker compose -f docker-compose.yml -f docker-compose.apps.yml restart <service>
```

### Run pending migrations on a service
```bash
ssh root@65.21.97.113
docker exec -it <ms-xxx> npm run migration:run:prod
```

### PostgreSQL password desync (see `04-infrastructure.md`)
```bash
docker exec <container> psql -U postgres -c "ALTER USER postgres PASSWORD 'new_password';"
```

### Rollback
- Pull the previous Docker image tag and run it (Jenkins keeps tagged images on the VM).
- Or revert the commit in GitHub and let Jenkins redeploy.

## Adding a New Service to CI

1. Push the new service repo to the VSADTajo org with a working `Jenkinsfile` at its root (copy from `ms-gateway-api`).
2. In Jenkins UI: add the repo to the multibranch project.
3. Register the service in `infra/infra/docker-compose.apps.yml` (reuse the `x-common-db-env` / `x-common-infra-env` anchors).
4. Add the service's Postgres to `infra/infra/docker-compose.yml`.
5. Update `.claude/rules/01-global.md` and `infra/CLAUDE.md` with the new entry.
6. SSH to the VM, `git pull` in `/opt/infra/`, `docker compose ... up -d <service>`.

## GeoServer

Deployed separately by Jenkins: pulls `VSADTajo/vsad_tajo_geoserver`, then `docker run` with the official `docker.osgeo.org/geoserver:2.24.2` image mounting volumes from `/opt/geoserver/`. PostGIS DB is `infra-db-geoserver`.
