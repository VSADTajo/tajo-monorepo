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
# =============================================================================
set -uo pipefail

REGISTRY="${REGISTRY:-ghcr.io/vsadtajo}"
TAG="${TAG:-latest}"

# Services that ship a GHCR image. GeoServer (custom image) and sftp-frontend
# are intentionally excluded — they are managed separately.
ALL_SERVICES="ms-gateway-api ms-user-api ms-authentication-api ms-sftp-api ms-logs-api ms-logs-ui ms-hydro-api ms-predictions-api ms-model-api ms-notifications-api ms-meteo-api vsad-tajo-frontend"

REQUEST="${1:-all}"
if [ "$REQUEST" = "all" ]; then SERVICES="$ALL_SERVICES"; else SERVICES="$REQUEST"; fi

runlike() { docker run --rm -v /var/run/docker.sock:/var/run/docker.sock assaflavie/runlike "$@"; }

# Passes if the /health endpoint responds; for services without an APP_PORT
# (nginx frontends) it falls back to "container stayed running".
health_ok() {
    local name="$1" port="$2" i
    if [ -z "$port" ]; then
        sleep 5
        docker ps --filter "name=^${name}$" --filter status=running -q | grep -q . && return 0 || return 1
    fi
    for i in $(seq 1 40); do
        if docker exec "$name" node -e "fetch('http://localhost:${port}/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" 2>/dev/null; then
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
