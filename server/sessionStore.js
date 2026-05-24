import { prisma } from './db.js';

const SESSION_MAX_MESSAGES = parseInt(process.env.SESSION_MAX_MESSAGES || '8', 10);

/** Must match LOGGED_IN_PRACTITIONER_REPLY_AT in index.js — trigger when prior bot count equals this. */
const PRACTITIONER_PRIOR_BOT_COUNT = 6;
const BOOKING_URL = 'https://flowergrid.co.uk/booking';

function cacheSessionState(sessionId, state) {
  memoryCache.set(sessionId, state);
  return state;
}

async function linkUserToSession(sessionId, state, userId) {
  if (!userId || state.userId) return state;
  state.userId = userId;
  cacheSessionState(sessionId, state);
  await persistSession(sessionId, state).catch(console.error);
  return state;
}

/**
 * Infer whether the practitioner milestone already occurred (use full conversation, not short window).
 * /chat triggers when botReplyCount === PRACTITIONER_PRIOR_BOT_COUNT (6 prior Luna replies → 7th is practitioner).
 * Use > 6 here (not >= 6): at exactly 6 assistant messages the milestone has not fired yet.
 */
function inferPractitionerSuggested(messages) {
  if (
    messages.some(
      (m) => m.role === 'assistant' && String(m.content).includes(BOOKING_URL)
    )
  ) {
    return true;
  }
  const assistantCount = messages.filter((m) => m.role === 'assistant').length;
  return assistantCount > PRACTITIONER_PRIOR_BOT_COUNT;
}

/** @type {Map<string, { shortMessages: object[], fullMessages: object[], guestExhausted: boolean, practitionerSuggested: boolean, userId: string | null }>} */
const memoryCache = new Map();

function normalizeMessages(messages) {
  if (!Array.isArray(messages)) return [];
  return messages
    .filter((m) => m && typeof m.content === 'string')
    .map((m) => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.content,
    }));
}

function cacheFromRow(row) {
  return {
    shortMessages: normalizeMessages(row.shortMessages),
    fullMessages: normalizeMessages(row.fullMessages),
    guestExhausted: Boolean(row.guestExhausted),
    practitionerSuggested: Boolean(row.practitionerSuggested),
    userId: row.userId ?? null,
  };
}

async function loadFromDb(sessionId) {
  return prisma.chatSession.findUnique({ where: { sessionId } });
}

async function persistSession(sessionId, state) {
  const shortMessages = state.shortMessages.slice(-SESSION_MAX_MESSAGES);
  const fullMessages = state.fullMessages;

  await prisma.chatSession.upsert({
    where: { sessionId },
    create: {
      sessionId,
      userId: state.userId,
      shortMessages,
      fullMessages,
      guestExhausted: state.guestExhausted,
      practitionerSuggested: state.practitionerSuggested,
    },
    update: {
      userId: state.userId ?? undefined,
      shortMessages,
      fullMessages,
      guestExhausted: state.guestExhausted,
      practitionerSuggested: state.practitionerSuggested,
    },
  });

  memoryCache.set(sessionId, {
    ...state,
    shortMessages,
    fullMessages,
  });
}

export async function ensureSession(sessionId, userId = null) {
  if (!sessionId) return null;

  if (memoryCache.has(sessionId)) {
    const cached = memoryCache.get(sessionId);
    return linkUserToSession(sessionId, cached, userId);
  }

  const row = await loadFromDb(sessionId);
  if (row) {
    const state = cacheFromRow(row);
    cacheSessionState(sessionId, state);
    return linkUserToSession(sessionId, state, userId);
  }

  const empty = {
    shortMessages: [],
    fullMessages: [],
    guestExhausted: false,
    practitionerSuggested: false,
    userId: userId ?? null,
  };
  cacheSessionState(sessionId, empty);
  await persistSession(sessionId, empty).catch(console.error);
  return empty;
}

export async function getSessionMessages(sessionId) {
  const state = await ensureSession(sessionId);
  return state?.shortMessages ?? [];
}

export async function getFullSessionMessages(sessionId) {
  const state = await ensureSession(sessionId);
  return state?.fullMessages ?? [];
}

export async function countBotMessages(sessionId) {
  const messages = await getSessionMessages(sessionId);
  return messages.filter((m) => m.role === 'assistant').length;
}

export async function isPractitionerSuggested(sessionId) {
  const state = await ensureSession(sessionId);
  return Boolean(state?.practitionerSuggested);
}

export async function isGuestExhausted(sessionId) {
  const state = await ensureSession(sessionId);
  return Boolean(state?.guestExhausted);
}

export async function setGuestExhausted(sessionId, value = true, userId = null) {
  const state = await ensureSession(sessionId, userId);
  if (!state) return;
  state.guestExhausted = value;
  await persistSession(sessionId, state);
}

export async function setPractitionerSuggested(sessionId, userId = null) {
  const state = await ensureSession(sessionId, userId);
  if (!state) return;
  state.practitionerSuggested = true;
  await persistSession(sessionId, state);
}

export async function recordChatExchange(sessionId, userText, botText, userId = null) {
  if (!sessionId) return;

  const state = await ensureSession(sessionId, userId);
  if (!state) return;

  state.fullMessages.push({ role: 'user', content: userText });
  state.fullMessages.push({ role: 'assistant', content: botText });
  state.shortMessages.push({ role: 'user', content: userText });
  state.shortMessages.push({ role: 'assistant', content: botText });
  state.shortMessages = state.shortMessages.slice(-SESSION_MAX_MESSAGES);

  if (userId) state.userId = userId;

  await persistSession(sessionId, state);
}

/** Replace server session from saved conversation (resume sidebar chat). */
export async function resumeSession(sessionId, messages, userId) {
  if (!sessionId) return;

  const normalized = normalizeMessages(messages);
  const existingRow = await loadFromDb(sessionId);
  const existing = existingRow ? cacheFromRow(existingRow) : null;
  const shortMessages = normalized.slice(-SESSION_MAX_MESSAGES);

  const state = {
    shortMessages,
    fullMessages: normalized,
    guestExhausted: existing?.guestExhausted ?? false,
    practitionerSuggested: existing
      ? existing.practitionerSuggested
      : inferPractitionerSuggested(normalized),
    userId: userId ?? existing?.userId ?? null,
  };

  cacheSessionState(sessionId, state);
  await persistSession(sessionId, state);
}

export async function clearSession(sessionId) {
  if (!sessionId) return;
  memoryCache.delete(sessionId);
  try {
    await prisma.chatSession.delete({ where: { sessionId } });
  } catch {
    // Row may not exist
  }
}

export async function syncSessionFromSummary(sessionId, userId) {
  if (!sessionId || !userId) return;

  const summary = await prisma.chatSummary.findUnique({
    where: {
      userId_sessionId: { userId, sessionId },
    },
  });

  if (summary?.messages) {
    await resumeSession(sessionId, summary.messages, userId);
  }
}
