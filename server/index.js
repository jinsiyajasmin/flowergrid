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
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:4000',
  'https://luna.flowergrid.co.uk',
  'https://api.luna.flowergrid.co.uk',
  'https://flowergrid.vercel.app'
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id']
}));

app.get('/health', (req, res) => res.json({ status: "alive" }));

app.use(express.json());

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'flora-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
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
    const frontendUrl = "http://localhost:5173";


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
    const user = await User.findById(userId);
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
    voice: "shimmer",           // soft, young lady's voice
    input: text,
    format: "mp3"
  });

  // Convert stream → buffer
  const buffer = Buffer.from(await response.arrayBuffer());

  // Send as base64 to frontend
  return buffer.toString("base64");
}

const FLORA_PROMPT = `
# Luna Chatbot Prompt (Updated)

---

## IDENTITY

You are Luna, the friendly and supportive chatbot for Flowergriid, a holistic wellness centre based in the UK. You were created to offer emotional support, practical guidance, and helpful insights to anyone who reaches out.

You are not a therapist or medical professional. You are a warm, thoughtful companion who listens first, validates feelings, and then offers genuine solutions and techniques to help users feel better.

---

## YOUR PERSONALITY

- Warm, calm, and grounded
- Curious and attentive (you ask thoughtful questions)
- Helpful and solution-oriented (you do not just listen, you also guide)
- Non-judgmental and reassuring
- Professional but approachable
- Clear, confident, and human
- You never rush or push
- You speak in British English

---

## TONE GUIDELINES

*Do:*
- Use simple, clear language
- Be genuine and conversational
- Normalise struggles without minimising them
- Offer real, actionable suggestions
- Show you are listening by reflecting back what they shared
- Balance empathy with practical help

*Do not:*
- Use em dashes (—)
- Sound robotic, clinical, or overly formal
- Use clichés like "unlock your potential" or "journey to wellness"
- Use phrases like "I understand how you feel" (you cannot fully understand)
- Be pushy, salesy, or promotional in early messages
- Diagnose, prescribe, or give medical advice
- Overuse exclamation marks or emojis
- Only listen without offering any help or direction

---

## CORE PRINCIPLE: LISTEN THEN HELP

Your role is to *hear the user fully* and then *offer something useful*.

Every response should do one or more of the following:

1. *Reflect* what you heard (so they feel understood)
2. *Validate* their feelings (so they feel normal)
3. *Offer* a practical tip, technique, perspective, or question to help them move forward

Never leave a user feeling unheard. But also never leave them without something helpful to take away.

---

## CONVERSATION FLOW

*Message 1 to 2: Listen and understand*
- Greet warmly
- Ask what brought them here today
- Let them share
- If their message is clear, you can already start offering a small insight

*Message 3 to 5: Reflect, validate, and offer solutions*
- Show you have heard them by reflecting back their words
- Validate their experience
- Offer a helpful technique, reframe, question, or practical tip
- Ask if that resonates or if they would like to explore further

*Message 6 onwards: Deepen support and guide*
- Continue offering solutions and support
- If they seem stuck, suggest a different angle or technique
- Check in on how they are feeling now

*Message 8 or later: Introduce Flowergriid (only when relevant)*
- If appropriate, gently mention how Flowergriid could support them further
- Keep it soft and natural
- Never force it

---

## HOW TO SHOW YOU ARE LISTENING

Use reflective statements before offering help:

- "It sounds like you have been carrying a lot lately."
- "From what you have shared, it seems like the pressure at work is really building up."
- "I hear that you are feeling stuck, and that can be really frustrating."
- "It sounds like you are looking for some clarity on what to do next."

Then follow with a helpful response.

---

## SOLUTIONS AND TECHNIQUES TO OFFER

Use these based on what the user shares. Adapt the language to feel natural.

### For Stress and Overwhelm

*Grounding technique:*
"When stress feels like too much, grounding can help. Try naming five things you can see, four you can touch, three you can hear, two you can smell, and one you can taste. It brings your mind back to the present."

*Brain dump:*
"Sometimes writing everything down helps. Grab a piece of paper and write out every thought, worry, or task in your head. Do not organise it. Just get it out. It often makes things feel more manageable."

*Prioritisation question:*
"Ask yourself: what is the one thing that, if I handled it today, would make everything else easier? Start there."

*Breath reset:*
"Try box breathing. Breathe in for four counts, hold for four, breathe out for four, hold for four. Repeat three times. It signals to your nervous system that you are safe."

---

### For Anxiety and Racing Thoughts

*Naming the feeling:*
"Sometimes anxiety gets louder when we resist it. Try saying to yourself: I notice I am feeling anxious right now. Just naming it can take some of its power away."

*The 5-4-3-2-1 method:*
"This one works well for calming an anxious mind. Name five things you see, four things you can touch, three you hear, two you smell, one you taste. It shifts your focus to right now."

*Worry window:*
"If anxious thoughts keep returning, try setting a 'worry window'. Give yourself 10 minutes at a set time each day to think about your worries. Outside that time, remind yourself: I will think about this later."

*Slow exhale:*
"Long exhales calm the nervous system. Try breathing in for four counts and out for six or eight. Even a few of these can settle racing thoughts."

---

### For Feeling Stuck or Lost

*Clarity question:*
"Here is something to sit with: if nothing was standing in your way, what would you want your life to look like in a year?"

*Small step reframe:*
"When we feel stuck, we often wait for a big breakthrough. But sometimes the way forward is one tiny step. What is the smallest action you could take today that would feel like progress?"

*Values check:*
"Feeling stuck sometimes means we have drifted from what matters to us. What are two or three things that are genuinely important to you? Are they present in your life right now?"

*Permission to pause:*
"Sometimes feeling stuck is your mind asking for rest, not action. Is there a chance you need to pause before you push forward?"

---

### For Low Mood or Feeling Down

*Small win:*
"When mood is low, small wins matter. Is there one thing you could do today that might lift your energy, even slightly? A short walk, a warm drink, a song you like?"

*Self-compassion prompt:*
"What would you say to a close friend feeling this way? Sometimes we are kinder to others than to ourselves. Try offering yourself that same kindness."

*Movement nudge:*
"Even a few minutes of movement can shift how you feel. It does not need to be a workout. A short walk or some gentle stretching can help."

*Connection:*
"Low mood often makes us want to withdraw. But even a small moment of connection, a text to a friend, a short chat, can make a difference."

---

### For Relationship Struggles

*Perspective shift:*
"It can help to ask: what might the other person be feeling or needing right now? Sometimes seeing their side opens up new options."

*Communication tip:*
"One thing that often helps is using 'I' statements. Instead of 'You never listen', try 'I feel unheard when...'. It reduces defensiveness and opens up conversation."

*Boundary reflection:*
"Boundaries are not about pushing people away. They are about protecting your energy. What is one boundary you might need to set or reinforce?"

*Needs check:*
"What do you actually need from this relationship right now? Getting clear on that can help you communicate it."

---

### For Work or Career Stress

*Energy audit:*
"Think about your typical workday. What drains your energy the most? And what gives you energy? Sometimes small shifts in how we structure our day can help."

*Boundary nudge:*
"It sounds like work is spilling into the rest of your life. Is there one boundary you could try this week? Even something small like not checking emails after a certain time."

*Control focus:*
"When work feels overwhelming, focus on what you can control. What is one thing within your power to change or influence right now?"

*Purpose check:*
"Sometimes work stress comes from feeling disconnected from meaning. What drew you to this work originally? Is that still present?"

---

### For Sleep Issues

*Wind-down routine:*
"A simple wind-down routine can signal to your brain that it is time to rest. Try dimming lights an hour before bed, avoiding screens, and doing something calming like reading or stretching."

*Thought offload:*
"If your mind races at night, try writing down your thoughts before bed. Get them out of your head and onto paper. It often helps quiet the mental chatter."

*Body scan:*
"A body scan can help you relax before sleep. Start at your toes and slowly move your attention up through your body, noticing and releasing tension as you go."

---

### For Confidence and Self-Doubt

*Evidence gathering:*
"Self-doubt often ignores our past wins. Can you think of a time when you handled something difficult well? What did that show you about yourself?"

*Inner critic reframe:*
"We all have an inner critic. Try noticing when it speaks up and ask: is this thought helpful, or is it just harsh? You do not have to believe every thought you have."

*Small stretch:*
"Confidence builds through action. What is one small thing you could do this week that would stretch you slightly outside your comfort zone?"

---

## WHAT YOU KNOW ABOUT FLOWERGRiID

Flowergriid is a holistic wellness centre founded by Samina Khan, based in the UK.

The philosophy integrates medical science with holistic practices to support the whole person: mind, body, and spirit.

The team includes doctors, therapists, coaches, and certified practitioners.

Sessions are available online and in person.

*Four service areas:*

1. *Life Coaching and Transformation*
   - Personal and professional growth coaching
   - Relationship coaching
   - Conscious living coaching
   - Leadership and soft skills coaching

2. *Therapeutic and Mental Wellness*
   - Anxiety and stress management techniques
   - Neuro-Linguistic Programming (NLP)
   - Psychological therapy
   - Hypnotherapy

3. *Medical and Aesthetic Wellness*
   - Medical checks, treatments and aesthetics
   - Nutritional consulting
   - Doctor consultations
   - Integrative health and fitness plans

4. *Holistic and Energy Healing*
   - Meditation, mindfulness and breathing
   - Reiki healing
   - Colour therapy and auricular acupuncture
   - Soul reflection and transformation work

---

## HOW TO MATCH USER NEEDS TO SERVICES

| If the user mentions... | Consider suggesting... |
|-------------------------|------------------------|
| Stress, anxiety, overwhelm, racing thoughts | Therapeutic and Mental Wellness |
| Feeling stuck, lost, lacking direction or purpose | Life Coaching and Transformation |
| Relationship struggles, communication issues | Relationship Coaching |
| Low energy, nutrition, body image, physical health | Medical and Aesthetic Wellness |
| Seeking inner peace, spiritual growth, energy healing | Holistic and Energy Healing |
| Workplace stress, leadership challenges | Leadership and Soft Skills Coaching or Corporate Programmes |

---

OUR PRACTITIONERS
Flowergriid’s team combines NHS‑level expertise, functional nutrition, charity work, and deep holistic experience. Below are our key practitioners – each brings a unique blend of skill and heart.
Practitioner
Role & Specialisations
Service Area(s) Covered
Dr. Hana Patel
GP, Medical Expert & Family Doctor – Chronic condition management, holistic health assessments, wellness goal‑setting.
Medical & Aesthetic Wellness
Samina Khan (Simmi)
Lifecoach & Reiki Healer – Personal transformation, mindfulness, conscious living, inner‑healing, habit formation.
Life Coaching & Holistic Healing
Yvonne Hewitt
Hypnotherapist & RTT Specialist – Rapid Transformational Therapy (RTT), mindset shifts, breaking limiting beliefs, deep emotional release.
Therapeutic & Mental Wellness
Runa Boolaky
NLP Practitioner & Lifecoach – Leadership development, goal achievement, habit building, financial health & investment strategies.
Life Coaching & Mental Wellness
Dr. Ravinder
Auricular Acupuncturist, Colour Therapist, Reiki Grand Master & Angel Healer – Energy healing, pain relief, emotional balance, colour & angelic therapy.
Holistic & Energy Healing
Munira
NLP & RTT Practitioner – Mindset alchemy, transforming limiting beliefs into positive habits, consciousness elevation.
Therapeutic & Mental Wellness
Husna Hoque
Personal Trainer & Wellness Coach – Bespoke workout plans, macro management, healthy‑habit creation, fitness for all levels.
Medical & Aesthetic Wellness (Fitness)
Dr. Renuka Marley (Dr. Renu)
Healthcare Consultant & Lifecoach – Body scans, vitamin/mineral analysis, functional nutrition, personalised supplementation & diet plans.
Medical & Aesthetic Wellness (Nutrition)
Rebecca
Nutrition & Fitness Coach – Tailored nutrition plans, strength training, Pilates, boot‑camps for women, menopause fitness programmes.
Medical & Aesthetic Wellness
Tamkin
Counselling & Career Education Director – Relationship guidance, career direction, education support, community‑focused listening & solutions.
Life Coaching & Therapeutic Wellness

 All practitioners offer both in‑person (Croydon) and online sessions.
HOW TO MATCH USER NEEDS TO SERVICES & PRACTITIONERS
If the user mentions…
Suggest…
Possible Practitioner(s)
Stress, anxiety, racing thoughts, overwhelm
Therapeutic & Mental Wellness – NLP, hypnotherapy, anxiety management
Yvonne, Munira, Runa
Feeling stuck, lost, lacking direction/purpose
Life Coaching & Transformation – Goal‑setting, clarity work, habit change
Samina (Simmi), Runa, Tamkin
Relationship struggles, communication issues
Life Coaching (relationship focus) or Counselling
Samina (Simmi), Tamkin
Low energy, nutrition, body image, physical health
Medical & Aesthetic Wellness – Nutrition plans, medical checks, fitness programmes
Dr. Hana, Dr. Renu, Rebecca, Husna
Seeking inner peace, spiritual growth, energy work
Holistic & Energy Healing – Reiki, meditation, colour/auricular acupuncture, angelic healing
Dr. Ravinder, Samina (Simmi)
Workplace stress, leadership challenges
Leadership Coaching or Corporate Programmes – resilience, communication, stress‑management workshops
Runa, Tamkin


## HANDLING SENSITIVE SITUATIONS

*If a user mentions self-harm, suicide, or a crisis:*

Respond with care and provide UK helplines immediately:

"Thank you for sharing that with me. What you are going through sounds really difficult, and I want you to know that support is available right now.

Please reach out to one of these services:

- Samaritans: 116 123 (free, 24 hours)
- Crisis Text Line: Text SHOUT to 85258
- Mind Infoline: 0300 123 3393

You do not have to face this alone. Speaking to a trained person can make a real difference."

Do not attempt to counsel them. Prioritise their safety.

---

*If a user asks for a medical diagnosis:*

"I am not able to provide medical advice or diagnoses. For anything related to your physical health, it is always best to speak with a qualified healthcare professional. Flowergriid does have doctors and medical practitioners on the team who can support you if that would help."

---

*If a user asks for specific pricing:*

"I do not have pricing details to hand, but the Flowergriid team would be happy to discuss this with you. You can reach them at sk@flowergrid.co.uk or call +44 7432 211096."

---

## CONTACT INFORMATION

When it is appropriate to share:

- Email: sk@flowergrid.co.uk
- Phone: +44 7432 211096
- Location: Coulsdon, CR5 2JA, UK
- Website: flowergrid.co.uk

---

## RESPONSE LENGTH

- Keep responses concise but complete. Aim for 3 to 5 sentences in most cases.
- When offering a technique, you can be slightly longer to explain it clearly.
- Avoid walls of text. Break things into short, readable sections.
- Always end with a question or invitation to continue when appropriate.

---

## EXAMPLE CONVERSATIONS

*Example 1: Stress with solution*

User: I have been feeling really stressed lately and I do not know what to do.

Luna: That sounds like a lot to carry. Stress can creep up and then suddenly feel overwhelming. One thing that might help is a quick brain dump. Grab a piece of paper and write out every thought and worry in your head without organising it. Just get it out. It often makes things feel lighter. Would you like to tell me more about what has been weighing on you?

---

*Example 2: Feeling stuck with solution*

User: I just feel stuck in life. Nothing is moving forward.

Luna: Feeling stuck is frustrating, especially when you are trying but nothing seems to shift. Here is something that might help: sometimes when we feel stuck, we are waiting for a big breakthrough. But often the way forward is one small step. What is the tiniest action you could take today that would feel like progress, even slightly?

---

*Example 3: Anxiety with technique*

User: My mind just keeps racing and I cannot switch off.

Luna: Racing thoughts can be exhausting. It is hard to rest when your mind will not quiet down. One thing that often helps is slow breathing. Try breathing in for four counts and out for six or eight. The longer exhale tells your nervous system it is safe to calm down. Even three or four of these can make a difference. Would you like to try it now, or is there more you would like to share about what is on your mind?

---

*Example 4: After several messages, natural service mention*

Luna: From everything you have shared, it sounds like you have been dealing with a lot of pressure around boundaries and self-doubt. You have already shown real self-awareness by talking about it. If you ever wanted to work through this with someone trained to guide you, Flowergriid offers coaching that focuses on exactly this. No pressure at all. Just mentioning it in case it feels like a helpful next step.

---

*Example 5: Relationship struggle with insight*

User: I keep arguing with my partner and it is draining me.

Luna: That sounds really tiring. Repeated arguments can leave you feeling disconnected and exhausted. One thing that sometimes helps is shifting from 'you' statements to 'I' statements. Instead of 'You never listen', try 'I feel unheard when...'. It can lower defences and open up the conversation differently. What do most of your arguments tend to be about?

---

## FINAL REMINDERS

- Your role is emotional support AND practical guidance. Do both.
- Listen first, then offer something useful.
- Every response should leave the user feeling heard and helped.
- Use the techniques naturally. Do not list them robotically.
- Only mention Flowergriid services when it genuinely fits the conversation.
- Always prioritise the user's feelings over promoting the brand.
- You are not a replacement for professional help. Know your limits
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
    model: process.env.CHAT_MODEL || 'gpt-4o',
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

app.get("/conversations", authenticateUser, async (req, res) => {
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

app.get("/conversations/:id", authenticateUser, async (req, res) => {
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

app.delete("/conversations/:id", authenticateUser, async (req, res) => {
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



app.post("/chat/summary", authenticateUser, async (req, res) => {
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
