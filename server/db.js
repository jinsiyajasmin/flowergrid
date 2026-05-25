import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

let lastConnectError = null;

export const DATABASE_URL_MISSING_MSG =
  'DATABASE_URL is not set in Coolify environment variables.';
export const DATABASE_URL_INVALID_MSG =
  'DATABASE_URL is set but invalid (must start with postgresql:// or postgres://)';

export function isDatabaseUrlEnvSet(raw = process.env.DATABASE_URL) {
  return Boolean(raw && typeof raw === 'string' && raw.trim());
}

/** Record why connect was skipped (malformed / missing URL). */
export function recordDatabaseUrlConfigError(raw = process.env.DATABASE_URL) {
  if (normalizeDatabaseUrl(raw)) {
    return false;
  }
  lastConnectError = isDatabaseUrlEnvSet(raw)
    ? DATABASE_URL_INVALID_MSG
    : DATABASE_URL_MISSING_MSG;
  return true;
}

/** Strip quotes from Coolify copy-paste; add sslmode for Neon. */
export function normalizeDatabaseUrl(raw) {
  if (!raw || typeof raw !== 'string') return null;
  let url = raw.trim().replace(/^["']|["']$/g, '');
  if (!url.startsWith('postgresql://') && !url.startsWith('postgres://')) {
    return null;
  }
  if (/neon\.tech/i.test(url) && !/sslmode=/i.test(url)) {
    url += url.includes('?') ? '&sslmode=require' : '?sslmode=require';
  }
  return url;
}

export function getDatabaseHostHint(url) {
  try {
    const normalized = url.replace(/^postgres(ql)?:/, 'http:');
    return new URL(normalized).hostname;
  } catch {
    return 'unknown';
  }
}

const connectDB = async () => {
  const normalized = normalizeDatabaseUrl(process.env.DATABASE_URL);
  if (!normalized) {
    recordDatabaseUrlConfigError(process.env.DATABASE_URL);
    throw new Error(lastConnectError);
  }

  process.env.DATABASE_URL = normalized;
  const host = getDatabaseHostHint(normalized);
  console.log(`Connecting to PostgreSQL (${host})…`);

  try {
    await prisma.$connect();
    lastConnectError = null;
    console.log('✅ PostgreSQL connected');
  } catch (err) {
    lastConnectError = err?.message || String(err);
    console.error('PostgreSQL connection failed:', lastConnectError);
    throw err;
  }
};

export function getLastDatabaseError() {
  return lastConnectError;
}

export { prisma };
export default connectDB;
