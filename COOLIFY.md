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

Names must match `docker-compose.yaml` exactly. See `coolify.env.example` for a full list.

| Variable | Example / notes |
|----------|-----------------|
| `DATABASE_URL` | Neon URL **must** end with `?sslmode=require` (see below) |
| `SESSION_SECRET` | Long random string |
| `OPENAI_API_KEY` | Your OpenAI key |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` (optional) |
| `CHAT_MODEL` | `gpt-4o` (optional) |
| `EMBED_MODEL` | `text-embedding-3-small` (optional) |
| `GOOGLE_CLIENT_ID` | From Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | Same OAuth client as above |
| `GOOGLE_CALLBACK_URL` | `https://luna.flowergrid.co.uk/api/auth/google/callback` |
| `FRONTEND_URL` | `https://luna.flowergrid.co.uk` |

`NODE_ENV` and `PORT` are set in the compose file — you do not need to add them in Coolify unless you want to override.

Do **not** set `VITE_API_BASE` in Coolify.

After changing env vars → **Redeploy** (restart container).

### Neon `DATABASE_URL` format

```text
postgresql://USER:PASSWORD@ep-xxxx-pooler.region.aws.neon.tech/neondb?sslmode=require
```

Copy from Neon dashboard → Connection string → **Pooled connection**.  
Do **not** use `localhost` or your local `.env` URL in Coolify.

Check after deploy:

```bash
curl -sS https://luna.flowergrid.co.uk/api/health
```

Expected: `"database":"connected"`. If `"not_connected"`, read `databaseHint` in the JSON.

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
