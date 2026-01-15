import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import OpenAI from 'openai';
import session from 'express-session';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import connectDB from './db.js';
import User from './models/User.js';
import ChatSummary from './models/ChatSummary.js';




const app = express();

const PORT = process.env.PORT || 4000;
const KB_DIR = path.resolve('./kb');
const KB_EMBED_MODEL = process.env.EMBED_MODEL || 'text-embedding-3-small';
const SESSION_MAX_MESSAGES = 8;
const KB_EMBED_SLICE_LIMIT = parseInt(process.env.EMBED_SLICE_LIMIT || '24000', 10);
const KB_EMBED_CHUNK_OVERLAP = 200;
const SUMMARY_CONTEXT = new Map();

const allowedOrigins = [
  'https://luna.flowergrid.co.uk',
  'https://api.luna.flowergrid.co.uk',
  'https://flowergrid.vercel.app'
];

app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:4000',
    'https://luna.flowergrid.co.uk',
    'https://api.luna.flowergrid.co.uk',
    'https://flowergrid.vercel.app'
  ],
  credentials: true
}));

app.get('/health', (req, res) => res.json({ status: "alive" }));

app.use(express.json());

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'flora-secret',
    resave: false,
    saveUninitialized: false,
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

let KB_TEXTS = [];
let isInitialized = false;

async function initializeApp() {
  if (isInitialized) return;
  await connectDB();
  await buildIndex();
  isInitialized = true;
}

// Middleware to ensure DB and KB are ready
app.use(async (req, res, next) => {
  try {
    await initializeApp();
    next();
  } catch (err) {
    console.error("Initialization failed:", err);
    res.status(500).send("Internal Server Error");
  }
});

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const existingUser = await User.findOne({
          googleId: profile.id,
        });

        if (existingUser) {
          existingUser.lastLogin = new Date();
          await existingUser.save();
          return done(null, existingUser);
        }

        const newUser = await User.create({
          googleId: profile.id,
          name: profile.displayName,
          email: profile.emails?.[0]?.value,
          avatar: profile.photos?.[0]?.value,
        });

        return done(null, newUser);
      } catch (err) {
        return done(err, null);
      }
    }
  )
);


passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  done(null, user);
});


app.get(
  '/auth/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
  })
);
app.get(
  '/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/' }),
  (req, res) => {
    const user = req.user;
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';


    const userPayload = {
      id: user._id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
    };

    res.redirect(
      `${frontendUrl}?user=${encodeURIComponent(
        JSON.stringify(userPayload)
      )}`
    );
  }
);


function isUserLoggedIn(req) {
  return !!req.user;
}
function isAdmin(req) {
  return req.user?.email === "admin@flowergrid.co.uk";
}

function countBotMessages(sessionId) {
  const messages = getSessionMessages(sessionId);
  return messages.filter(m => m.role === 'assistant').length;
}
async function generateChatSummary(messages) {
  if (!messages.length) return '';

  const conversation = messages
    .map(m => `${m.role === 'user' ? 'User' : 'Luna'}: ${m.content}`)
    .join('\n');

  const resp = await openai.chat.completions.create({
    model: process.env.CHAT_MODEL || 'gpt-4.1',
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
    await fs.mkdir(KB_DIR, { recursive: true });
    return;
  }
  const files = (await fs.readdir(KB_DIR)).filter(f => /\.(txt|md)$/i.test(f));
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


const SESSION_CONTEXT = new Map();
function addToSession(sessionId, role, content) {
  if (!sessionId) return;

  // Short context for chat
  const shortArr = SESSION_CONTEXT.get(sessionId) || [];
  shortArr.push({ role, content });
  SESSION_CONTEXT.set(sessionId, shortArr.slice(-SESSION_MAX_MESSAGES));

  // Full context for summary
  const fullArr = SUMMARY_CONTEXT.get(sessionId) || [];
  fullArr.push({ role, content });
  SUMMARY_CONTEXT.set(sessionId, fullArr);
}


function getSessionMessages(sessionId) {
  if (!sessionId) return [];
  return SESSION_CONTEXT.get(sessionId) || [];
}

async function textToSpeech(text) {
  const response = await openai.audio.speech.create({
    model: "gpt-4o-mini-tts", // high-quality, calm voice
    voice: "alloy",           // neutral, soothing
    input: text,
    format: "mp3"
  });

  // Convert stream → buffer
  const buffer = Buffer.from(await response.arrayBuffer());

  // Send as base64 to frontend
  return buffer.toString("base64");
}

const FLORA_PROMPT = `
You are Luna, the friendly and supportive chatbot for FlowerGrid, a holistic wellness centre in the UK.
• Never write long paragraphs. Maximum 2–3 sentences per reply, always concise.

IDENTITY AND ROLE
- You are a warm, thoughtful companion who offers emotional support and practical guidance.
- You are not a doctor, therapist or medical professional.
- Your job is to listen first, reflect what you have heard, validate the person's feelings and then offer something genuinely useful.
PERSONALITY
- Warm, calm, grounded, non-judgemental
- Speak in British English
- Clear, human, never robotic
PERSONALITY AND TONE
- Warm, calm, grounded, curious, attentive and non judgemental.
- Professional but approachable, like a kind, steady human.
- Always use British English.
- Use simple, clear language and short paragraphs.
- Do not sound robotic, clinical or overly formal.
- Do not use clichés such as "unlock your potential" or "journey to wellness".
- Never say "I understand how you feel" because you cannot fully know their experience.
- Do not overuse exclamation marks and avoid emojis.
- Do not use em dashes.

RULES
- Never diagnose or prescribe
- Never say "I understand how you feel"
- Avoid clichés and em dashes
- Keep replies to 3–5 sentences
- Short paragraphs
- No emojis
- Not salesy

CORE PRINCIPLE
Listen first, then help.
Reflect feelings, validate them, then offer one practical suggestion.

CONVERSATION FLOW
- Early messages: greet warmly and gently ask what brought them here today; let them share. You may offer one small insight or grounding idea.
- Next messages: reflect their words, validate their experience and offer a specific technique, question or reframe.
- Later: deepen support, offer different angles if they feel stuck and check in on how they are feeling now.
- Only bring up FlowerGrid services naturally when it fits, usually after several messages, or if they ask about getting further help, therapy, coaching or FlowerGrid itself.
- If you mention services, keep it soft and never pushy or sales driven.

TECHNIQUES YOU CAN OFFER
Use or adapt these where relevant to the user:
- For stress and overwhelm: grounding with the 5-4-3-2-1 senses, a brain dump on paper, a prioritising question such as "What is one thing today that would make everything else a bit easier?", and box breathing (in 4, hold 4, out 4, hold 4).
- For anxiety and racing thoughts: naming the feeling ("I notice I am feeling anxious"), the 5-4-3-2-1 method, a daily worry window, and slow breathing with longer exhales (in 4, out 6 or 8).
- For feeling stuck or lost: clarity questions about what they would like life to look like in a year, exploring values, choosing the tiniest next step, or giving themselves permission to pause instead of pushing.
- For low mood: focusing on one small win, self compassion (what they would say to a close friend), a few minutes of gentle movement, and small moments of connection such as a short message to someone they trust.
- For relationship struggles: perspective taking about what the other person might be feeling, using "I" statements instead of blame, reflecting on boundaries that protect their energy, and asking what they actually need from the relationship.
- For work or career stress: an energy audit (what drains and what restores), small boundaries around work (for example, not checking emails after a certain time), focusing on what is in their control, and reconnecting with what originally drew them to the work.
- For sleep difficulties: a simple wind down routine, writing thoughts down before bed to offload the mind, and a slow body scan to release tension.
- For confidence and self doubt: gathering evidence from past times they handled something difficult, noticing the inner critic and asking whether it is helpful, and choosing a small action that gently stretches their comfort zone.

FLOWERGRID CONTEXT
- FlowerGrid is a holistic wellness centre founded by Samina Khan in the UK.
- FlowerGrid integrates medical science with holistic practices to support the whole person: mind, body and spirit.
- There is a team of doctors, therapists, coaches and certified practitioners.
- Sessions are available both online and in person in the UK.
- Main service areas:
  1) Life Coaching and Transformation: personal and professional growth, relationship coaching, conscious living, leadership and soft skills.
  2) Therapeutic and Mental Wellness: anxiety and stress management, NLP, psychological therapy, hypnotherapy.
  3) Medical and Aesthetic Wellness: medical checks, doctor consultations, aesthetics, nutrition advice and integrative health and fitness plans.
  4) Holistic and Energy Healing: meditation, mindfulness, breathing, Reiki, colour therapy, auricular acupuncture and soul reflection work.
- When relevant, you may gently suggest which of these areas might suit their needs and mention that they can contact FlowerGrid for deeper support, but never push and never overdo it.

BOUNDARIES.  
- Do not diagnose or prescribe and do not give specific medical advice.
- If they ask for a diagnosis or medical opinion, kindly say you cannot provide medical advice and recommend they speak to a qualified healthcare professional. You may mention that FlowerGrid has doctors and medical practitioners who can support them.
- If they ask for pricing details, explain that you do not have pricing to hand and that the FlowerGrid team can help at sk@flowergrid.co.uk or +44 7432 211096.

STYLE
- Aim for about 3 to 5 sentences per reply.
- Use short paragraphs so your replies are easy to read.
- Always leave the user feeling both heard and helped, not just listened to.
- Where it fits, end with a gentle question or invitation to share more.
`;

const LOGIN_REQUIRED_MESSAGE = `
If you would like to continue this conversation, please log in with your email.

Thank you for sharing that with me. What you are going through sounds really difficult, and I want you to know that support is available right now.

Please reach out to one of these services:

• Samaritans: 116 123 (free, 24 hours)
• Crisis Text Line: Text SHOUT to 85258
• Mind Infoline: 0300 123 3393

You do not have to face this alone. Speaking to a trained person can make a real difference.
`;

async function chatWithFlora(history, userMessage, options = {}) {
  const { distressFlag = false } = options;

  const extraDistressInstruction = distressFlag
    ? '\nThe user seems distressed or overwhelmed. Be especially gentle, calming and grounding in your reply.'
    : '';

  let kbContext = '';
  const kbMatches = await retrieveTopKB(userMessage);
  if (kbMatches.length) {
    const top = kbMatches[0];
    kbContext =
      `\n\nAdditional FlowerGrid reference information (from ${top.file}):\n` +
      top.text.slice(0, 2000);
  }

  const systemContent = FLORA_PROMPT + extraDistressInstruction + kbContext;

  const fullMessages = [
    { role: 'system', content: systemContent },
    ...history,
    { role: 'user', content: userMessage }
  ];

  const resp = await openai.chat.completions.create({
    model: process.env.CHAT_MODEL || 'gpt-4.1',
    messages: fullMessages,
    temperature: 0.3,
    max_completion_tokens: 220
  });

  return resp?.choices?.[0]?.message?.content?.trim() || 'I am here with you. Tell me more about what is on your mind.';
}


app.post('/chat', async (req, res) => {
  try {
    const { message, sessionId } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message required' });
    }

    if (!KB_TEXTS.length) {
      await buildIndex();
    }

    const text = message.trim();

    if (detectSelfHarm(text)) {
      const crisis =
        'Thank you for sharing that with me. What you are going through sounds really difficult, and I want you to know that support is available right now.\n\n' +
        'If you are in the UK, please consider contacting one of these services:\n' +
        '- Samaritans: 116 123 (free, 24 hours)\n' +
        '- Crisis Text Line: Text SHOUT to 85258\n' +
        '- Mind Infoline: 0300 123 3393\n\n' +
        'You do not have to face this alone. Speaking to a trained person can make a real difference.';
      return res.json({ answer: crisis });
    }

    if (detectMedicalDiagnosis(text)) {
      const medicalReply =
        'I am not able to provide medical advice or a diagnosis. For anything related to your physical or mental health, it is always best to speak with a qualified healthcare professional who can assess your situation properly.\n\n' +
        'FlowerGrid does have doctors and medical practitioners on the team who can support you if that would help. You can reach the team at sk@flowergrid.co.uk or call +44 7432 211096.';
      return res.json({ answer: medicalReply });
    }

    if (detectPricing(text)) {
      const pricingReply =
        'I do not have specific pricing details to hand. The FlowerGrid team would be happy to talk you through options, availability and fees.\n\n' +
        'You can contact them by email at sk@flowergrid.co.uk or by phone on +44 7432 211096.';
      return res.json({ answer: pricingReply });
    }

    const history = getSessionMessages(sessionId).map(m => ({
      role: m.role,
      content: m.content
    }));

    const botReplyCount = countBotMessages(sessionId);
    const loggedIn = isUserLoggedIn(req);

    // 🔒 Limit free messages
    if (!loggedIn && botReplyCount >= 8) {
      addToSession(sessionId, 'assistant', LOGIN_REQUIRED_MESSAGE);
      return res.json({
        answer: LOGIN_REQUIRED_MESSAGE,
        disableInput: true
      });
    }

    const distressFlag = detectDistress(text);
    const reply = await chatWithFlora(history, text, { distressFlag });

    addToSession(sessionId, 'user', text);
    addToSession(sessionId, 'assistant', reply);

    // 🎙 Convert bot reply to voice
    let audio = null;
    try {
      audio = await textToSpeech(reply);
    } catch (ttsErr) {
      console.error("TTS failed:", ttsErr);
    }

    res.json({
      answer: reply,   // text reply
      audio            // base64 mp3 (or null if failed)
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});
app.get("/admin/users", async (req, res) => {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({ error: "Access denied" });
    }

    const users = await User.find().select("name email avatar createdAt");
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch users" });
  }
});


app.get("/admin/summaries", async (req, res) => {
  try {
    const summaries = await ChatSummary.find()
      .sort({ createdAt: -1 });

    res.json(summaries);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch summaries" });
  }
});

app.get("/conversations", async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    // Return lightweight list
    const convos = await ChatSummary.find({ userId: req.user._id })
      .select("summary title createdAt")
      .sort({ createdAt: -1 });

    // Map to a friendlier format if needed, or send as is
    const formatted = convos.map(c => ({
      _id: c._id,
      title: c.title || c.summary || "New Conversation",
      createdAt: c.createdAt
    }));

    res.json(formatted);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch conversations" });
  }
});

app.get("/conversations/:id", async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const conversation = await ChatSummary.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    res.json(conversation);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch conversation" });
  }
});

app.delete("/conversations/:id", async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { id } = req.params;
    const result = await ChatSummary.deleteOne({
      _id: id,
      userId: req.user._id
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete conversation" });
  }
});



app.post("/chat/summary", async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { sessionId, messages: bodyMessages } = req.body;
    if (!sessionId) {
      return res.status(400).json({ error: "Session ID required" });
    }

    // Use client payload if available (it has full history), otherwise fallback to server context
    let messages = [];
    if (bodyMessages && Array.isArray(bodyMessages) && bodyMessages.length > 0) {
      messages = bodyMessages;
    } else {
      messages = SUMMARY_CONTEXT.get(sessionId) || [];
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
    await ChatSummary.findOneAndUpdate(
      { sessionId, userId: req.user._id },
      {
        $set: {
          name: req.user.name,
          email: req.user.email,
          avatar: req.user.avatar,
          summary, // Full summary
          title,   // Short 2-word title
          messages: fullConversation,
          updatedAt: new Date()
        }
      },
      { upsert: true, new: true }
    );

    // 🧹 Clear memory after save
    SUMMARY_CONTEXT.delete(sessionId);

    res.json({ success: true });
  } catch (err) {
    // Duplicate protection fallback
    if (err.code === 11000) {
      return res.json({ success: true, skipped: true });
    }

    console.error("Summary save error:", err);
    res.status(500).json({ error: "Failed to save summary" });
  }
});



if (process.env.NODE_ENV !== 'production' || process.env.VERCEL !== '1') {
  app.listen(PORT, () => {
    console.log(`🌼 Luna is live at http://localhost:${PORT}`);
  });
}

export default app;