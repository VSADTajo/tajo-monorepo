#!/bin/sh
# ms-authentication-api is stateless (no database, no migrations)
echo "Starting the application..."
exec "$@"
