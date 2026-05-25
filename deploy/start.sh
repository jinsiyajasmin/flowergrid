#!/bin/sh
set -e

cd /app/server
echo "Running database migrations..."
npx prisma migrate deploy

echo "Starting API on port 4000..."
node index.js &

echo "Starting nginx on port 80..."
exec nginx -g "daemon off;"
