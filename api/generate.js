// /api/generate.js
// Vercel Serverless Function — Cardify AI (Powered by Google Gemini)
// POST /api/generate { text, theme?, style?, userApiKey?, licenseKey?, lang? }
// Returns: CardPackageResponse JSON with channel tag

import { GoogleGenerativeAI } from '@google/generative-ai';

// ══════════════════════════════════════════════════════════
// DAILY IP RATE LIMITER (3 free/day per IP, UTC reset)
// ══════════════════════════════════════════════════════════
const rateLimitStore = new Map();
const DAILY_FREE_LIMIT = 3;

function getRateKey(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.socket?.remoteAddress
    || 'unknown';
}

function checkDailyIpLimit(ip) {
  const today = new Date().toISOString().slice(0, 10);
  const record = rateLimitStore.get(ip);
  if (!record || record.dateStr !== today) {
    rateLimitStore.set(ip, { count: 1, dateStr: today });
    return { allowed: true, count: 1 };
  }
  if (record.count >= DAILY_FREE_LIMIT) {
    return { allowed: false, count: record.count };
  }
  record.count += 1;
  rateLimitStore.set(ip, record);
  return { allowed: true, count: record.count };
}

// ══════════════════════════════════════════════════════════
// STYLE SYSTEM PROMPTS
// ══════════════════════════════════════════════════════════
const STYLE_PROMPTS = {
  default: `You are a world-class content architect. Distill the input into 3-5 beautiful knowledge cards.

Return ONLY a raw, valid JSON object — absolutely NO markdown fences, NO \`\`\`json, NO explanation text:
{
  "theme_color": "dark",
  "total_cards": 3,
  "cards": [
    { "card_id": 1, "type": "header", "title": "Punchy title (max 12 words)", "subtitle": "Supporting context", "gold_quote": "Most viral-worthy quote from the text", "key_takeaways": ["Insight 1", "Insight 2", "Insight 3"] },
    { "card_id": 2, "type": "metrics", "title": "Key Data & Metrics", "metrics": [{"label": "Name", "value": "Number", "desc": "Brief note"}] },
    { "card_id": 3, "type": "action", "title": "Action Plan", "steps": ["Step 1", "Step 2", "Pitfall to avoid"] }
  ]
}
Rules: 3-5 cards, start with header, pick theme_color from dark/light/cyber/glass, output RAW JSON only.`,

  xiaohongshu: `你是一位顶级小红书爆款内容策划师，擅长将任何内容改写为高传播性的小红书风格知识卡片包。
仅返回原生 JSON 对象（绝对不要 \`\`\`json 标记或任何说明文字）：
{
  "theme_color": "light",
  "total_cards": 4,
  "cards": [
    { "card_id": 1, "type": "header", "title": "超吸睛标题（含数字与 emoji，最多 15 字）", "subtitle": "引发共鸣的痛点副标题", "gold_quote": "最适合截图传播的金句（口语化、有情绪、有力量）", "key_takeaways": ["📌 干货 1", "💡 干货 2", "🔥 干货 3"] },
    { "card_id": 2, "type": "metrics", "title": "📊 数据说话", "metrics": [{"label": "关键指标", "value": "震撼数字", "desc": "简短说明"}] },
    { "card_id": 3, "type": "action", "title": "🛠 手把手行动指南", "steps": ["第一步：具体行动", "第二步：具体行动", "⚠️ 最容易踩的坑"] },
    { "card_id": 4, "type": "header", "title": "最后一句话总结", "subtitle": "升华主题的结论", "gold_quote": "适合收藏的人生感悟式结尾", "key_takeaways": ["📌 记住这一条", "📌 立刻去做这件事", "📌 避开这个误区"] }
  ]
}
要求：语言轻快活泼、有情绪感染力、善用 emoji、高饱和金句，输出原生 JSON。`,

  twitter: `You are a top-tier business analyst and LinkedIn thought leader. Transform the input into data-driven, professional insight cards optimized for Twitter/X threads and LinkedIn posts.

Return ONLY a raw JSON object — NO markdown fences, NO \`\`\`json:
{
  "theme_color": "dark",
  "total_cards": 4,
  "cards": [
    { "card_id": 1, "type": "header", "title": "Bold contrarian claim (max 10 words)", "subtitle": "Why this matters to professionals right now", "gold_quote": "The one tweet-worthy line that would get 1000+ RTs", "key_takeaways": ["Hard truth #1", "Hard truth #2", "Hard truth #3"] },
    { "card_id": 2, "type": "metrics", "title": "The Numbers Don't Lie", "metrics": [{"label": "Key metric", "value": "Exact figure", "desc": "Why this number matters"}] },
    { "card_id": 3, "type": "metrics", "title": "Industry Benchmarks", "metrics": [{"label": "Benchmark", "value": "Value", "desc": "Context"}] },
    { "card_id": 4, "type": "action", "title": "The Strategic Playbook", "steps": ["Strategic move #1", "Strategic move #2", "Common mistake leaders make"] }
  ]
}
Rules: Professional tone, data-heavy, raw JSON only.`,

  outline: `You are an expert content strategist and video scriptwriter. Break down the input into a clear, hierarchical outline.

Return ONLY a raw JSON object — NO markdown fences, NO \`\`\`json:
{
  "theme_color": "cyber",
  "total_cards": 4,
  "cards": [
    { "card_id": 1, "type": "header", "title": "Video/Article Title Hook", "subtitle": "Core promise: what viewers will learn", "gold_quote": "Opening hook line that stops the scroll", "key_takeaways": ["Main argument 1", "Main argument 2", "Main argument 3"] },
    { "card_id": 2, "type": "action", "title": "Part 1: Opening & Context", "steps": ["Hook & problem statement", "Why this matters now", "Preview of what's coming"] },
    { "card_id": 3, "type": "action", "title": "Part 2: Core Content", "steps": ["Key point A with evidence", "Key point B with evidence", "Key point C with evidence"] },
    { "card_id": 4, "type": "action", "title": "Part 3: Conclusion & CTA", "steps": ["Summary of key takeaways", "Actionable next step for audience", "Call-to-action / closing line"] }
  ]
}
Rules: Clear hierarchy, outline-focused, raw JSON only.`
};

// ══════════════════════════════════════════════════════════
// INPUT VALIDATION
// ══════════════════════════════════════════════════════════
function validateInput(body) {
  if (!body || typeof body !== 'object') return 'Request body must be JSON';
  if (!body.text || typeof body.text !== 'string') return 'Field "text" is required';
  if (body.text.trim().length < 30) return 'Text is too short (min 30 characters)';
  if (body.text.length > 15000) return 'Text too long (max 15,000 characters)';
  return null;
}

// ══════════════════════════════════════════════════════════
// ROBUST JSON EXTRACTION (5-layer defense)
// ══════════════════════════════════════════════════════════
function extractJSON(raw) {
  if (!raw || typeof raw !== 'string') {
    throw new Error('AI_RESPONSE_EMPTY');
  }

  let text = raw.trim();

  // Layer 1: Direct parse
  try { return JSON.parse(text); } catch (_) {}

  // Layer 2: Strip ```json ... ``` markdown fences
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    try { return JSON.parse(fenceMatch[1].trim()); } catch (_) {}
  }

  // Layer 3: Strip any leading/trailing non-JSON text, find first { to last }
  const objStart = text.indexOf('{');
  const objEnd   = text.lastIndexOf('}');
  if (objStart !== -1 && objEnd > objStart) {
    try { return JSON.parse(text.slice(objStart, objEnd + 1)); } catch (_) {}
  }

  // Layer 4: Find first [ to last ] (array response)
  const arrStart = text.indexOf('[');
  const arrEnd   = text.lastIndexOf(']');
  if (arrStart !== -1 && arrEnd > arrStart) {
    try {
      const arr = JSON.parse(text.slice(arrStart, arrEnd + 1));
      // Wrap bare array into expected shape
      return { theme_color: 'dark', cards: arr, total_cards: arr.length };
    } catch (_) {}
  }

  // Layer 5: Remove control characters and retry
  const cleaned = text.replace(/[\u0000-\u001F\u007F]/g, ' ');
  const cs = cleaned.indexOf('{');
  const ce = cleaned.lastIndexOf('}');
  if (cs !== -1 && ce > cs) {
    try { return JSON.parse(cleaned.slice(cs, ce + 1)); } catch (_) {}
  }

  throw new Error('AI_RESPONSE_FORMAT_ERROR');
}

// ══════════════════════════════════════════════════════════
// SCHEMA NORMALIZATION
// ══════════════════════════════════════════════════════════
function normalizeResponse(data, themeOverride) {
  const validThemes = ['dark', 'light', 'cyber', 'glass'];

  // Ensure theme_color is valid
  if (!validThemes.includes(data.theme_color)) data.theme_color = 'dark';
  if (themeOverride && validThemes.includes(themeOverride)) {
    data.theme_color = themeOverride;
  }

  // Ensure cards array exists and is non-empty
  if (!Array.isArray(data.cards) || data.cards.length === 0) {
    throw new Error('AI_RESPONSE_NO_CARDS');
  }

  // Clamp to max 5 cards
  data.cards = data.cards.slice(0, 5);
  data.total_cards = data.cards.length;

  data.cards = data.cards.map((card, i) => {
    if (!card.card_id) card.card_id = i + 1;
    if (!['header', 'metrics', 'action'].includes(card.type)) card.type = 'header';
    if (!card.title || typeof card.title !== 'string') card.title = 'Key Insights';
    return card;
  });

  return data;
}

// ══════════════════════════════════════════════════════════
// LANGUAGE MAP
// ══════════════════════════════════════════════════════════
const LANG_MAP = {
  en: 'English',
  zh: 'Simplified Chinese (简体中文)',
  es: 'Spanish (Español)',
  pt: 'Portuguese (Português)',
  ru: 'Russian (Русский)',
  ja: 'Japanese (日本語)',
  ko: 'Korean (한국어)',
  fr: 'French (Français)',
  de: 'German (Deutsch)',
};

// ══════════════════════════════════════════════════════════
// SYSTEM ENVIRONMENT KEYS COLLECTOR (multi-key pool)
// ══════════════════════════════════════════════════════════
function getSystemEnvKeys() {
  const keys = [];
  const envVars = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_BACKUP,
    process.env['Gemini-API'],
    process.env.GEMINI_API,
    process.env.GEMINI_KEY
  ];
  envVars.forEach(val => {
    if (val && typeof val === 'string') {
      val.split(',').map(k => k.trim()).filter(k => k.length > 5).forEach(k => {
        // Warn if key doesn't look like a valid Gemini API key (should start with AIza)
        if (!k.startsWith('AIza')) {
          console.warn(`[Key Warning] Env key "${k.slice(0,8)}..." does NOT look like a valid Gemini API key. Gemini keys must start with "AIza". Got: ${k.slice(0,12)}`);
        }
        if (!keys.includes(k)) keys.push(k);
      });
    }
  });
  if (keys.length === 0) {
    console.error('[Key Error] No GEMINI_API_KEY found in environment variables! Set GEMINI_API_KEY in Vercel project settings.');
  }
  return keys;
}

// ══════════════════════════════════════════════════════════
// MAIN HANDLER
// ══════════════════════════════════════════════════════════
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }

  const validationError = validateInput(req.body);
  if (validationError) return res.status(400).json({ error: validationError });

  const { text, theme, style, userApiKey, licenseKey, lang } = req.body;

  // ══════════════════════════════════════════════════════════
  // STRICT 3-TIER KEY & AUTH PRIORITY SCHEDULER
  // Priority 1: User's own API key  → bypass rate limit, use user key
  // Priority 2: VIP license key     → bypass rate limit, use system key
  // Priority 3: Free tier           → enforce 3/day IP rate limit
  // ══════════════════════════════════════════════════════════
  const userKeyClean = (typeof userApiKey === 'string' && userApiKey.trim().length > 5)
    ? userApiKey.trim() : null;
  const isVipMember = (typeof licenseKey === 'string' && licenseKey.trim().length >= 5);

  let activeChannel = 'free_tier';
  let keysToTry = [];

  if (userKeyClean) {
    // ✦ Tier 1: User's personal API key — unlimited, forced priority
    activeChannel = 'user_custom_key';
    keysToTry = [userKeyClean];

  } else if (isVipMember) {
    // ✦ Tier 2: VIP license member — use official key pool, bypass rate limit
    activeChannel = 'vip_official_key';
    keysToTry = getSystemEnvKeys();

  } else {
    // ✦ Tier 3: Free tier — enforce daily 3-request IP limit
    activeChannel = 'free_tier';
    const ip = getRateKey(req);
    const limitCheck = checkDailyIpLimit(ip);
    if (!limitCheck.allowed) {
      return res.status(429).json({
        error: 'DAILY_LIMIT_EXCEEDED',
        message: 'You have reached your daily limit of 3 free cards. Upgrade to VIP or use your own Gemini API Key.'
      });
    }
    keysToTry = getSystemEnvKeys();
  }

  if (keysToTry.length === 0) {
    console.error(`[Auth] No API key available for channel "${activeChannel}"`);
    return res.status(500).json({ error: 'SERVER_KEY_MISSING' });
  }

  // ══════════════════════════════════════════════════════════
  // BUILD SYSTEM INSTRUCTION WITH LANGUAGE LOCK
  // ══════════════════════════════════════════════════════════
  const stylePrompt = STYLE_PROMPTS[style] || STYLE_PROMPTS.default;
  const targetLang  = LANG_MAP[lang] || 'English';

  const sysInstruction = `${stylePrompt}

CRITICAL OUTPUT RULES (highest priority — always obey):
1. Respond with ONLY a raw, valid JSON object. Do NOT use markdown code blocks (\`\`\`json or \`\`\`). Do NOT include any explanation or preamble.
2. Always respond strictly in the requested target language: ${targetLang}. Every text field (title, subtitle, gold_quote, key_takeaways, metric labels/desc, steps) MUST be in ${targetLang}.
3. SERIES & CHAPTER AWARENESS: If the input text belongs to a chapter/part/section (e.g., contains "Chapter 1", "第一章", "Part 1", "上集"), prefix Card 1's title with a tag like "[ Part 1 ] Title" or "[ 第一章 ] 标题".
4. Output between 3 and 5 cards total. Never output more than 5.`;

  const userPrompt = `Target Output Language: ${targetLang}\nVisual Theme: "${theme || 'dark'}"\n\nContent to transform into knowledge cards:\n\n${text.trim()}`;

  // ══════════════════════════════════════════════════════════
  // MULTI-KEY & MULTI-MODEL FAILOVER LOOP
  // ══════════════════════════════════════════════════════════
  const primaryModel  = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  const fallbackModel = 'gemini-1.5-flash';

  let rawText  = '';
  let lastError = null;

  outer: for (const currentApiKey of keysToTry) {
    const genAI = new GoogleGenerativeAI(currentApiKey);

    for (const modelName of [primaryModel, fallbackModel]) {
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048,
            responseMimeType: 'application/json'
          },
          systemInstruction: sysInstruction,
        });
        const result = await model.generateContent(userPrompt);
        rawText = result.response.text();
        if (rawText && rawText.trim().length > 10) break outer;
      } catch (err) {
        console.warn(`[Failover] model=${modelName} key=...${currentApiKey.slice(-4)} err=${err.message}`);
        lastError = err;
      }
    }
  }

  // ── Handle total failure — return detailed error for debugging ──
  if (!rawText || rawText.trim().length < 10) {
    const errMsg = lastError ? lastError.message : 'All models & keys failed';
    console.error('[Generate] All attempts failed. Channel:', activeChannel, '| Error:', errMsg);
    console.error('[Generate] Keys used (last 4 chars):', keysToTry.map(k => '...' + k.slice(-4)));

    if (/API_KEY_INVALID|API key not valid|UNAUTHENTICATED/i.test(errMsg)) {
      return res.status(401).json({
        error: 'API_KEY_INVALID',
        detail: 'The Gemini API Key is invalid or malformed. Gemini keys must start with "AIza" and be obtained from https://aistudio.google.com/apikey',
        raw: errMsg
      });
    }
    if (/RESOURCE_EXHAUSTED|quota|429/i.test(errMsg)) {
      return res.status(429).json({
        error: 'QUOTA_EXHAUSTED',
        detail: 'Gemini API quota exhausted. Try again later or use your own API Key.',
        raw: errMsg
      });
    }
    return res.status(500).json({
      error: 'GENERATION_FAILED',
      detail: errMsg,  // ← Expose actual error message for frontend display & debugging
      channel: activeChannel
    });
  }

  // ── Defensive JSON parse & normalize ──
  try {
    const parsed     = extractJSON(rawText);
    const normalized = normalizeResponse(parsed, theme || 'dark');
    normalized.channel = activeChannel;
    return res.status(200).json(normalized);
  } catch (parseErr) {
    console.error('[JSON Parse] Failed. Raw snippet:', rawText.slice(0, 300));
    console.error('[JSON Parse] Error:', parseErr.message);
    return res.status(500).json({ error: 'AI_RESPONSE_FORMAT_ERROR' });
  }
}
