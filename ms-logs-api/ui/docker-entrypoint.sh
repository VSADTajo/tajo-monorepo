#!/bin/sh
# =============================================================================
# Runtime URL substitution for the logs UI.
#
# The image is built with placeholders (ENV in the build stage, which Vite
# prioritises over .env.production), so ONE GHCR image works on any host.
# nginx:alpine runs executable scripts in /docker-entrypoint.d/ before starting
# nginx; here we swap the placeholders for the per-host values from the
# environment. No frontend source changes needed.
#
# Only the two vars that actually reach the production bundle are handled
# (API_URL + the gateway URL). The other VITE_* vars in the source are
# tree-shaken out of the prod build, so there is nothing to substitute.
# =============================================================================
set -eu

ASSETS=/usr/share/nginx/html

: "${API_URL:?API_URL is required (set it in infra/.env)}"
: "${GATEWAY_URL:?GATEWAY_URL is required (set it in infra/.env)}"

# `|` delimiter so URLs with `/` don't need escaping. Longer placeholder first.
sub() {
    find "$ASSETS" -type f \( -name '*.js' -o -name '*.html' \) -exec \
        sed -i "s|$1|$2|g" {} +
}

sub "__RUNTIME_URL_API_GATEWAY__" "$GATEWAY_URL"
sub "__RUNTIME_API_URL__"         "$API_URL"

echo "runtime-config: applied API_URL + GATEWAY_URL to logs-ui assets"
