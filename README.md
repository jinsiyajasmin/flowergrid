# FlowerGrid

Luna wellness chatbot — React frontend + Express API + PostgreSQL (Prisma).

## Local development (Docker)

Uses `docker-compose.dev.yaml` in the project root.

```bash
docker compose -f docker-compose.dev.yaml up --build -d
```

- Frontend: http://localhost:5173
- API: http://localhost:4000/api/health
- PostgreSQL: `localhost:5432` (user/password/db: `flowergrid`)

The server container runs `prisma migrate deploy` on startup to apply migrations.

## Local development (without Docker)

1. Copy `.env.example` to `.env` in the project root and set `DATABASE_URL` (and other secrets).
2. Server:

```bash
cd server
npm install
npx prisma migrate deploy
npm run dev
```

3. Frontend:

```bash
cd frontend
npm install
npm run dev
```

API base locally: `http://localhost:4000/api`

## Deploy on Coolify (recommended: one container)

Use **`docker-compose.yaml`** (production) or build root **`Dockerfile`** — **nginx + Express in one container**:

- Public site: `https://luna.flowergrid.co.uk` (port **80**)
- All API routes: `https://luna.flowergrid.co.uk/api/...` (e.g. `/api/chat`, `/api/auth/google`)

### Coolify setup

1. Build pack: **Docker Compose** — file `docker-compose.yaml` (or Dockerfile at repo root). Base Directory: **`/`** (not `/frontend`)
2. Do **not** use `docker-compose.dev.yaml` (Vite dev — breaks `/api/auth/google`)
3. Domain: **`luna.flowergrid.co.uk`** → port **80**
4. Environment variables:

   | Variable | Value |
   |----------|--------|
   | `DATABASE_URL` | Coolify Postgres connection string |
   | `SESSION_SECRET` | Long random string |
   | `OPENAI_API_KEY` | Your OpenAI key |
   | `FRONTEND_URL` | `https://luna.flowergrid.co.uk` |
   | `GOOGLE_CALLBACK_URL` | `https://luna.flowergrid.co.uk/api/auth/google/callback` |
   | `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | From Google Cloud |

5. Do **not** set a separate backend domain. Leave `VITE_API_BASE` empty (defaults to `/api` in the build).

6. **Redeploy** with **Build** (not restart only) after any change.

### Verify after deploy

```bash
curl -sS https://luna.flowergrid.co.uk/api/health
curl -sS https://luna.flowergrid.co.uk/api/auth/google/status
```

Expected: JSON with `"status":"alive"` and `"enabled":true` (when Google env vars are set).  
`GET /api/auth/google` should **redirect** to Google (302), not return 500.

### Google OAuth console (required)

[Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services** → **Credentials** → your OAuth 2.0 Client ID:

| Field | URL |
|-------|-----|
| **Authorized JavaScript origins** | `https://luna.flowergrid.co.uk` |
| **Authorized redirect URIs** | `https://luna.flowergrid.co.uk/api/auth/google/callback` |

Remove any `api.flowergrid.co.uk` or `localhost` entries unless you still use them for local dev.

Save in Google Console, wait a few minutes, then test **Sign up** and **chat**.

## Database

- **ORM:** [Prisma](https://www.prisma.io/)
- **Schema:** `server/prisma/schema.prisma`
- **Migrations:** `server/prisma/migrations/`

Useful commands (from `server/`):

```bash
npm run db:migrate   # create/apply migrations in dev
npm run db:deploy    # apply migrations (production)
npm run db:studio    # Prisma Studio GUI
```
