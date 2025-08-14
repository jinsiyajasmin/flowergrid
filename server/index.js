import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';
import OpenAI from "openai";

const app = express();
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5173'],
  credentials: true
}));
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const KB_DIR = path.resolve('./kb');
let KB_TEXTS = [];

// Load KB
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
  console.log(`Loaded ${KB_TEXTS.length} KB files.`);
}

app.post('/chat', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Message required' });

    if (KB_TEXTS.length === 0) await buildIndex();

    const kbContext = KB_TEXTS.map(k => `${k.text}`).join("\n\n");

    const prompt = `
You are an ISO-only assistant. Use only the provided knowledge base below to answer.
Format the answer so that each point is on a separate line and leave a blank line between points.
Do not use *, #, or any markdown symbols.
If unsure, simply say "I don't know."

Knowledge base:
${kbContext}

User: ${message}
Answer:
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a helpful ISO assistant." },
        { role: "user", content: prompt }
      ]
    });

    // Clean up extra symbols from AI response just in case
    let text = response.choices[0].message.content;
    text = text.replace(/[*#]/g, '').replace(/\r\n/g, '\n');

    res.json({ answer: text });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'OpenAI API error', detail: err.message });
  }
});


app.listen(3001, async () => {
  await buildIndex();
  console.log(`🚀 ISO bot server running on http://localhost:3001`);
});
