#!/bin/sh
set -e

# Run migrations on every container start (idempotent, skips already-applied)
if [ "${SKIP_MIGRATIONS}" != "true" ]; then
  echo "Running database migrations..."
  node packages/db/dist/migrate.js
  echo "Migrations complete."
fi

# If CMD was overridden (e.g., worker), use it; otherwise run the API server
if [ "$#" -gt 0 ]; then
  exec "$@"
else
  exec node apps/api/dist/server.js
fi
