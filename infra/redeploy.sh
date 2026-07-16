#!/usr/bin/env bash
# =============================================================================
# redeploy.sh — pull GHCR images and recreate services on the VM.
#
# For each service it captures the EXACT current runtime config of the live
# container (via runlike) and recreates it with the new GHCR image. Config is
# read from the running container, so NO secrets ever live in git or in this
# script. Rollback is automatic per service: the previous container is kept as
# <svc>-prev until the new one passes health; on any failure it is restored.
#
# Usage:
#   TAG=latest            bash redeploy.sh all
#   TAG=sha-abc123        bash redeploy.sh "ms-gateway-api ms-user-api"
#
# Env:
#   REGISTRY  (default ghcr.io/vsadtajo)
#   TAG       (default latest)
#   DRY_RUN=1 validate only: pull the image + rebuild the run command, but do
#             NOT touch any container. Safe to run against live production.
# =============================================================================
set -uo pipefail

REGISTRY="${REGISTRY:-ghcr.io/vsadtajo}"
TAG="${TAG:-latest}"

# Services that ship a GHCR image. Only GeoServer (custom image) is managed
# separately. sftp-frontend and ms-calculator-api (Python) are included: the
# health gate below adapts to non-Node runtimes.
ALL_SERVICES="ms-gateway-api ms-user-api ms-authentication-api ms-sftp-api sftp-frontend ms-logs-api ms-logs-ui ms-hydro-api ms-predictions-api ms-model-api ms-notifications-api ms-meteo-api ms-calculator-api vsad-tajo-frontend"

REQUEST="${1:-all}"
if [ "$REQUEST" = "all" ]; then SERVICES="$ALL_SERVICES"; else SERVICES="$REQUEST"; fi

runlike() { docker run --rm -v /var/run/docker.sock:/var/run/docker.sock assaflavie/runlike "$@"; }

# Health gate. The probe adapts to the container runtime so it works for Node,
# Python (FastAPI) and nginx images alike:
#   - no APP_PORT (nginx frontends: ms-logs-ui, sftp-frontend): pass if the
#     container stays running.
#   - container has `node`: probe /health from inside via node's fetch (all the
#     NestJS services — unchanged behaviour).
#   - no `node` (e.g. ms-calculator-api, Python): probe /health over the
#     container network with a throwaway curl container (language-agnostic).
health_ok() {
    local name="$1" port="$2" i net
    if [ -z "$port" ]; then
        sleep 5
        docker ps --filter "name=^${name}$" --filter status=running -q | grep -q . && return 0 || return 1
    fi
    if docker exec "$name" sh -c 'command -v node' >/dev/null 2>&1; then
        for i in $(seq 1 40); do
            if docker exec "$name" node -e "fetch('http://localhost:${port}/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" 2>/dev/null; then
                return 0
            fi
            sleep 3
        done
        return 1
    fi
    # Non-Node runtime: hit /health by container name over its own network.
    net=$(docker inspect -f '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}' "$name" | awk '{print $1}')
    for i in $(seq 1 40); do
        if docker run --rm --network "$net" curlimages/curl:latest \
                -fsS "http://${name}:${port}/health" >/dev/null 2>&1; then
            return 0
        fi
        sleep 3
    done
    return 1
}

rollback() {
    local svc="$1"
    echo "  ↩ rollback $svc"
    docker rm -f "$svc" 2>/dev/null || true
    docker rename "${svc}-prev" "$svc" && docker start "$svc" >/dev/null
}

FAILED=""
for svc in $SERVICES; do
    echo "=================== $svc ==================="
    newimg="${REGISTRY}/${svc}:${TAG}"

    if ! docker container inspect "$svc" >/dev/null 2>&1; then
        echo "  SKIP: no existe el contenedor $svc"
        continue
    fi

    oldimg=$(docker inspect -f '{{.Config.Image}}' "$svc")
    port=$(docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$svc" | sed -n 's/^APP_PORT=//p' | head -1)

    echo "  pull $newimg"
    if ! docker pull "$newimg" >/dev/null; then
        echo "  ✗ falló el pull"; FAILED="$FAILED $svc"; continue
    fi

    cmd=$(runlike -p "$svc" 2>/dev/null | sed "s#${oldimg}#${newimg}#g")
    if [ -z "$cmd" ]; then
        echo "  ✗ falló runlike"; FAILED="$FAILED $svc"; continue
    fi

    if [ "${DRY_RUN:-0}" = "1" ]; then
        echo "  ✓ [dry-run] imagen pulleable + config reconstruida ($(printf '%s\n' "$cmd" | grep -c . ) líneas) — no se recrea nada"
        continue
    fi

    docker rename "$svc" "${svc}-prev"
    docker stop "${svc}-prev" >/dev/null

    if ! eval "$cmd" >/dev/null; then
        echo "  ✗ no arrancó el nuevo"; rollback "$svc"; FAILED="$FAILED $svc"; continue
    fi

    if health_ok "$svc" "$port"; then
        echo "  ✓ healthy — limpio el contenedor previo"
        docker rm "${svc}-prev" >/dev/null 2>&1 || true
    else
        echo "  ✗ no llegó a healthy"; rollback "$svc"; FAILED="$FAILED $svc"
    fi
done

echo ""
if [ -n "$FAILED" ]; then
    echo "=== FALLARON (rollback aplicado):$FAILED ==="
    exit 1
fi
echo "=== deploy OK: $SERVICES ==="
