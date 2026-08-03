// /api/generate.js
// Vercel Serverless Function — Cardify AI (Powered by Google Gemini)
// POST /api/generate  { text: string, theme?: string }
// Returns: CardPackageResponse JSON

import { GoogleGenerativeAI } from '@google/generative-ai';

// ── Rate limiting (in-memory, resets on cold start) ──
const rateLimitStore = new Map();
const RATE_LIMIT = 10;
const RATE_WINDOW = 60 * 1000;

function getRateKey(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.socket?.remoteAddress
    || 'unknown';
}

function isRateLimited(ip) {
  const now = Date.now();
  const record = rateLimitStore.get(ip) || { count: 0, resetAt: now + RATE_WINDOW };
  if (now > record.resetAt) {
    rateLimitStore.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
    return false;
  }
  if (record.count >= RATE_LIMIT) return true;
  record.count++;
  rateLimitStore.set(ip, record);
  return false;
}

// ── System Prompt ──
const SYSTEM_PROMPT = `You are a world-class business and academic content architect. Your specialty is distilling long, dense articles or text into visually striking, highly shareable "knowledge card packs" perfect for social media.

CRITICAL: Return ONLY valid JSON. Do NOT wrap in markdown code fences. Do NOT add any text before or after the JSON object.

Output this exact JSON structure:

{
  "theme_color": "dark",
  "total_cards": 3,
  "cards": [
    {
      "card_id": 1,
      "type": "header",
      "title": "Eye-catching title (max 12 words, hits a pain point)",
      "subtitle": "Supporting context or core tension",
      "gold_quote": "The most powerful, tweet-worthy quote or conclusion from the text",
      "key_takeaways": ["Insight 1", "Insight 2", "Insight 3"]
    },
    {
      "card_id": 2,
      "type": "metrics",
      "title": "Key Data & Metrics",
      "metrics": [
        {"label": "Metric name", "value": "Number or result", "desc": "Brief explanation"}
      ]
    },
    {
      "card_id": 3,
      "type": "action",
      "title": "Action Plan",
      "steps": ["Step 1 action", "Step 2 action", "Common pitfall to avoid"]
    }
  ]
}

Rules:
1. Generate 3 to 5 cards. Always start with a "header" type card.
2. Match output language to input (Chinese in → Chinese out; English in → English out).
3. theme_color must be one of: "dark", "light", "cyber", "glass" — pick based on content vibe.
4. Titles must create curiosity and be punchy, not generic summaries.
5. gold_quote should feel like a viral tweet or LinkedIn post.
6. If the text has real numbers/data, create a "metrics" card. If not, add a 2nd "header" or "action" card.
7. Output ONLY the raw JSON object. Nothing else.`;

// ── Input validation ──
function validateInput(body) {
  if (!body || typeof body !== 'object') return 'Request body must be JSON';
  if (!body.text || typeof body.text !== 'string') return 'Field "text" is required';
  if (body.text.trim().length < 50) return 'Text is too short (min 50 characters)';
  if (body.text.length > 15000) return 'Text too long (max 15,000 characters)';
  return null;
}

// ── JSON extraction (strip markdown fences if model adds them) ──
function extractJSON(raw) {
  const trimmed = raw.trim();
  try { return JSON.parse(trimmed); } catch (_) {}

  // Strip ```json ... ``` or ``` ... ```
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    try { return JSON.parse(fenceMatch[1].trim()); } catch (_) {}
  }

  // Find first { ... } block
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    try { return JSON.parse(trimmed.slice(start, end + 1)); } catch (_) {}
  }

  throw new Error('Model returned invalid JSON: ' + trimmed.slice(0, 200));
}

// ── Schema normalization ──
function normalizeResponse(data, themeOverride) {
  const validThemes = ['dark', 'light', 'cyber', 'glass'];
  if (!validThemes.includes(data.theme_color)) data.theme_color = 'dark';
  if (themeOverride && validThemes.includes(themeOverride)) {
    data.theme_color = themeOverride;
  }
  if (!Array.isArray(data.cards) || data.cards.length === 0) {
    throw new Error('Invalid response: no cards array');
  }
  data.total_cards = data.cards.length;
  data.cards = data.cards.map((card, i) => {
    if (!card.card_id) card.card_id = i + 1;
    if (!['header', 'metrics', 'action'].includes(card.type)) card.type = 'header';
    if (!card.title) card.title = 'Key Insights';
    return card;
  });
  return data;
}

// ── Main handler ──
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  // Rate limit
  const ip = getRateKey(req);
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: 'Too many requests. Please wait a moment.', retryAfter: 60 });
  }

  // Validate
  const validationError = validateInput(req.body);
  if (validationError) return res.status(400).json({ error: validationError });

  const { text, theme } = req.body;

  if (!process.env.GEMINI_API_KEY) {
    console.error('GEMINI_API_KEY is not set');
    return res.status(500).json({ error: 'Server configuration error: API key not configured' });
  }

  const modelName = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048,
        responseMimeType: 'application/json', // Force JSON output mode
      },
      systemInstruction: SYSTEM_PROMPT,
    });

    const userPrompt = theme
      ? `Use visual theme "${theme}". Generate knowledge cards for:\n\n${text.trim()}`
      : `Generate knowledge cards for:\n\n${text.trim()}`;

    const result = await model.generateContent(userPrompt);
    const rawText = result.response.text();

    if (!rawText) throw new Error('Empty response from Gemini');

    const parsed = extractJSON(rawText);
    const normalized = normalizeResponse(parsed, theme);

    return res.status(200).json(normalized);

  } catch (err) {
    console.error('Gemini generation error:', err);

    // Gemini quota / auth errors
    if (err.message?.includes('API_KEY_INVALID') || err.message?.includes('401')) {
      return res.status(500).json({ error: 'Invalid Gemini API key. Please check your configuration.' });
    }
    if (err.message?.includes('RESOURCE_EXHAUSTED') || err.message?.includes('429')) {
      return res.status(429).json({ error: 'Gemini rate limit reached. Please try again in a moment.' });
    }
    if (err.message?.includes('SAFETY')) {
      return res.status(400).json({ error: 'Content was blocked by safety filters. Please try different content.' });
    }

    return res.status(500).json({
      error: 'Card generation failed. Please try again.',
      detail: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
}
