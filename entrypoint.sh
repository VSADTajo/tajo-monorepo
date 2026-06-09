#!/bin/sh
# Run database migrations
echo "Running database migrations..."
npm run migration:run:prod
# Start the application
echo "Starting the application..."
exec "$@"