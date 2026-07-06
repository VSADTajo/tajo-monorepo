#!/bin/sh
# Prod entrypoint — dumb-init is the PID 1 supervisor; this script just execs the CMD.
set -e
exec "$@"
