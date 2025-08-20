import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';
import OpenAI from "openai";

const app = express();

// CORS setup
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5173'],
  credentials: true
}));
app.use(express.json());

// OpenAI setup
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Knowledge base setup
const KB_DIR = path.resolve('./kb');
let KB_TEXTS = [];

// Load KB files
async function buildIndex() {
  KB_TEXTS = [];
  try {
    await fs.access(KB_DIR);
  } catch {
    await fs.mkdir(KB_DIR, { recursive: true });
    console.log(`KB directory created at ${KB_DIR}. Add your ISO notes as .txt or .md files.`);
    return;
  }

  const files = (await fs.readdir(KB_DIR)).filter(f => /\.(txt|md)$/i.test(f));
  for (const f of files) {
    const content = await fs.readFile(path.join(KB_DIR, f), 'utf8');
    KB_TEXTS.push({ file: f, text: content });
  }
  console.log(`Loaded ${KB_TEXTS.length} KB files:`, KB_TEXTS.map(k => k.file));
}

// Chat endpoint
app.post('/chat', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Message required' });

    // Load KB if not loaded
    if (KB_TEXTS.length === 0) await buildIndex();
    if (KB_TEXTS.length === 0) return res.json({ answer: "Knowledge base is empty. Add .txt or .md files in /kb" });

    const kbContext = KB_TEXTS.map(k => `${k.text}`).join("\n\n");

    // If user entered a very short keyword, force expansion
    const isShort = message.trim().split(/\s+/).length <= 2;

    const prompt = `
You are an ISO-only assistant. Use only the knowledge base below to answer.
Answer concisely. Each point should be on a separate line.
Leave a blank line between points.
Do not use *, #, or any markdown symbols.
If the question is not related to ISO, respond with "I can only answer ISO-related questions."
If you don't know the answer from the KB, simply say "I don't know."
${isShort ? "If the user input is just a keyword, explain it clearly and provide context from the knowledge base." : ""}

Knowledge base:
${kbContext}

User: ${message}
Answer:
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a helpful ISO assistant. Always explain keywords (e.g., 'ISO', 'audit', '9001') with proper context from the knowledge base. If question is not ISO-related, respond 'I can only answer ISO-related questions.'" },
        { role: "user", content: prompt }
      ]
    });

    let text = response.choices[0].message.content;
    text = text.replace(/[*#]/g, '').replace(/\r\n/g, '\n').trim();

    res.json({ answer: text });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'OpenAI API error', detail: err.message });
  }
});

// Start server
app.listen(3001, async () => {
  await buildIndex();
  console.log(`🚀 ISO bot server running on http://localhost:3001`);
});
