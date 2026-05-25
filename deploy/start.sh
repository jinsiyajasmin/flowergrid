#!/bin/sh
set -e

cd /app/server

if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL is empty — set it in Coolify Environment Variables"
  exit 1
fi

echo "DATABASE_URL host check: $(node -e "try{const u=process.env.DATABASE_URL.trim().replace(/^[\"']|[\"']$/g,'');const h=new URL(u.replace(/^postgresql:/,'http:')).hostname;console.log(h)}catch(e){console.log('invalid URL')}")"

echo "Running database migrations..."
if ! npx prisma migrate deploy; then
  echo "ERROR: prisma migrate deploy failed — fix DATABASE_URL (Neon needs ?sslmode=require)"
  exit 1
fi

echo "Starting API on port 4000..."
node index.js &
API_PID=$!

echo "Waiting for API..."
ready=0
i=0
while [ "$i" -lt 45 ]; do
  if node -e "fetch('http://127.0.0.1:4000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" 2>/dev/null; then
    ready=1
    break
  fi
  if ! kill -0 "$API_PID" 2>/dev/null; then
    echo "ERROR: API process exited during startup"
    wait "$API_PID" 2>/dev/null || true
    exit 1
  fi
  i=$((i + 1))
  sleep 2
done

if [ "$ready" -ne 1 ]; then
  echo "ERROR: API did not become healthy on /api/health"
  kill "$API_PID" 2>/dev/null || true
  exit 1
fi

echo "API is up. Validating nginx configuration..."
if ! nginx -t 2>&1; then
  echo "ERROR: nginx configuration test failed"
  kill "$API_PID" 2>/dev/null || true
  exit 1
fi

echo "Starting nginx on port 80..."
exec nginx -g "daemon off;"
