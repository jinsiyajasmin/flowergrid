# FlowerGrid

Luna wellness chatbot — React frontend + Express API + PostgreSQL (Prisma).

## Local development (Docker)

Uses `docker-compose.yaml` in the project root.

```bash
docker compose up --build -d
```

- Frontend: http://localhost:5173
- API: http://localhost:4000/health
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

## Deploy on Coolify (external database)

Use `docker-compose.coolify.yaml` — it runs **server + frontend only** (no Postgres container). You attach your own database in Coolify after deploy.

1. In Coolify, create a new **Docker Compose** resource from this repo.
2. Set **Docker Compose Location** to `docker-compose.coolify.yaml`.
3. Create a **PostgreSQL** database in Coolify (or use an existing one).
4. Set environment variables on the compose stack (see `.env.example`):

   | Variable | Example |
   |----------|---------|
   | `DATABASE_URL` | From Coolify Postgres → Connection string |
   | `SESSION_SECRET` | Long random string |
   | `OPENAI_API_KEY` | Your OpenAI key |
   | `FRONTEND_URL` | `https://luna.flowergrid.co.uk` |
   | `VITE_API_BASE` | `https://api.flowergrid.co.uk` |
   | `GOOGLE_CALLBACK_URL` | `https://api.flowergrid.co.uk/auth/google/callback` |
   | `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth console |

5. Assign domains in Coolify:
   - **server** → `api.flowergrid.co.uk` (container port **`4000`**)
   - **frontend** → `luna.flowergrid.co.uk` (container port **`80`**)

6. Google OAuth console:
   - **Authorized JavaScript origins:** `https://luna.flowergrid.co.uk`
   - **Authorized redirect URIs:** `https://api.flowergrid.co.uk/auth/google/callback`

7. **Redeploy** after changing `DATABASE_URL` or `VITE_API_BASE` (frontend API URL is set at image build time).

The server container runs `prisma migrate deploy` on startup against `DATABASE_URL`.

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
