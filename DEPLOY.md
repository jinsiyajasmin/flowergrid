# Coolify deploy checklist (fix chat + signup)

## Quick check (run after deploy)

```bash
curl -sS https://luna.flowergrid.co.uk/api/health
```

**Must return JSON:** `{"status":"alive",...}`

| What you see | Fix |
|--------------|-----|
| Empty body + HTTP 500 | **Wrong image** — Vite dev (`frontend/Dockerfile.dev`). Use root `Dockerfile` and rebuild. |
| HTML / React page | SPA-only build — same fix as above. |
| JSON `alive` | API is up — set `DATABASE_URL`, `OPENAI_API_KEY`, Google OAuth in Coolify. |

```bash
curl -sS https://luna.flowergrid.co.uk/api/auth/google/status
```

Sign-up needs `"enabled":true` and `"database":"connected"`. Then `GET /api/auth/google` should return **302** to Google (not 500).

## If the browser calls `localhost:4000` on the live site

Coolify is running **Vite dev** (`npm run dev`) or `VITE_API_BASE` is set to a localhost URL. Fix:

1. Use **root `Dockerfile`** (production nginx + API), not `frontend/Dockerfile.dev`
2. **Remove** `VITE_API_BASE=http://localhost:4000` from Coolify env
3. Set `VITE_API_BASE=/api` or leave it empty
4. **Rebuild** (not restart only)

## Problem if chat/signup broken

Open: `https://luna.flowergrid.co.uk/api/health`

| Response | Meaning |
|----------|---------|
| `{"status":"alive"}` | API is running — check Google OAuth env vars |
| HTML / React page | **Wrong deploy** — Vite dev or SPA only, no API |

## Correct Coolify settings

1. **Repository root** as base directory (`/`), **not** `/frontend`
2. **Docker Compose file:** `docker-compose.yml` **or** Dockerfile: `Dockerfile` (repo root)
3. **Do not** use `docker-compose.dev.yaml`, `frontend/Dockerfile.dev`, or `npm run dev`
4. **One domain:** `luna.flowergrid.co.uk` → port **80**
5. **Environment variables:**

```
DATABASE_URL=<postgres connection string>
SESSION_SECRET=<long random string>
OPENAI_API_KEY=<key>
FRONTEND_URL=https://luna.flowergrid.co.uk
GOOGLE_CALLBACK_URL=https://luna.flowergrid.co.uk/api/auth/google/callback
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

Leave `VITE_API_BASE` unset (build uses `/api`).

6. **Redeploy** with **Build** (not restart only)

## Google OAuth console

| Field | URL |
|-------|-----|
| Authorized JavaScript origins | `https://luna.flowergrid.co.uk` |
| Authorized redirect URIs | `https://luna.flowergrid.co.uk/api/auth/google/callback` |
