#!/bin/sh
set -e

cd /app/server

echo "Running database migrations..."
if ! npx prisma migrate deploy; then
  echo "WARNING: prisma migrate deploy failed — API may not work until DATABASE_URL is correct"
fi

echo "Starting API on port 4000..."
node index.js &
API_PID=$!

echo "Waiting for API..."
ready=0
i=0
while [ "$i" -lt 30 ]; do
  if node -e "fetch('http://127.0.0.1:4000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" 2>/dev/null; then
    ready=1
    break
  fi
  if ! kill -0 "$API_PID" 2>/dev/null; then
    echo "ERROR: API process exited during startup"
    exit 1
  fi
  i=$((i + 1))
  sleep 2
done

if [ "$ready" -ne 1 ]; then
  echo "ERROR: API did not become healthy on /api/health"
  exit 1
fi

echo "API is up. Starting nginx on port 80..."
exec nginx -g "daemon off;"
