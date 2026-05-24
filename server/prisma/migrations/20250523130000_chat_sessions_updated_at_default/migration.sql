-- Ensure updated_at has a DB default for INSERTs (Prisma @updatedAt + upsert create path).
ALTER TABLE "chat_sessions"
  ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;
