#!/bin/sh
# =============================================================================
# Runtime URL substitution for the logs UI.
#
# ONE GHCR image works on any host: the URLs are baked as placeholders (ENV in
# the build stage, which Vite prioritises both over .env.production AND over the
# source `|| 'http://...'` fallbacks), and substituted here from the container
# environment. nginx:alpine runs executable scripts in /docker-entrypoint.d/
# before starting nginx. No frontend source changes needed.
# =============================================================================
set -eu

ASSETS=/usr/share/nginx/html

# Use the runtime env when provided; otherwise fall back to a localhost default instead of
# aborting, so a missing var never crash-loops the container. The effective URLs are logged
# below, so a fallback (localhost) is visible to whoever inspects the container logs.
: "${API_URL:=http://localhost:3004}"
: "${GATEWAY_URL:=http://localhost:3000}"
: "${SCHEDULER_URL:=http://localhost:3000}"
: "${PREDICTIONS_URL:=http://localhost:3000}"
echo "runtime-config: API_URL=$API_URL GATEWAY_URL=$GATEWAY_URL SCHEDULER_URL=$SCHEDULER_URL PREDICTIONS_URL=$PREDICTIONS_URL"

# `|` delimiter so URLs with `/` don't need escaping. Longer placeholders first
# so no placeholder is a prefix of another during substitution.
sub() {
    find "$ASSETS" -type f \( -name '*.js' -o -name '*.html' \) -exec \
        sed -i "s|$1|$2|g" {} +
}

sub "__RUNTIME_PREDICTIONS_API_URL__" "$PREDICTIONS_URL"
sub "__RUNTIME_SCHEDULER_API_URL__"   "$SCHEDULER_URL"
sub "__RUNTIME_URL_API_GATEWAY__"     "$GATEWAY_URL"
sub "__RUNTIME_API_URL__"             "$API_URL"

echo "runtime-config: applied 4 URLs to logs-ui assets"
