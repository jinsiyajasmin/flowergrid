import crypto from 'crypto';
import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import OpenAI from 'openai';
import session from 'express-session';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import connectDB, {
  prisma,
  normalizeDatabaseUrl,
  getLastDatabaseError,
  getDatabaseHostHint,
} from './db.js';
import {
  ensureSession,
  getSessionMessages,
  getFullSessionMessages,
  countBotMessages,
  recordChatExchange,
  resumeSession,
  clearSession,
  syncSessionFromSummary,
  isPractitionerSuggested,
  setPractitionerSuggested,
  isGuestExhausted as isSessionGuestExhausted,
  setGuestExhausted,
  setDbPersistenceEnabled,
} from './sessionStore.js';
import { fileURLToPath } from 'url';




const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

const PORT = process.env.PORT || 4000;
const KB_DIR = path.join(__dirname, 'kb');
const KB_EMBED_MODEL = process.env.EMBED_MODEL || 'text-embedding-3-small';
const SESSION_MAX_MESSAGES = 8;
const KB_EMBED_SLICE_LIMIT = parseInt(process.env.EMBED_SLICE_LIMIT || '24000', 10);
const KB_EMBED_CHUNK_OVERLAP = 200;

const LIVE_SITE_URL = 'https://luna.flowergrid.co.uk';
const GOOGLE_CALLBACK_PATH = '/api/auth/google/callback';

const PRODUCTION_CALLBACK_URL = `${LIVE_SITE_URL}${GOOGLE_CALLBACK_PATH}`;

function isProductionDeploy() {
  return (
    process.env.NODE_ENV === 'production' ||
    process.env.FRONTEND_URL?.includes('luna.flowergrid.co.uk') ||
    process.env.GOOGLE_CALLBACK_URL?.includes('luna.flowergrid.co.uk')
  );
}

/** Must match Google Console → Authorized redirect URIs exactly (always HTTPS on luna). */
function getGoogleCallbackUrl() {
  if (isProductionDeploy()) {
    return PRODUCTION_CALLBACK_URL;
  }
  const fromEnv = process.env.GOOGLE_CALLBACK_URL?.trim();
  if (fromEnv) {
    let url = fromEnv;
    if (url.includes('/auth/google/callback') && !url.includes('/api/auth/google/callback')) {
      url = url.replace('/auth/google/callback', '/api/auth/google/callback');
    }
    return url.replace(/\/$/, '');
  }
  return `http://localhost:4000${GOOGLE_CALLBACK_PATH}`;
}

/** Build Google authorize URL with an explicit redirect_uri (avoids passport/proxy quirks). */
function buildGoogleAuthorizeUrl(state) {
  const redirectUri = getGoogleCallbackUrl();
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: getGoogleClientId(),
    redirect_uri: redirectUri,
    scope: 'profile email',
    access_type: 'online',
    include_granted_scopes: 'true',
  });
  if (state) params.set('state', state);
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

function getGoogleClientId() {
  return process.env.GOOGLE_CLIENT_ID?.trim() || '';
}

const allowedOrigins = [
  LIVE_SITE_URL,
  'https://flowergrid.vercel.app',
  'http://localhost:5173',
  'http://localhost:4000',
];
if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL.replace(/\/$/, ''));
}

if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
  app.use((req, res, next) => {
    const proto = (req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
    if (proto === 'http' && req.method === 'GET') {
      return res.redirect(301, `https://${req.headers.host}${req.originalUrl}`);
    }
    next();
  });
}

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    const normalized = origin.replace(/\/$/, '');
    if (allowedOrigins.some((o) => o.replace(/\/$/, '') === normalized)) {
      return callback(null, true);
    }
    // Same-host deploy (nginx proxy) or flowergrid production domains
    if (/^https:\/\/([a-z0-9-]+\.)*flowergrid\.co\.uk$/i.test(normalized)) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id']
}));

let KB_TEXTS = [];
let isInitialized = false;
let dbReady = false;
let kbIndexReady = false;
let dbConnectAttempts = 0;

async function ensureDatabase() {
  if (dbReady) return true;
  const url = normalizeDatabaseUrl(process.env.DATABASE_URL);
  if (!url) return false;

  try {
    await connectDB();
    dbReady = true;
    setDbPersistenceEnabled(true);
    console.log('✅ Database ready');
    return true;
  } catch {
    dbReady = false;
    setDbPersistenceEnabled(false);
    return false;
  }
}

function databaseStatusPayload() {
  const url = normalizeDatabaseUrl(process.env.DATABASE_URL);
  return {
    database: dbReady ? 'connected' : 'not_connected',
    databaseConfigured: Boolean(url),
    databaseHost: url ? getDatabaseHostHint(url) : null,
    databaseHint: dbReady
      ? null
      : getLastDatabaseError() ||
        (url
          ? 'Cannot reach PostgreSQL. For Neon add ?sslmode=require to DATABASE_URL and redeploy.'
          : 'DATABASE_URL is not set in Coolify environment variables.'),
  };
}

app.get('/health', (req, res) => res.json({ status: 'alive' }));
app.get('/api/health', async (req, res) => {
  await ensureDatabase();
  res.json({
    status: 'alive',
    ready: isInitialized,
    ...databaseStatusPayload(),
  });
});

app.get('/', (req, res) => res.send("FlowerGrid API is running"));

app.use((req, res, next) => {
  console.log(`Incoming request: ${req.method} ${req.url}`);
  next();
});

app.use(express.json());

const sessionSecret = process.env.SESSION_SECRET?.trim();
if (process.env.NODE_ENV === 'production' && !sessionSecret) {
  console.warn('WARNING: SESSION_SECRET is not set — set it in Coolify for secure sessions');
}

app.use(
  session({
    secret: sessionSecret || 'flora-dev-only-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
      sameSite: 'lax',
    }
  })
);

app.use(passport.initialize());
app.use(passport.session());

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});
app.options('*', cors());
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL || undefined
});

const googleOAuthEnabled = Boolean(
  getGoogleClientId() && process.env.GOOGLE_CLIENT_SECRET?.trim()
);

let googleStrategyConfigured = false;

function configureGoogleOAuth() {
  if (!googleOAuthEnabled || googleStrategyConfigured) return;

  const callbackURL = getGoogleCallbackUrl();
  const clientID = getGoogleClientId();

  passport.use(
    new GoogleStrategy(
      {
        clientID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          if (!dbReady) {
            return done(
              new Error('Database is not available for sign-in'),
              null
            );
          }
          const existingUser = await prisma.user.findUnique({
            where: { googleId: profile.id },
          });

          if (existingUser) {
            const updatedUser = await prisma.user.update({
              where: { id: existingUser.id },
              data: { lastLogin: new Date() },
            });
            return done(null, updatedUser);
          }

          const newUser = await prisma.user.create({
            data: {
              googleId: profile.id,
              name: profile.displayName,
              email: profile.emails?.[0]?.value,
              avatar: profile.photos?.[0]?.value,
            },
          });

          return done(null, newUser);
        } catch (err) {
          return done(err, null);
        }
      }
    )
  );

  googleStrategyConfigured = true;
  console.log(`Google OAuth client: ${clientID.slice(0, 12)}...${clientID.slice(-8)}`);
  console.log(`Google OAuth callback: ${callbackURL}`);
}

async function initializeApp() {
  if (isInitialized) return;
  loadFloraPrompt();
  configureGoogleOAuth();
  dbConnectAttempts += 1;
  await ensureDatabase();
  if (!dbReady) {
    console.error(
      'PostgreSQL unavailable — sign-in and saved chats need DATABASE_URL. Error:',
      getLastDatabaseError() || 'unknown'
    );
  }
  isInitialized = true;
}

async function ensureKbIndex() {
  if (kbIndexReady) return;
  try {
    await buildIndex();
  } catch (err) {
    console.error('KB index build failed (chat continues without RAG):', err);
  }
  kbIndexReady = true;
}

app.use(async (req, res, next) => {
  try {
    await initializeApp();
    next();
  } catch (err) {
    console.error('Initialization failed:', err);
    next(err);
  }
});

if (!googleOAuthEnabled) {
  console.warn(
    'Google OAuth disabled — set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Coolify'
  );
}


passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  done(null, user);
});

const api = express.Router();

async function requireGoogleOAuth(req, res, next) {
  if (!googleOAuthEnabled) {
    return res.status(503).json({
      error: 'Google sign-in is not configured',
      hint: 'Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Coolify.',
    });
  }
  await ensureDatabase();
  if (!dbReady) {
    return res.status(503).json({
      error: 'Database is not connected',
      ...databaseStatusPayload(),
    });
  }
  next();
}

const googleOAuthScopes = ['profile', 'email'];

function googleAuthFailureRedirect() {
  return (
    process.env.FRONTEND_URL?.replace(/\/$/, '') ||
    (process.env.NODE_ENV === 'production' ? LIVE_SITE_URL : 'http://localhost:5173')
  );
}

api.get('/auth/google/status', async (req, res) => {
  await ensureDatabase();
  const clientId = getGoogleClientId();
  const callbackUrl = getGoogleCallbackUrl();
  res.json({
    enabled: googleOAuthEnabled,
    ...databaseStatusPayload(),
    callbackUrl,
    startUrl: isProductionDeploy()
      ? `${LIVE_SITE_URL}/api/auth/google`
      : 'http://localhost:4000/api/auth/google',
    clientId,
    redirectUrisForGoogleConsole: [callbackUrl],
    javascriptOriginsForGoogleConsole: [
      isProductionDeploy() ? LIVE_SITE_URL : 'http://localhost:5173',
    ],
    authorizeUrlPreview: googleOAuthEnabled ? buildGoogleAuthorizeUrl() : null,
    hint:
      'redirect_uri_mismatch: open /api/auth/google/help — add redirectUrisForGoogleConsole to the OAuth client whose Client ID matches clientId above, then Save.',
  });
});

api.get('/auth/google/help', (req, res) => {
  const clientId = getGoogleClientId();
  const callbackUrl = getGoogleCallbackUrl();
  res.type('html').send(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Luna Google OAuth Setup</title>
<style>body{font-family:system-ui;max-width:720px;margin:2rem auto;padding:0 1rem;line-height:1.5}
code{background:#f3f4f6;padding:2px 6px;border-radius:4px;word-break:break-all}
ol li{margin:.5rem 0}</style></head><body>
<h1>Fix Google redirect_uri_mismatch</h1>
<p>In <a href="https://console.cloud.google.com/apis/credentials">Google Cloud Console → Credentials</a>,
open the OAuth client whose <strong>Client ID</strong> matches Coolify <code>GOOGLE_CLIENT_ID</code> exactly:</p>
<p><code>${clientId || '(not set)'}</code></p>
<h2>Authorized redirect URIs — add this exactly</h2>
<p><code>${callbackUrl}</code></p>
<p>Remove wrong URIs such as <code>https://luna.flowergrid.co.uk/auth/google/callback</code> (missing <code>/api</code>).</p>
<h2>Authorized JavaScript origins</h2>
<p><code>${LIVE_SITE_URL}</code></p>
<p>Click <strong>Save</strong>, wait 5 minutes, then sign in from <a href="${LIVE_SITE_URL}/api/auth/google">${LIVE_SITE_URL}/api/auth/google</a></p>
</body></html>`);
});

api.get('/auth/google', requireGoogleOAuth, (req, res) => {
  const state = crypto.randomBytes(16).toString('hex');
  req.session.oauthState = state;
  res.redirect(buildGoogleAuthorizeUrl(state));
});

api.get(
  '/auth/google/callback',
  requireGoogleOAuth,
  (req, res, next) => {
    const expectedState = req.session?.oauthState;
    if (expectedState && req.query.state !== expectedState) {
      console.error('Google OAuth state mismatch');
      return res.redirect(`${googleAuthFailureRedirect()}?oauth_error=state`);
    }
    delete req.session.oauthState;
    next();
  },
  passport.authenticate('google', {
    failureRedirect: googleAuthFailureRedirect(),
  }),
  (req, res) => {
    res.redirect(googleAuthFailureRedirect());
  }
);

api.get('/auth/me', async (req, res) => {
  try {
    if (req.isAuthenticated?.() && req.user) {
      return res.json({ user: publicUser(req.user) });
    }
    const user = await getRequestUser(req);
    if (user) {
      return res.json({ user: publicUser(user) });
    }
    res.json({ user: null });
  } catch (err) {
    console.error('Auth me error:', err);
    res.status(500).json({ error: 'Failed to load user' });
  }
});

api.post('/auth/logout', (req, res) => {
  const finish = () => {
    clearGuestExhaustedCookie(res);
    clearChatSessionCookie(res);
    res.json({ success: true });
  };

  if (typeof req.logout === 'function') {
    req.logout((err) => {
      if (err) console.error('Logout error:', err);
      if (req.session?.destroy) {
        req.session.destroy(() => finish());
      } else {
        finish();
      }
    });
  } else {
    finish();
  }
});


// Stateless authentication middleware for Vercel
async function authenticateUser(req, res, next) {
  try {
    const userId = req.headers['x-user-id'];

    if (!userId) {
      // Check if session-based auth worked (for local development)
      if (req.user) {
        return next();
      }
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Validate user exists in database
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid user' });
    }

    // Attach user to request
    req.user = user;
    next();
  } catch (err) {
    console.error('Auth error:', err);
    return res.status(401).json({ error: 'Authentication failed' });
  }
}

const GUEST_BOT_REPLY_LIMIT = 5;
const GUEST_EXHAUSTED_COOKIE = 'flora_guest_exhausted';
const CHAT_SESSION_COOKIE = 'flora_chat_session';

function parseCookies(req) {
  const header = req.headers.cookie;
  if (!header) return {};
  return Object.fromEntries(
    header.split(';').map((part) => {
      const [key, ...rest] = part.trim().split('=');
      return [key, decodeURIComponent(rest.join('='))];
    })
  );
}

function isGuestExhausted(req) {
  return parseCookies(req)[GUEST_EXHAUSTED_COOKIE] === '1';
}

const COOKIE_SAME_SITE = 'lax';
const COOKIE_SECURE = process.env.NODE_ENV === 'production';

function setGuestExhaustedCookie(res) {
  res.cookie(GUEST_EXHAUSTED_COOKIE, '1', {
    maxAge: 365 * 24 * 60 * 60 * 1000,
    httpOnly: true,
    sameSite: COOKIE_SAME_SITE,
    secure: COOKIE_SECURE,
    path: '/',
  });
}

function clearGuestExhaustedCookie(res) {
  res.clearCookie(GUEST_EXHAUSTED_COOKIE, {
    path: '/',
    sameSite: COOKIE_SAME_SITE,
    secure: COOKIE_SECURE,
  });
}

function getChatSessionCookie(req) {
  return parseCookies(req)[CHAT_SESSION_COOKIE] || null;
}

function setChatSessionCookie(res, sessionId) {
  res.cookie(CHAT_SESSION_COOKIE, sessionId, {
    maxAge: 30 * 24 * 60 * 60 * 1000,
    httpOnly: true,
    sameSite: COOKIE_SAME_SITE,
    secure: COOKIE_SECURE,
    path: '/',
  });
}

function clearChatSessionCookie(res) {
  res.clearCookie(CHAT_SESSION_COOKIE, {
    path: '/',
    sameSite: COOKIE_SAME_SITE,
    secure: COOKIE_SECURE,
  });
}

function resolveSessionId(req) {
  const fromBody = req.body?.sessionId;
  if (fromBody && typeof fromBody === 'string') return fromBody;
  return getChatSessionCookie(req);
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatar: user.avatar ?? null,
  };
}

async function isGuestLimitReached(sessionId, req) {
  const user = await getRequestUser(req);
  if (user) return false;
  if (isGuestExhausted(req)) return true;
  if (sessionId && (await isSessionGuestExhausted(sessionId))) return true;
  if (sessionId) {
    const botReplyCount = await countBotMessages(sessionId);
    if (botReplyCount >= GUEST_BOT_REPLY_LIMIT) return true;
  }
  return false;
}

/** Guest limit flags for /chat JSON responses (persist exhausted state when limit hit). */
async function guestResponseFlags(sessionId, req, res) {
  const user = await getRequestUser(req);
  if (user) {
    return { guestLimitReached: false, disableInput: false };
  }

  const limited = await isGuestLimitReached(sessionId, req);
  if (limited) {
    if (!(await isSessionGuestExhausted(sessionId))) {
      await setGuestExhausted(sessionId, true, null);
    }
    setGuestExhaustedCookie(res);
  }

  return {
    guestLimitReached: limited,
    disableInput: limited,
  };
}

const LOGGED_IN_PRACTITIONER_REPLY_AT = 6; // 7th Luna reply (after 6 prior bot answers)
const BOOKING_URL = 'https://flowergrid.co.uk/booking';

const LOGIN_REQUIRED_MESSAGE =
  'You have used your free messages with Luna.\n\n' +
  'To continue this conversation, please sign up or log in with Google using the Sign up button above. ' +
  'Once you are signed in, you can chat with Luna without this limit.\n\n' +
  'Thank you for spending time with me today — I would love to keep supporting you when you are ready.';

async function getRequestUser(req) {
  if (req.user) return req.user;
  const userId = req.headers['x-user-id'];
  if (!userId) return null;
  try {
    return await prisma.user.findUnique({ where: { id: userId } });
  } catch {
    return null;
  }
}
function isAdmin(req) {
  return req.user?.email === "admin@flowergrid.co.uk";
}

async function checkGuestReplyLimit(sessionId, req, userText, res) {
  const user = await getRequestUser(req);
  if (user) return null;

  await ensureSession(sessionId, null);

  const botReplyCount = await countBotMessages(sessionId);
  const exhausted =
    isGuestExhausted(req) ||
    (await isSessionGuestExhausted(sessionId)) ||
    botReplyCount >= GUEST_BOT_REPLY_LIMIT;

  if (!exhausted) return null;

  await recordChatExchange(sessionId, userText, LOGIN_REQUIRED_MESSAGE, null);
  await setGuestExhausted(sessionId, true, null);
  if (res) setGuestExhaustedCookie(res);
  return {
    answer: LOGIN_REQUIRED_MESSAGE,
    disableInput: true,
    guestLimitReached: true,
  };
}

async function generatePractitionerRecommendation(history, latestUserMessage) {
  const conversation = [
    ...history,
    { role: 'user', content: latestUserMessage },
  ]
    .map((m) => `${m.role === 'user' ? 'User' : 'Luna'}: ${m.content}`)
    .join('\n');

  const systemPrompt = `You are Luna, the wellness companion for Flowergrid UK.

The user is signed in and has been chatting with you. This is the right moment to offer a thoughtful practitioner recommendation based on everything they have shared (their concerns, emotional themes, goals, and any personality clues).

Your reply MUST:
1. Warmly reflect what you understand about their situation (2–3 sentences, British English).
2. Name the best-matching Flowergrid service area (e.g. Therapeutic & Mental Wellness, Life Coaching & Transformation, Medical & Aesthetic Wellness, Holistic & Energy Healing, Leadership and Soft Skills Coaching).
3. Recommend ONE primary practitioner by name from this list only, and optionally one brief alternative:
   - Dr. Hana Patel — Medical & Aesthetic Wellness
   - Samina Khan (Simmi) — Life Coaching & Holistic Healing / Reiki
   - Yvonne Hewitt — Hypnotherapy & RTT — Therapeutic & Mental Wellness
   - Runa Boolaky — NLP & Life Coaching
   - Dr. Ravinder — Holistic & Energy Healing (cupping, Reiki, etc.)
   - Munira — NLP & RTT — Therapeutic & Mental Wellness
   - Husna Hoque — Personal Trainer & Wellness Coach
   - Dr. Renuka Marley (Dr. Renu) — Nutrition & medical wellness coaching
   - Rebecca — Nutrition & Fitness Coach
   - Tamkin — Counselling & career / life direction
4. Explain clearly WHY this practitioner fits their issue or personality (2–3 sentences). If they mentioned personality, stress type, relationships, body image, spirituality, work pressure, etc., tie your match to that.
5. Include this exact booking URL on its own line: ${BOOKING_URL}
6. End with gentle encouragement to book when they feel ready.

About 5–8 sentences total. Sound caring and natural, not salesy. Do not mention message counts or that this is an automated milestone.`;

  const resp = await openai.chat.completions.create({
    model: process.env.CHAT_MODEL || 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `Full conversation:\n${conversation.slice(0, 12000)}`,
      },
    ],
    temperature: 0.4,
    max_completion_tokens: 500,
  });

  let reply =
    resp?.choices?.[0]?.message?.content?.trim() ||
    `From what you have shared, I think Flowergrid could support you well. Please book a session with a practitioner who fits your needs: ${BOOKING_URL}`;

  if (!reply.includes(BOOKING_URL)) {
    reply += `\n\nBook here when you are ready: ${BOOKING_URL}`;
  }

  return reply;
}

async function generateChatSummary(messages) {
  if (!messages.length) return '';

  const conversation = messages
    .map(m => `${m.role === 'user' ? 'User' : 'Luna'}: ${m.content}`)
    .join('\n');

  const resp = await openai.chat.completions.create({
    model: process.env.CHAT_MODEL || 'gpt-4o',
    messages: [
      {
        role: 'system',
        content:
          'Summarise this conversation in 3 to 5 sentences, focusing on the main concerns and emotional themes.',
      },
      {
        role: 'user',
        content: conversation.slice(0, 8000),
      },
    ],
    temperature: 0.3,
    max_completion_tokens: 180,
  });

  return resp?.choices?.[0]?.message?.content?.trim() || '';
}

async function generateChatTitle(messages) {
  if (!messages.length) return '';

  const conversation = messages
    .map(m => `${m.role === 'user' ? 'User' : 'Luna'}: ${m.content}`)
    .join('\n');

  const resp = await openai.chat.completions.create({
    model: process.env.CHAT_MODEL || 'gpt-4o',
    messages: [
      {
        role: 'system',
        content:
          'Generate a strictly short title (exactly 2 words) that captures the gist of this conversation context (e.g. "Work Anxiety", "Daily Stress"). Do not use quotes.',
      },
      {
        role: 'user',
        content: conversation.slice(0, 4000),
      },
    ],
    temperature: 0.3,
    max_completion_tokens: 20,
  });

  return resp?.choices?.[0]?.message?.content?.trim() || 'New Chat';
}


async function embedText(text) {
  const chunks = chunkText(text);
  const embeddings = [];
  for (const chunk of chunks) {
    const resp = await openai.embeddings.create({
      model: KB_EMBED_MODEL,
      input: chunk
    });
    embeddings.push(resp?.data?.[0]?.embedding);
  }
  return avgEmbeddings(embeddings);
}

function avgEmbeddings(embs) {
  if (!embs.length) return [];
  const dim = embs[0].length;
  const avg = new Array(dim).fill(0);
  for (const v of embs) {
    for (let i = 0; i < dim; i++) {
      avg[i] += v[i];
    }
  }
  for (let i = 0; i < dim; i++) {
    avg[i] /= embs.length;
  }
  return avg;
}

function chunkText(text, limit = KB_EMBED_SLICE_LIMIT, overlap = KB_EMBED_CHUNK_OVERLAP) {
  if (text.length <= limit) return [text];
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(text.length, start + limit);
    chunks.push(text.slice(start, end));
    if (end === text.length) break;
    start = end - overlap;
  }
  return chunks;
}

async function buildIndex() {
  KB_TEXTS = [];
  try {
    await fs.access(KB_DIR);
  } catch {
    // KB directory doesn't exist - this is fine, just return with empty KB_TEXTS
    console.warn('KB directory not found, continuing without knowledge base');
    return;
  }
  const files = (await fs.readdir(KB_DIR)).filter(
    f => /\.(txt|md)$/i.test(f) && f.toLowerCase() !== 'persona.md'
  );
  for (const f of files) {
    const full = await fs.readFile(path.join(KB_DIR, f), 'utf8');
    const trimmed = full.trim();
    if (!trimmed) continue;
    KB_TEXTS.push({
      file: f,
      text: trimmed,
      embedding: await embedText(trimmed)
    });
  }
}

function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

async function retrieveTopKB(query) {
  if (!KB_TEXTS.length) return [];
  const qemb = await embedText(query);
  if (!qemb.length) return [];
  const scored = KB_TEXTS
    .map(k => ({
      file: k.file,
      text: k.text,
      score: cosine(qemb, k.embedding)
    }))
    .sort((a, b) => b.score - a.score);
  return scored[0]?.score >= 0.55 ? [scored[0]] : [];
}


function detectSelfHarm(text) {
  return /\b(kill myself|suicid|end my life|hurt myself|want to die|take my own life)\b/i.test(text);
}

function detectDistress(text) {
  return /\b(feel down|sad|anxious|anxiety|stress|stressed|panic|panicking|worried|worry|low|struggling|not okay|not ok|overwhelmed?)\b/i.test(text);
}

function detectMedicalDiagnosis(text) {
  return /\b(diagnos|symptom|symptoms|what is wrong with me|do i have|is this anxiety|is this depression|medical advice|medication|treatment for|treat this)\b/i.test(text);
}

function detectPricing(text) {
  return /\b(price|cost|how much|fees?|pricing|charges?)\b/i.test(text);
}


async function textToSpeech(text) {
  const response = await openai.audio.speech.create({
    model: "gpt-4o-mini-tts", // high-quality, calm voice
    voice: "shimmer",           // soft, young lady's voice
    input: text,
    format: "mp3"
  });

  // Convert stream → buffer
  const buffer = Buffer.from(await response.arrayBuffer());

  // Send as base64 to frontend
  return buffer.toString("base64");
}

const PERSONA_PATH = path.join(__dirname, 'kb', 'persona.md');
let FLORA_PROMPT = '';

function loadFloraPrompt() {
  try {
    FLORA_PROMPT = fsSync.readFileSync(PERSONA_PATH, 'utf8').trim();
    console.log('✅ Luna persona prompt loaded');
  } catch (err) {
    console.error('Failed to load persona.md:', err);
    FLORA_PROMPT =
      'You are Luna, the supportive wellness chatbot for Flowergrid UK. Listen first, validate feelings, then offer practical help in British English.';
  }
}

function getPacingInstruction(botReplyCount) {
  const nextReply = botReplyCount + 1;
  if (botReplyCount < 3) {
    return `\n\n## ACTIVE PACING RULE (strict — Luna reply #${nextReply})\nDo NOT mention Flowergrid practitioners, practitioner names, booking, or specific services. Listen, reflect, validate, and offer one gentle technique or question. No promotion.`;
  }
  if (botReplyCount < 5) {
    return `\n\n## ACTIVE PACING RULE (Luna reply #${nextReply})\nOffer practical techniques. Do NOT name specific practitioners unless the user explicitly asks for professional help. Mention Flowergrid only softly if highly relevant.`;
  }
  if (botReplyCount < 8) {
    return `\n\n## ACTIVE PACING RULE (Luna reply #${nextReply})\nYou may deepen support and gently mention Flowergrid if genuinely relevant. Stay natural, never pushy.`;
  }
  return `\n\n## ACTIVE PACING RULE (Luna reply #${nextReply})\nYou may naturally mention how Flowergrid could support them if appropriate. Keep it soft and optional.`;
}

function detectNutritionWeight(text) {
  return /\b(weight|bmi|calorie|calories|diet|nutrition|lose weight|gain weight|eating|meal plan|macros?)\b/i.test(text);
}

function detectPhysicalTherapy(text) {
  return /\b(cupping|hijama|reiki|cranial|scraping|fascia|muscle tension|energy heal|acupuncture)\b/i.test(text);
}

function detectNHS(text) {
  return /\b(nhs|waiting list|gp referral|hospital|healthcare system)\b/i.test(text);
}

function detectMealPlanOrCalories(text) {
  return /\b(meal plan|calorie target|how many calories|specific diet plan|give me a diet)\b/i.test(text);
}

function getTopicInstruction(userMessage, botReplyCount) {
  if (detectMealPlanOrCalories(userMessage)) {
    return '\n\n## ACTIVE SAFETY RULE\nThe user asked for a meal plan, calorie target, or similar. Use your SAFETY BOUNDARY: do not give specific calorie targets or medical diagnoses. Signpost to a Flowergrid expert for personalised advice.';
  }
  const parts = [];
  if (detectNutritionWeight(userMessage) && botReplyCount < 4) {
    parts.push('User topic: nutrition/weight. CRITICAL PACING: do NOT mention practitioners or services yet. Listen, explore stress/sleep/cortisol, offer compassionate science-based education only.');
  }
  if (detectPhysicalTherapy(userMessage) && botReplyCount < 4) {
    parts.push('User topic: physical/holistic therapies. CRITICAL PACING: do NOT mention practitioners yet. Ask where they hold tension; listen and validate first.');
  }
  if (detectNHS(userMessage) && botReplyCount < 4) {
    parts.push('User topic: NHS/healthcare. CRITICAL PACING: do NOT mention practitioners yet. Validate how exhausting it is; explore their situation first.');
  }
  if (parts.length && botReplyCount >= 4) {
    parts.push('You may now signpost to a relevant Flowergrid practitioner if appropriate, using your practitioner matching tables.');
  }
  return parts.length ? '\n\n' + parts.join('\n') : '';
}

loadFloraPrompt();

async function chatWithFlora(history, userMessage, options = {}) {
  const { distressFlag = false, botReplyCount = 0 } = options;

  if (!FLORA_PROMPT) loadFloraPrompt();

  const extraDistressInstruction = distressFlag
    ? '\nThe user seems distressed or overwhelmed. Be especially gentle, calming and grounding in your reply.'
    : '';

  const pacingInstruction = getPacingInstruction(botReplyCount);
  const topicInstruction = getTopicInstruction(userMessage, botReplyCount);

  let kbContext = '';
  const kbMatches = await retrieveTopKB(userMessage);
  if (kbMatches.length) {
    const top = kbMatches[0];
    kbContext =
      `\n\nAdditional Flowergrid reference (from ${top.file}):\n` +
      top.text.slice(0, 2000);
  }

  const systemContent =
    FLORA_PROMPT +
    extraDistressInstruction +
    pacingInstruction +
    topicInstruction +
    kbContext;

  const fullMessages = [
    { role: 'system', content: systemContent },
    ...history,
    { role: 'user', content: userMessage }
  ];

  const resp = await openai.chat.completions.create({
    model: process.env.CHAT_MODEL || 'gpt-4o',
    messages: fullMessages,
    temperature: 0.35,
    max_completion_tokens: 400
  });

  return resp?.choices?.[0]?.message?.content?.trim() || 'I am here with you. Tell me more about what is on your mind.';
}


api.post('/chat', async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message required' });
    }

    if (!process.env.OPENAI_API_KEY?.trim()) {
      return res.status(503).json({
        error: 'Chat is not configured',
        hint: 'Set OPENAI_API_KEY in Coolify environment variables.',
      });
    }

    await ensureKbIndex();

    const text = message.trim();

    const user = await getRequestUser(req);
    if (user) {
      clearGuestExhaustedCookie(res);
    }

    let sessionId = resolveSessionId(req);
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      await ensureSession(sessionId, user?.id ?? null);
      setChatSessionCookie(res, sessionId);
    } else {
      setChatSessionCookie(res, sessionId);
      await ensureSession(sessionId, user?.id ?? null);
    }

    const guestBlocked = await checkGuestReplyLimit(sessionId, req, text, res);
    if (guestBlocked) {
      return res.json(guestBlocked);
    }

    const botReplyCount = await countBotMessages(sessionId);

    if (detectSelfHarm(text)) {
      const crisis =
        'Thank you for sharing that with me. What you are going through sounds really difficult, and I want you to know that support is available right now.\n\n' +
        'If you are in the UK, please consider contacting one of these services:\n' +
        '- Samaritans: 116 123 (free, 24 hours)\n' +
        '- Crisis Text Line: Text SHOUT to 85258\n' +
        '- Mind Infoline: 0300 123 3393\n\n' +
        'You do not have to face this alone. Speaking to a trained person can make a real difference.';
      await recordChatExchange(sessionId, text, crisis, user?.id ?? null);
      return res.json({
        answer: crisis,
        ...(await guestResponseFlags(sessionId, req, res)),
      });
    }

    // Signed-in users: after 6 Luna replies, the 7th reply is a personalised practitioner suggestion
    if (
      user &&
      botReplyCount === LOGGED_IN_PRACTITIONER_REPLY_AT &&
      !(await isPractitionerSuggested(sessionId))
    ) {
      const history = (await getSessionMessages(sessionId)).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const reply = await generatePractitionerRecommendation(history, text);
      await recordChatExchange(sessionId, text, reply, user.id);
      await setPractitionerSuggested(sessionId, user.id);

      let audio = null;
      try {
        audio = await textToSpeech(reply);
      } catch (ttsErr) {
        console.error('TTS failed:', ttsErr);
      }

      return res.json({
        answer: reply,
        audio,
        practitionerRecommendation: true,
        ...(await guestResponseFlags(sessionId, req, res)),
      });
    }

    if (detectMedicalDiagnosis(text)) {
      const medicalReply =
        'I am not able to provide medical advice or a diagnosis. For anything related to your physical or mental health, it is always best to speak with a qualified healthcare professional who can assess your situation properly.\n\n' +
        'Flowergrid does have doctors and medical practitioners on the team who can support you if that would help. You can reach the team at sk@flowergrid.co.uk or call +44 7432 211096.';
      await recordChatExchange(sessionId, text, medicalReply, user?.id ?? null);
      return res.json({
        answer: medicalReply,
        ...(await guestResponseFlags(sessionId, req, res)),
      });
    }

    if (detectPricing(text)) {
      const pricingReply =
        'I do not have specific pricing details to hand. The Flowergrid team would be happy to talk you through options, availability and fees.\n\n' +
        'You can contact them by email at sk@flowergrid.co.uk or by phone on +44 7432 211096.';
      await recordChatExchange(sessionId, text, pricingReply, user?.id ?? null);
      return res.json({
        answer: pricingReply,
        ...(await guestResponseFlags(sessionId, req, res)),
      });
    }

    if (detectMealPlanOrCalories(text)) {
      const dietReply =
        "Because everyone's body is entirely unique, I cannot give you a specific calorie target or medical diagnosis. To do that safely, it is always best to speak with one of our experts who can look at your full health profile.\n\n" +
        'Flowergrid has nutrition specialists such as Rebecca and Dr. Renu who can support you with a personalised plan. You can reach the team at sk@flowergrid.co.uk or call +44 7432 211096.';
      await recordChatExchange(sessionId, text, dietReply, user?.id ?? null);
      return res.json({
        answer: dietReply,
        ...(await guestResponseFlags(sessionId, req, res)),
      });
    }

    const history = (await getSessionMessages(sessionId)).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const distressFlag = detectDistress(text);
    const reply = await chatWithFlora(history, text, { distressFlag, botReplyCount });

    await recordChatExchange(sessionId, text, reply, user?.id ?? null);

    // 🎙 Convert bot reply to voice
    let audio = null;
    try {
      audio = await textToSpeech(reply);
    } catch (ttsErr) {
      console.error("TTS failed:", ttsErr);
    }

    res.json({
      answer: reply,
      audio,
      ...(await guestResponseFlags(sessionId, req, res)),
    });

  } catch (err) {
    console.error('Chat error:', err);
    const isDb =
      (typeof err?.code === 'string' && err.code.startsWith('P')) ||
      /prisma|postgresql|database_url/i.test(String(err?.message || ''));
    res.status(isDb ? 503 : 500).json({
      error: isDb ? 'Database error' : 'Server error',
      hint: isDb
        ? 'Check DATABASE_URL in Coolify.'
        : undefined,
      message:
        process.env.NODE_ENV === 'production' ? undefined : err?.message,
    });
  }
});
api.get("/admin/users", async (req, res) => {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({ error: "Access denied" });
    }

    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, avatar: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch users" });
  }
});


api.get("/admin/summaries", async (req, res) => {
  try {
    const summaries = await prisma.chatSummary.findMany({
      orderBy: { createdAt: 'desc' },
    });

    res.json(summaries);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch summaries" });
  }
});

api.get("/conversations", authenticateUser, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    // Return lightweight list
    const convos = await prisma.chatSummary.findMany({
      where: { userId: req.user.id },
      select: { id: true, summary: true, title: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });

    const formatted = convos.map((c) => ({
      id: c.id,
      title: c.title || c.summary || "New Conversation",
      createdAt: c.createdAt,
    }));

    res.json(formatted);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch conversations" });
  }
});

api.get("/conversations/:id", authenticateUser, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const conversation = await prisma.chatSummary.findFirst({
      where: {
        id: req.params.id,
        userId: req.user.id,
      },
    });

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    if (conversation.sessionId && Array.isArray(conversation.messages)) {
      await resumeSession(
        conversation.sessionId,
        conversation.messages,
        req.user.id
      );
      setChatSessionCookie(res, conversation.sessionId);
    }

    res.json(conversation);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch conversation" });
  }
});

api.delete("/conversations/:id", authenticateUser, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { id } = req.params;
    const result = await prisma.chatSummary.deleteMany({
      where: { id, userId: req.user.id },
    });

    if (result.count === 0) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete conversation" });
  }
});



api.post("/chat/summary", authenticateUser, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { sessionId, messages: bodyMessages } = req.body;
    if (!sessionId) {
      return res.status(400).json({ error: "Session ID required" });
    }

    let messages = [];
    if (bodyMessages && Array.isArray(bodyMessages) && bodyMessages.length > 0) {
      messages = bodyMessages.map((m) => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content,
      }));
    } else {
      messages = await getFullSessionMessages(sessionId);
    }

    if (!messages.length) {
      return res.json({ success: true });
    }

    const summary = await generateChatSummary(messages);
    const title = await generateChatTitle(messages);

    const fullConversation = messages.map(m => ({
      role: m.role,
      content: m.content,
    }));

    // Use findOneAndUpdate with upsert to create or update existing summary for this session
    // This prevents duplicates if user continues same session
    await prisma.chatSummary.upsert({
      where: {
        userId_sessionId: {
          userId: req.user.id,
          sessionId,
        },
      },
      create: {
        userId: req.user.id,
        sessionId,
        name: req.user.name,
        email: req.user.email,
        avatar: req.user.avatar,
        summary,
        title,
        messages: fullConversation,
      },
      update: {
        name: req.user.name,
        email: req.user.email,
        avatar: req.user.avatar,
        summary,
        title,
        messages: fullConversation,
      },
    });

    await resumeSession(sessionId, fullConversation, req.user.id);

    res.json({ success: true });
  } catch (err) {
    // Duplicate protection fallback
    if (err.code === 'P2002') {
      return res.json({ success: true, skipped: true });
    }

    console.error("Summary save error:", err);
    res.status(500).json({ error: "Failed to save summary" });
  }
});



api.get('/chat/session/status', async (req, res) => {
  try {
    const user = await getRequestUser(req);
    let sessionId = getChatSessionCookie(req);

    if (!sessionId) {
      sessionId = crypto.randomUUID();
      await ensureSession(sessionId, user?.id ?? null);
    } else {
      await ensureSession(sessionId, user?.id ?? null);
    }

    setChatSessionCookie(res, sessionId);
    const guestLimitReached = await isGuestLimitReached(sessionId, req);

    res.json({ sessionId, guestLimitReached });
  } catch (err) {
    console.error('Session status error:', err);
    res.status(503).json({
      error: 'Failed to load session status',
      hint: 'Check DATABASE_URL in Coolify.',
      message:
        process.env.NODE_ENV === 'production' ? undefined : err?.message,
    });
  }
});

api.post('/chat/session/new', async (req, res) => {
  try {
    const user = await getRequestUser(req);
    const previousId = resolveSessionId(req);
    if (previousId) {
      await clearSession(previousId);
    }

    const sessionId = crypto.randomUUID();
    await ensureSession(sessionId, user?.id ?? null);
    setChatSessionCookie(res, sessionId);

    const guestLimitReached = await isGuestLimitReached(sessionId, req);
    res.json({ sessionId, guestLimitReached });
  } catch (err) {
    console.error('Session new error:', err);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

api.post('/chat/session/activate', async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId || typeof sessionId !== 'string') {
      return res.status(400).json({ error: 'sessionId required' });
    }

    const user = await getRequestUser(req);
    await ensureSession(sessionId, user?.id ?? null);
    setChatSessionCookie(res, sessionId);

    const guestLimitReached = await isGuestLimitReached(sessionId, req);
    res.json({ sessionId, guestLimitReached });
  } catch (err) {
    console.error('Session activate error:', err);
    res.status(500).json({ error: 'Failed to activate session' });
  }
});

api.post('/chat/session/resume', async (req, res) => {
  try {
    const { sessionId, messages } = req.body;
    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId required' });
    }

    const user = await getRequestUser(req);
    if (user) {
      if (messages?.length) {
        await resumeSession(sessionId, messages, user.id);
      } else {
        await syncSessionFromSummary(sessionId, user.id);
      }
    } else if (messages?.length) {
      await resumeSession(sessionId, messages, null);
    } else {
      await ensureSession(sessionId, null);
    }

    setChatSessionCookie(res, sessionId);
    const guestLimitReached = await isGuestLimitReached(sessionId, req);
    res.json({ success: true, sessionId, guestLimitReached });
  } catch (err) {
    console.error('Session resume error:', err);
    res.status(500).json({ error: 'Failed to resume session' });
  }
});

api.post('/chat/session/reset', async (req, res) => {
  try {
    const sessionId = resolveSessionId(req);
    if (sessionId) {
      await clearSession(sessionId);
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Session reset error:', err);
    res.status(500).json({ error: 'Failed to reset session' });
  }
});

app.use('/api', api);

app.use((err, req, res, _next) => {
  console.error('Unhandled error:', err);
  if (res.headersSent) return;
  res.status(500).json({ error: 'Internal server error' });
});

// Always listen when running as a standalone server (Docker / local dev).
// Skip only on Vercel serverless where the platform imports `app` without listening.
if (process.env.VERCEL !== '1') {
  configureGoogleOAuth();
  initializeApp().catch((err) =>
    console.error('Background init failed:', err)
  );
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌼 Luna API listening on 0.0.0.0:${PORT} (routes under /api)`);
  });
}

export default app;
