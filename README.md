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
