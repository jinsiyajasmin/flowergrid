# Coolify deployment (Luna / FlowerGrid)

## Required settings

| Setting | Value |
|---------|--------|
| **Base Directory** | `/` (repository root) |
| **Build Pack** | Docker Compose |
| **Docker Compose file** | `docker-compose.yaml` |
| **Port** | `80` (in Coolify → Configuration → Ports / Public URL) |

Do **not** use `docker-compose.dev.yaml`, `frontend/Dockerfile.dev`, or base directory `/frontend`.

## Environment variables

Set these in Coolify → Environment Variables:

```
DATABASE_URL=<Neon or Postgres URL>
SESSION_SECRET=<long random string>
OPENAI_API_KEY=<your key>
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
FRONTEND_URL=https://luna.flowergrid.co.uk
GOOGLE_CALLBACK_URL=https://luna.flowergrid.co.uk/api/auth/google/callback
# (Production always uses this URL in code even if env is wrong — must match Google Console.)
```

Do **not** set `VITE_API_BASE=http://localhost:4000`.

## Deploy

1. Push to Git
2. Coolify → **Redeploy** → enable **Build** (not restart only)
3. Watch logs for:
   - `API is up. Validating nginx configuration...`
   - `Starting nginx on port 80...`
   - No `nginx: [emerg]` errors

## Verify

```bash
curl -sS https://luna.flowergrid.co.uk/api/health
curl -sS -o /dev/null -w "%{http_code}\n" https://luna.flowergrid.co.uk/
curl -sS -o /dev/null -w "%{http_code}\n" https://luna.flowergrid.co.uk/api/auth/google
```

| Check | Expected |
|-------|----------|
| `/api/health` | JSON `{"status":"alive",...}` |
| `/` | `200` (React app) |
| `/api/auth/google` | `302` redirect to Google (or `503` JSON if OAuth env missing) |

## Google Cloud Console

**→ Full guide: [GOOGLE_OAUTH.md](./GOOGLE_OAUTH.md)** (fixes `redirect_uri_mismatch`)

| Field | URL |
|-------|-----|
| JavaScript origins | `https://luna.flowergrid.co.uk` |
| Redirect URI | `https://luna.flowergrid.co.uk/api/auth/google/callback` |

Use `curl https://luna.flowergrid.co.uk/api/auth/google/status` and match `clientIdSuffix` to the OAuth client you edit in Google Console. Click **Save** after changes.

## Troubleshooting

| Symptom | Cause | Fix |
|---------|--------|-----|
| **502 Bad Gateway** | nginx failed to start | Redeploy latest commit (Alpine nginx uses `http.d/`, not `upstream` in `conf.d`) |
| **500 on `/api/*`**, empty body | Vite dev deployed | Use `docker-compose.yaml` + root `Dockerfile` |
| **Sign-in 404** | Wrong callback URL | Must include `/api` prefix in Google Console + `GOOGLE_CALLBACK_URL` |
| **Chat 503** | Missing `OPENAI_API_KEY` | Set in Coolify env |
