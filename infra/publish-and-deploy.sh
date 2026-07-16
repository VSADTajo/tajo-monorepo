#!/usr/bin/env bash
# =============================================================================
# publish-and-deploy.sh — Jenkins post-build step.
#
# After Jenkins builds a service image, this pushes it to GHCR and redeploys it
# on our server and (optionally) on client servers. It reuses redeploy.sh for
# the verbatim image-swap, so a server that already runs the service is updated
# in place with automatic per-service rollback.
#
# A FRESH server (first-ever deploy, e.g. a new client) has no container to
# swap — bring it up once with `bin/tajo up` (see docs/jenkins-ghcr-deploy.md),
# after which this script keeps it updated.
#
# Expected env (wire as Jenkins credentials / pipeline env):
#   SERVICE       service = image name, e.g. ms-gateway-api
#   LOCAL_IMAGE   tag Jenkins just built, e.g. ms-gateway-api:latest
#   REGISTRY      default ghcr.io/vsadtajo
#   TAG           published tag, e.g. main-<sha> (default latest)
#   GHCR_USER / GHCR_TOKEN     docker login to GHCR (write:packages)
#   CLIENT_HOSTS  optional, space-separated "user@host" client servers that
#                 already run the stack (need /opt/tajo + GHCR read login)
# =============================================================================
set -euo pipefail

SERVICE="${SERVICE:?SERVICE is required}"
LOCAL_IMAGE="${LOCAL_IMAGE:?LOCAL_IMAGE is required}"
REGISTRY="${REGISTRY:-ghcr.io/vsadtajo}"
TAG="${TAG:-latest}"
HERE="$(cd "$(dirname "$0")" && pwd)"

echo "=== 1. push $SERVICE -> $REGISTRY/$SERVICE:$TAG (+ :latest) ==="
docker tag "$LOCAL_IMAGE" "$REGISTRY/$SERVICE:$TAG"
# Also publish :latest so the whole stack shares one pullable tag. `tajo up` on a
# fresh/client host uses TAG=latest; without this each service has a different
# main-<sha> and there is no single tag to bring the stack up.
docker tag "$LOCAL_IMAGE" "$REGISTRY/$SERVICE:latest"
echo "${GHCR_TOKEN:?GHCR_TOKEN is required}" | docker login ghcr.io -u "${GHCR_USER:?GHCR_USER is required}" --password-stdin
docker push "$REGISTRY/$SERVICE:$TAG"
docker push "$REGISTRY/$SERVICE:latest"

echo "=== 2. deploy on OUR server (image-swap, auto-rollback) ==="
REGISTRY="$REGISTRY" TAG="$TAG" bash "$HERE/redeploy.sh" "$SERVICE"

if [ -n "${CLIENT_HOSTS:-}" ]; then
    for host in $CLIENT_HOSTS; do
        echo "=== 3. deploy on CLIENT server $host ==="
        ssh -o StrictHostKeyChecking=accept-new "$host" \
            "REGISTRY='$REGISTRY' TAG='$TAG' bash /opt/tajo/infra/redeploy.sh '$SERVICE'"
    done
fi

echo "=== done: $SERVICE @ $TAG ==="
