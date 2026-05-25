# Coolify deploy checklist (fix chat + signup)

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
2. **Dockerfile:** `Dockerfile` (at repo root) **or** Compose: `docker-compose.coolify.yaml`
3. **Do not** use `frontend/Dockerfile.dev` or start command `npm run dev`
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
