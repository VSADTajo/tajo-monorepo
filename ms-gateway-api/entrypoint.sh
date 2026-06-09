#!/bin/sh
# ms-gateway-api is a pure proxy (no database, no migrations)
echo "Starting the application..."
exec "$@"
