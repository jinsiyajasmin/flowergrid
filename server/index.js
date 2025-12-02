import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import OpenAI from 'openai';

const app = express();

// ----------------- Configuration (use existing env vars only) -----------------
const PORT = process.env.PORT || 3001;
const KB_DIR = path.resolve('./kb'); // DO NOT change to a new env var
const KB_EMBED_MODEL = process.env.EMBED_MODEL || 'text-embedding-3-small';
const KB_EMBED_SLICE_LIMIT = parseInt(process.env.EMBED_SLICE_LIMIT || '24000', 10); // same env var name as before
const KB_EMBED_CHUNK_OVERLAP = 200; // kept as a constant (not an env var)
const RETRIEVE_TOP_K = 3; // constant, not env var
const RETRIEVE_MIN_SCORE = 0.55; // constant, not env var
const SESSION_MAX_MESSAGES = 8; // constant, not env var
// ------------------------------------------------------------------------------

app.use(cors({
  origin: ['http://localhost:3001', 'http://localhost:5174'],
  credentials: true
}));
app.use(express.json());

// Basic security header
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});

const openai = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL || process.env.DEEPSEEK_BASE_URL || undefined,
});

if (!openai.apiKey && !process.env.DEEPSEEK_BASE_URL) {
  console.warn('⚠️ OpenAI/API key or base URL not set. The server will still run but embedding/chat calls will fail until keys are provided.');
}

// ---------- In-memory KB index ----------
let KB_TEXTS = []; // { file, text, wordsSet, embedding }
// -------------------------------------------------

// Utility: naive chunker for long texts (keeps overlap)
function chunkText(text, limit = KB_EMBED_SLICE_LIMIT, overlap = KB_EMBED_CHUNK_OVERLAP) {
  if (!text || text.length <= limit) return [text];
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(text.length, start + limit);
    chunks.push(text.slice(start, end));
    if (end === text.length) break;
    start = Math.max(0, end - overlap);
  }
  return chunks;
}

// Embedding: embed multiple chunks and average the vectors
async function embedText(text) {
  const inputText = typeof text === 'string' ? text : String(text || '');
  const chunks = chunkText(inputText, KB_EMBED_SLICE_LIMIT, KB_EMBED_CHUNK_OVERLAP);

  const embeddings = [];
  for (const chunk of chunks) {
    try {
      const resp = await openai.embeddings.create({
        model: KB_EMBED_MODEL,
        input: chunk
      });
      const emb = resp?.data?.[0]?.embedding || null;
      if (emb) embeddings.push(emb);
    } catch (err) {
      console.warn('Embedding chunk failed:', err?.message || err);
      // continue embedding remaining chunks
    }
  }

  if (embeddings.length === 0) return null;

  // average embeddings element-wise
  const dim = embeddings[0].length;
  const avg = new Array(dim).fill(0);
  for (const emb of embeddings) {
    for (let i = 0; i < dim; i++) avg[i] += emb[i];
  }
  for (let i = 0; i < dim; i++) avg[i] /= embeddings.length;
  return avg;
}

function cosine(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-12);
}

// Build KB index - reads .txt/.md files and stores text + embedding
async function buildIndex() {
  KB_TEXTS = [];
  try {
    await fs.access(KB_DIR);
  } catch {
    await fs.mkdir(KB_DIR, { recursive: true });
    console.log(`📁 KB directory created at ${KB_DIR}. Add your notes as .txt or .md files.`);
    return;
  }

  const files = (await fs.readdir(KB_DIR)).filter(f => /\.(txt|md)$/i.test(f));
  console.log(`📚 Found ${files.length} KB file(s):`, files);
  for (const f of files) {
    try {
      const full = await fs.readFile(path.join(KB_DIR, f), 'utf8');
      const content = full.trim();
      const wordsSet = new Set(
        content
          .toLowerCase()
          .replace(/[^\w\s]/g, ' ')
          .split(/\s+/)
          .filter(Boolean)
      );

      let embedding = null;
      try {
        embedding = await embedText(content);
      } catch (err) {
        console.warn(`⚠️ embedding failed for ${f}:`, err?.message || err);
      }

      KB_TEXTS.push({ file: f, text: content, wordsSet, embedding });
    } catch (err) {
      console.error('Error reading KB file', f, err);
    }
  }

  console.log(`✅ Loaded ${KB_TEXTS.length} KB files:`, KB_TEXTS.map(k => k.file));
}

// A slightly broader intent classifier and fallback for unknowns
function classifyIntent(question) {
  const q = (question || '').toLowerCase();
  if (/\b(weather|temperature|forecast|rain|sunny|cloud|wind)\b/.test(q)) return 'weather';
  if (/\b(news|breaking|headline|latest news)\b/.test(q)) return 'news';
  if (/\b(stock|share price|price of|ticker|nasdaq|nyse)\b/.test(q)) return 'finance';
  if (/\b(time in|what time|local time)\b/.test(q)) return 'time';
  if (/\b(direction|how to get|route|map|where is)\b/.test(q)) return 'directions';
  return 'default';
}

// Improved self-harm detection (wider phrase coverage)
function detectSelfHarm(text) {
  const q = (text || '').toLowerCase();
  const pattern = /\b(kill myself|suicid|end my life|hurt myself|i want to die|i'll die|i will die|i'm going to die|want to die|i can't go on|no reason to live|don't want to live)\b/;
  return pattern.test(q);
}

// retrieve top KB matches using cosine similarity
async function retrieveTopKB(query, topK = RETRIEVE_TOP_K, minScore = RETRIEVE_MIN_SCORE) {
  if (!KB_TEXTS || KB_TEXTS.length === 0) return [];

  let qemb = null;
  try {
    qemb = await embedText(query);
  } catch (err) {
    console.error('Embedding query failed:', err);
    return [];
  }
  if (!qemb) return [];

  const scored = KB_TEXTS
    .map(k => ({ file: k.file, text: k.text, score: k.embedding ? cosine(qemb, k.embedding) : 0 }))
    .sort((a, b) => b.score - a.score);

  const filtered = scored.filter(s => s.score >= minScore);
  const result = filtered.slice(0, topK);
  if (result.length === 0 && scored.length > 0) {
    if (scored[0].score > 0.35) return [scored[0]];
    return [];
  }
  return result;
}

function prettyTextFromModel(raw) {
  if (!raw || typeof raw !== 'string') return '';
  let text = raw.replace(/\r\n/g, '\n').trim();
  const lines = text.split(/\n+/).map(s => s.trim()).filter(Boolean).map(s => {
    if (!/[.!?]$/.test(s)) s = s + '.';
    return s.charAt(0).toUpperCase() + s.slice(1);
  });
  return lines.join('\n\n');
}

// Conversation call helper
async function callConversation(systemMessage, messagesArray, options = {}) {
  const model = options.model || process.env.CHAT_MODEL || 'deepseek-chat';
  const temperature = options.temperature ?? 0.2;
  const max_tokens = options.max_tokens ?? 1200;
  const messages = Array.isArray(messagesArray) ? messagesArray : [{ role: 'user', content: messagesArray }];

  if (systemMessage && typeof systemMessage === 'string') {
    messages.unshift({ role: 'system', content: systemMessage });
  }

  const response = await openai.chat.completions.create({
    model,
    messages,
    temperature,
    max_tokens,
  });

  const text = (response?.choices?.[0]?.message?.content ?? "").toString();
  return text;
}

// Session context storage
const SESSION_CONTEXT = new Map();
function addToSession(sessionId, role, content) {
  if (!sessionId) return;
  const arr = SESSION_CONTEXT.get(sessionId) || [];
  arr.push({ role, content, ts: Date.now() });
  const sliced = arr.slice(-SESSION_MAX_MESSAGES);
  SESSION_CONTEXT.set(sessionId, sliced);
}
function getSessionMessages(sessionId) {
  return SESSION_CONTEXT.get(sessionId) || [];
}

// Initial build
await buildIndex();

// Watch KB directory for changes and rebuild index automatically
try {
  if (fsSync.existsSync(KB_DIR)) {
    fsSync.watch(KB_DIR, { persistent: true }, async (eventType, filename) => {
      if (!filename) return;
      console.log(`📣 KB change detected (${eventType}): ${filename}. Rebuilding index...`);
      try {
        await buildIndex();
      } catch (err) {
        console.error('Error rebuilding KB after file change:', err);
      }
    });
  }
} catch (err) {
  console.warn('KB watch setup failed:', err?.message || err);
}

// heuristic: detect persona-like queries
function isLikelyPersonaQuery(message) {
  const q = (message || '').toLowerCase();
  if (/\bflora\b/.test(q)) return true;
  if (/\b(privacy|crisis|resources|session|confidential|how do you|what can you do|boundaries|limits)\b/.test(q)) return true;
  return false;
}

// ---------- Helper endpoints ----------
app.get('/kb/list', async (req, res) => {
  try {
    const files = KB_TEXTS.map(k => k.file);
    return res.json({ files, count: files.length });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to list KB files', detail: err?.message });
  }
});

app.post('/kb/reload', async (req, res) => {
  try {
    await buildIndex();
    return res.json({ ok: true, loaded: KB_TEXTS.length });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message || String(err) });
  }
});

// ---------- /chat endpoint ----------
app.post('/chat', async (req, res) => {
  try {
    const { message, sessionId } = req.body;
    if (!message) return res.status(400).json({ error: 'Message required' });

    // ensure KB loaded
    if (KB_TEXTS.length === 0) await buildIndex();

    // immediate safety
    if (detectSelfHarm(message)) {
      const escalate = `I'm really sorry you're feeling so distressed. I can't provide crisis services. If you are thinking about harming yourself or are in immediate danger, please contact your local emergency number right now or a crisis line. Would you like me to show local emergency numbers or connect you to a human now?`;
      return res.json({ answer: escalate, meta: { source: 'escalation', escalation: true } });
    }

    // out-of-domain intent
    const intent = classifyIntent(message);
    if (intent !== 'default') {
      const fallback = {
        weather: `I don't know the current weather. Try checking a weather site or app.`,
        news: `I can't fetch live news. Try a news site.`,
        finance: `I don't have live stock data.`,
        time: `I can't read current local time.`,
        directions: `I can't provide live directions. Use a maps service.`,
      }[intent] || `I can't help with that right now.`;
      return res.json({ answer: fallback, meta: { source: 'fallback', intent }});
    }

    if (sessionId) addToSession(sessionId, 'user', message);

    // KB retrieval
    let topMatches = [];
    try {
      topMatches = await retrieveTopKB(message, RETRIEVE_TOP_K, RETRIEVE_MIN_SCORE);
    } catch (err) {
      console.warn('retrieveTopKB error:', err?.message || err);
    }

    const personaQuery = isLikelyPersonaQuery(message);

    if ((topMatches && topMatches.length > 0) || personaQuery) {
      const topKBtext = (topMatches && topMatches.length > 0)
        ? topMatches.map(m => `File: ${m.file}\n\n${m.text}`).join('\n\n---\n\n')
        : (KB_TEXTS.find(k => k.file.toLowerCase().includes('persona'))?.text || '');

      const systemMsg = `You are Flora, a licensed psychologist who practices evidence-based therapy with emphasis on logotherapy (meaning-centered). Use the knowledge provided in the 'Knowledge base' section to answer questions about Flora's persona, therapy style, boundaries, crisis protocols, resources, and example dialogues. If the question is clinical or asks for diagnosis, say "I can't provide medical advice; please consult a healthcare professional." Use empathic tone, ask clarifying questions, make a concise direct observation and ask the user to validate its accuracy, weave in gentle meaning-focused prompts, and always end your reply with a probing question. If the exact answer is not present in the KB, reply: "I don't know." Do not invent facts. Do not provide legal or medical instructions.`;

      const sessionMsgs = getSessionMessages(sessionId);
      const messages = [
        { role: 'system', content: systemMsg },
        { role: 'system', content: `Knowledge base:\n\n${topKBtext}` },
      ];
      for (const m of sessionMsgs) messages.push({ role: m.role, content: m.content });
      messages.push({ role: 'user', content: message });

      let modelText;
      try {
        modelText = await callConversation(null, messages, { temperature: 0.05, max_tokens: 1100 });
      } catch (err) {
        console.error('Chat error (KB path):', err?.message || err);
        return res.status(500).json({ error: 'Model error', detail: err?.message || String(err) });
      }

      const normalized = modelText.replace(/\r\n/g, '\n').trim();
      const lower = normalized.toLowerCase();

      if (lower === "i don't know" || lower === "i don't know." || lower.includes("i can only answer")) {
        const fallbackSystem = `You are Flora, a compassionate psychologist specializing in logotherapy. Validate feelings, ask a clarifying question, offer gentle meaning-centered reflection, and always end with a probing question. If medical advice is requested, decline and offer to find resources.`;
        const fallbackMessages = [
          { role: 'system', content: fallbackSystem },
          { role: 'user', content: message }
        ];
        let fallbackText;
        try {
          fallbackText = await callConversation(null, fallbackMessages, { temperature: 0.18, max_tokens: 800 });
        } catch (err) {
          console.error('Fallback chat error:', err);
          return res.status(500).json({ error: 'Model error', detail: err?.message || String(err) });
        }
        const pretty = prettyTextFromModel(fallbackText);
        if (sessionId) addToSession(sessionId, 'assistant', pretty);
        return res.json({ answer: pretty, meta: { source: 'fallback', kbHit: false } });
      }

      const pretty = prettyTextFromModel(normalized);
      if (sessionId) addToSession(sessionId, 'assistant', pretty);
      return res.json({ answer: pretty, meta: { source: 'kb', kbHit: true, matches: topMatches.map(m => ({file:m.file, score:m.score})) } });
    }

    // Standard wellness path
    const wellnessSystem = `You are Flora, a licensed psychologist who uses evidence-based therapy and logotherapy (meaning-centered). Always validate the user's feelings briefly, ask a clarifying question, offer a concise observation and ask the user to validate it, weave in gentle meaning-focused prompts and end every reply with a probing question. If the user asks for medical diagnoses, refuse and offer resources. Maintain unconditional positive regard.`;

    const sessionMsgs = getSessionMessages(sessionId);
    const messages = [{ role: 'system', content: wellnessSystem }, ...sessionMsgs.map(m => ({ role: m.role, content: m.content })), { role: 'user', content: message }];

    let aiText;
    try {
      aiText = await callConversation(null, messages, { temperature: 0.18, max_tokens: 900 });
    } catch (err) {
      console.error('Chat error (wellness):', err);
      return res.status(500).json({ error: 'Model error', detail: err?.message || String(err) });
    }

    const pretty = prettyTextFromModel(aiText);
    if (sessionId) addToSession(sessionId, 'assistant', pretty);
    return res.json({ answer: pretty, meta: { source: 'ai', escalation: false } });

  } catch (err) {
    console.error('Unhandled server error:', err);
    res.status(500).json({ error: 'Server error', detail: err?.message });
  }
});

app.listen(PORT, async () => {
  try {
    await buildIndex();
  } catch (err) {
    console.warn('Initial KB build failed:', err?.message || err);
  }
  console.log(`🚀 Flora assistant server running on http://localhost:${PORT}`);
});
