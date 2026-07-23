#!/bin/sh
# =============================================================================
# Runtime URL substitution for the SFTP frontend (Mapping Engine UI).
#
# The image is built with placeholders instead of real URLs (see the ARG
# defaults in the Dockerfile), so ONE GHCR image works on any host. nginx:alpine
# runs every executable script in /docker-entrypoint.d/ before starting nginx,
# so here we just swap the placeholders for the values coming from the container
# environment (set per-host in infra/.env). No frontend source changes needed.
# =============================================================================
set -eu

ASSETS=/usr/share/nginx/html

# Use the runtime env when provided; otherwise fall back to a localhost default instead of
# aborting, so a missing var never crash-loops the container (worst case: a visible localhost URL).
: "${AUTH_API_URL:=http://localhost:3000}"
echo "runtime-config: AUTH_API_URL=$AUTH_API_URL"

# `|` delimiter so URLs with `/` don't need escaping.
find "$ASSETS" -type f \( -name '*.js' -o -name '*.html' \) -exec \
    sed -i "s|__RUNTIME_AUTH_API_URL__|${AUTH_API_URL}|g" {} +

echo "runtime-config: applied AUTH_API_URL to frontend assets"
