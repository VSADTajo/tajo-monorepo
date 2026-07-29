#!/usr/bin/env bash
# =============================================================================
# redeploy.sh — pull GHCR images and recreate services on the VM.
#
# For each service it captures the EXACT current runtime config of the live
# container (via runlike) and recreates it with the new GHCR image. Config is
# read from the running container, so NO secrets ever live in git or in this
# script. Rollback is automatic per service: the previous container is kept as
# <svc>-prev until the new one passes health; on any failure it is restored,
# and the restore is verified — a rollback that did not work is reported as
# such instead of being announced as done.
#
# Because config is copied from the live container, a variable the image only
# starts requiring in the new version cannot come from anywhere: declare it in
# service-env/<service>.env and it will be added when missing.
#
# Usage:
#   TAG=latest            bash redeploy.sh all
#   TAG=sha-abc123        bash redeploy.sh "ms-gateway-api ms-user-api"
#
# Env:
#   REGISTRY      (default ghcr.io/vsadtajo)
#   TAG           (default latest)
#   EXTRA_ENV_DIR (default <script dir>/service-env)
#   DRY_RUN=1     validate only: pull the image + rebuild the run command, but
#                 do NOT touch any container. Safe against live production.
#
# Exit codes: 0 ok · 1 some service failed but kept its previous version
#             2 some service is DOWN (rollback could not restore it)
# =============================================================================
set -uo pipefail

REGISTRY="${REGISTRY:-ghcr.io/vsadtajo}"
TAG="${TAG:-latest}"

# Services that ship a GHCR image. Only GeoServer (custom image) is managed
# separately. sftp-frontend and ms-calculator-api (Python) are included: the
# health gate below adapts to non-Node runtimes.
ALL_SERVICES="ms-gateway-api ms-user-api ms-authentication-api ms-sftp-api sftp-frontend ms-logs-api ms-logs-ui ms-hydro-api ms-predictions-api ms-model-api ms-notifications-api ms-meteo-api ms-calculator-api vsad-tajo-frontend"

# Named-volume policy per (service, destination). runlike emits volumes as
# "--volume /dest" without the source name, which docker interprets as an
# anonymous volume — data at that path is lost on every recreate. Rewrite the
# runlike output so each recreate preserves the named volume actually holding
# the data.
# Format: one "svc|dest|named" tuple per line.
NAMED_VOLUMES='
ms-sftp-api|/data/files|sftp-storage
ms-sftp-api|/data/sftp|sftp-keys
ms-logs-api|/app/dist/files_results|ms-logs-api-files
'

REQUEST="${1:-all}"
if [ "$REQUEST" = "all" ]; then SERVICES="$ALL_SERVICES"; else SERVICES="$REQUEST"; fi

runlike() { docker run --rm -v /var/run/docker.sock:/var/run/docker.sock assaflavie/runlike "$@"; }

# Extra environment a service needs but its live container does not have yet.
#
# runlike can only copy variables that already exist on the running container,
# so an image that starts *requiring* a new variable crash-loops on deploy: the
# recreate has no way to supply it. That is exactly what took ms-logs-ui down
# when it became a runtime-configurable image (API_URL, GATEWAY_URL, ...).
#
# Drop a `<service>.env` here (KEY=VALUE per line) and every recreate will add
# the ones the container is missing. Existing values are never overwritten —
# the live container remains the source of truth for secrets.
EXTRA_ENV_DIR="${EXTRA_ENV_DIR:-$(dirname "$0")/service-env}"

# Appends "--env=K=V" to $cmd for each declared key not already present.
merge_extra_env() {
    local svc="$1" cmd="$2" file="$EXTRA_ENV_DIR/$1.env" key value line
    [ -f "$file" ] || { printf '%s' "$cmd"; return 0; }

    while IFS= read -r line || [ -n "$line" ]; do
        case "$line" in ''|'#'*) continue ;; esac
        key=${line%%=*}
        value=${line#*=}
        [ -z "$key" ] && continue
        # Already set on the live container: leave it alone.
        if printf '%s' "$cmd" | grep -q -- "--env=${key}="; then
            echo "  · env $key ya presente — se respeta el valor del contenedor" >&2
            continue
        fi
        echo "  + env $key (declarada en ${svc}.env, ausente en el contenedor)" >&2
        cmd="${cmd/--detach=true/--env=${key}=${value} --detach=true}"
    done <"$file"

    printf '%s' "$cmd"
}

# Rewrite "--volume /dest" -> "--volume <named>:/dest" in $cmd for every
# destination listed in NAMED_VOLUMES for $svc.
apply_named_volumes() {
    local svc="$1" cmd="$2" rsvc dest named
    while IFS='|' read -r rsvc dest named; do
        [ -z "$rsvc" ] && continue
        [ "$rsvc" != "$svc" ] && continue
        cmd=$(printf '%s' "$cmd" | sed -E "s|(--volume )${dest}([[:space:]])|\1${named}:${dest}\2|g")
    done <<<"$NAMED_VOLUMES"
    printf '%s' "$cmd"
}

# Health gate. The probe adapts to the container runtime so it works for Node,
# Python (FastAPI) and nginx images alike:
#   - no APP_PORT (nginx frontends: ms-logs-ui, sftp-frontend): pass if the
#     container stays running.
#   - container has `node`: probe /health from inside via node's fetch (all the
#     NestJS services — unchanged behaviour).
#   - no `node` (e.g. ms-calculator-api, Python): probe /health over the
#     container network with a throwaway curl container (language-agnostic).
health_ok() {
    local name="$1" port="$2" i net state restarts
    if [ -z "$port" ]; then
        # A crash-looping container alternates between running and restarting, so
        # a single check right after start can catch it mid-"running" and pass.
        # Watch it for a while instead: it must stay up AND never restart.
        for i in $(seq 1 6); do
            sleep 5
            state=$(docker inspect -f '{{.State.Status}}' "$name" 2>/dev/null || echo missing)
            restarts=$(docker inspect -f '{{.RestartCount}}' "$name" 2>/dev/null || echo 0)
            if [ "$state" != "running" ] || [ "${restarts:-0}" -gt 0 ]; then
                echo "  ✗ $name estado=$state reinicios=$restarts" >&2
                docker logs "$name" --tail 15 2>&1 | sed 's/^/      /' >&2
                return 1
            fi
        done
        return 0
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

# Restores <svc>-prev and VERIFIES it came back. The previous version reported
# "rollback aplicado" unconditionally: if any step failed the service was left
# down while the log claimed otherwise, which is worse than a loud failure.
rollback() {
    local svc="$1" state

    echo "  ↩ rollback $svc"

    if ! docker rm -f "$svc" >/dev/null 2>&1; then
        echo "  ! no pude borrar el contenedor nuevo $svc" >&2
    fi

    if ! docker container inspect "${svc}-prev" >/dev/null 2>&1; then
        echo "  ✗✗ NO existe ${svc}-prev — $svc queda CAÍDO, hay que restaurarlo a mano" >&2
        return 1
    fi

    if ! docker rename "${svc}-prev" "$svc" >/dev/null 2>&1; then
        echo "  ✗✗ no pude renombrar ${svc}-prev — $svc queda CAÍDO" >&2
        return 1
    fi

    docker start "$svc" >/dev/null 2>&1 || true

    sleep 5
    state=$(docker inspect -f '{{.State.Status}}' "$svc" 2>/dev/null || echo missing)
    if [ "$state" != "running" ]; then
        echo "  ✗✗ ROLLBACK NO RESTAURÓ EL SERVICIO — $svc estado=$state" >&2
        return 1
    fi

    echo "  ✓ rollback verificado — $svc corriendo con la versión anterior"
    return 0
}

FAILED=""
# Services the rollback could NOT bring back — these are actually down.
DOWN=""
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
    cmd=$(apply_named_volumes "$svc" "$cmd")
    cmd=$(merge_extra_env "$svc" "$cmd")

    if [ "${DRY_RUN:-0}" = "1" ]; then
        echo "  ✓ [dry-run] imagen pulleable + config reconstruida ($(printf '%s\n' "$cmd" | grep -c . ) líneas) — no se recrea nada"
        continue
    fi

    docker rename "$svc" "${svc}-prev"
    docker stop "${svc}-prev" >/dev/null

    if ! eval "$cmd" >/dev/null; then
        echo "  ✗ no arrancó el nuevo"
        rollback "$svc" || DOWN="$DOWN $svc"
        FAILED="$FAILED $svc"; continue
    fi

    if health_ok "$svc" "$port"; then
        echo "  ✓ healthy — limpio el contenedor previo"
        docker rm "${svc}-prev" >/dev/null 2>&1 || true
    else
        echo "  ✗ no llegó a healthy"
        rollback "$svc" || DOWN="$DOWN $svc"
        FAILED="$FAILED $svc"
    fi
done

echo ""
if [ -n "$DOWN" ]; then
    echo "=== ✗✗ CAÍDOS — el rollback no los restauró, requieren intervención manual:$DOWN ==="
    echo "=== fallaron:$FAILED ==="
    exit 2
fi
if [ -n "$FAILED" ]; then
    echo "=== FALLARON (rollback verificado, sigue la versión anterior):$FAILED ==="
    exit 1
fi
echo "=== deploy OK: $SERVICES ==="
