// /api/generate.js
// Vercel Serverless Function — Cardify AI (Powered by Google Gemini)
// POST /api/generate { text: string, theme?: string, style?: string, userApiKey?: string, licenseKey?: string, lang?: string }
// Returns: CardPackageResponse JSON with channel tag ("custom_key" | "vip_official_key" | "free_tier")

import { GoogleGenerativeAI } from '@google/generative-ai';

// ── Rate limiting (in-memory, resets on cold start) ──
const rateLimitStore = new Map();
const RATE_LIMIT = 10; // IP burst limit
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

// ── Style-based System Prompts ──
const STYLE_PROMPTS = {
  default: `You are a world-class content architect. Distill the input into 3-5 beautiful knowledge cards.

Return ONLY valid JSON (no markdown fences, no extra text):
{
  "theme_color": "dark",
  "total_cards": 3,
  "cards": [
    { "card_id": 1, "type": "header", "title": "Punchy title (max 12 words)", "subtitle": "Supporting context", "gold_quote": "Most viral-worthy quote from the text", "key_takeaways": ["Insight 1", "Insight 2", "Insight 3"] },
    { "card_id": 2, "type": "metrics", "title": "Key Data & Metrics", "metrics": [{"label": "Name", "value": "Number", "desc": "Brief note"}] },
    { "card_id": 3, "type": "action", "title": "Action Plan", "steps": ["Step 1", "Step 2", "Pitfall to avoid"] }
  ]
}
Rules: 3-5 cards, start with header, match input language, pick theme_color from dark/light/cyber/glass, output RAW JSON only.`,

  xiaohongshu: `你是一位顶级小红书爆款内容策划师，擅长将任何内容改写为高传播性的小红书风格知识卡片包。
仅返回符合以下格式的原生 JSON（不要 markdown 标记）：
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

Return ONLY raw JSON (no markdown):
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
Rules: Professional tone, data-heavy, match input language, raw JSON only.`,

  outline: `You are an expert content strategist and video scriptwriter. Break down the input into a clear, hierarchical outline perfect for long-form video scripts or article structures.

Return ONLY raw JSON (no markdown):
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
Rules: Clear hierarchy, outline-focused, match input language, raw JSON only.`
};

// ── Input validation ──
function validateInput(body) {
  if (!body || typeof body !== 'object') return 'Request body must be JSON';
  if (!body.text || typeof body.text !== 'string') return 'Field "text" is required';
  if (body.text.trim().length < 50) return 'Text is too short (min 50 characters)';
  if (body.text.length > 15000) return 'Text too long (max 15,000 characters)';
  return null;
}

// ── JSON extraction ──
function extractJSON(raw) {
  const trimmed = raw.trim();
  try { return JSON.parse(trimmed); } catch (_) {}

  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    try { return JSON.parse(fenceMatch[1].trim()); } catch (_) {}
  }

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

// ── System Environment Keys Collector ──
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
      const splitKeys = val.split(',').map(k => k.trim()).filter(k => k.length > 5);
      splitKeys.forEach(k => {
        if (!keys.includes(k)) keys.push(k);
      });
    }
  });

  return keys;
}

// ── Main Handler ──
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const validationError = validateInput(req.body);
  if (validationError) return res.status(400).json({ error: validationError });

  const { text, theme, style, userApiKey, licenseKey, lang } = req.body;

  // ══════════════════════════════════════════════════════════
  // STRICT 3-TIER KEY & AUTH PRIORITY SCHEDULER
  // ══════════════════════════════════════════════════════════
  const userKeyClean = userApiKey && typeof userApiKey === 'string' && userApiKey.trim().length > 5 ? userApiKey.trim() : null;
  const isVipMember = licenseKey && typeof licenseKey === 'string' && licenseKey.trim().length >= 5;

  let activeChannel = 'free_tier';
  let keysToTry = [];

  if (userKeyClean) {
    // ✦ Tier 1: Custom User API Key (Forced Custom Channel, Bypass Rate Limits)
    activeChannel = 'custom_key';
    keysToTry = [userKeyClean];
  } else if (isVipMember) {
    // ✦ Tier 2: VIP License Member (VIP Channel, Bypass Rate Limits, Official Keys Pool)
    activeChannel = 'vip_official_key';
    keysToTry = getSystemEnvKeys();
  } else {
    // ✦ Tier 3: Free Tier User (Free Channel, Rate Limited)
    activeChannel = 'free_tier';
    const ip = getRateKey(req);
    if (isRateLimited(ip)) {
      return res.status(429).json({
        error: 'DAILY_LIMIT_EXCEEDED',
        detail: 'Today's daily free limit reached. Please upgrade to VIP or enter your own Gemini API Key.'
      });
    }
    keysToTry = getSystemEnvKeys();
  }

  if (keysToTry.length === 0) {
    console.error(`[Auth Error] No API key available for channel "${activeChannel}".`);
    return res.status(500).json({ error: 'Server configuration error: No Gemini API Key configured for this channel' });
  }

  const stylePrompt = STYLE_PROMPTS[style] || STYLE_PROMPTS.default;
  const targetLang = LANG_MAP[lang] || 'English';

  const sysInstruction = `${stylePrompt}

SERIES & CHAPTER AWARENESS RULE:
1. Analyze if the input text belongs to a chapter, section, or part of a larger book/report (e.g., contains "Part 1", "Chapter 1", "第一章", "上集", "第1节", or is an excerpt of a longer work).
2. If a chapter or part is identified (or if user pastes a multi-part excerpt), prefix the Card 1 (Header card) title with a series/chapter tag, e.g. "[ Part 1 ] Title" or "[ 第一章 ] 标题" or "[ 01/连载 ] 标题". If no specific number is found but it appears to be a chapter, use "[ 01/连载 ] Title".
3. Keep the total cards count strictly between 3 to 5 cards per request. Output concise, high-value cards without exceeding JSON length limits.

CRITICAL LANGUAGE INSTRUCTION: You MUST output all text fields (title, subtitle, gold_quote, key_takeaways, metrics labels/desc, action steps) strictly in ${targetLang}.`;

  const userPrompt = `Target Output Language: ${targetLang}\nVisual Theme: "${theme || 'dark'}"\n\nGenerate knowledge cards for the following input text:\n\n${text.trim()}`;

  const primaryModel = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  const fallbackModel = 'gemini-1.5-flash';

  let rawText = '';
  let lastError = null;

  // ══════════════════════════════════════════════════════════
  // MULTI-KEY & MULTI-MODEL FAILOVER LOOP
  // ══════════════════════════════════════════════════════════
  for (const currentApiKey of keysToTry) {
    const genAI = new GoogleGenerativeAI(currentApiKey);

    // 1. Try Primary Model (gemini-2.0-flash)
    try {
      const model = genAI.getGenerativeModel({
        model: primaryModel,
        generationConfig: { temperature: 0.75, maxOutputTokens: 2048, responseMimeType: 'application/json' },
        systemInstruction: sysInstruction,
      });
      const result = await model.generateContent(userPrompt);
      rawText = result.response.text();
      if (rawText) break;
    } catch (primaryErr) {
      console.warn(`[Key Failover] Primary model (${primaryModel}) failed with key ...${currentApiKey.slice(-4)}: ${primaryErr.message}`);
      lastError = primaryErr;

      // 2. Try Fallback Model (gemini-1.5-flash) with same key
      try {
        const model = genAI.getGenerativeModel({
          model: fallbackModel,
          generationConfig: { temperature: 0.75, maxOutputTokens: 2048, responseMimeType: 'application/json' },
          systemInstruction: sysInstruction,
        });
        const result = await model.generateContent(userPrompt);
        rawText = result.response.text();
        if (rawText) break;
      } catch (fallbackErr) {
        console.warn(`[Key Failover] Fallback model (${fallbackModel}) failed with key ...${currentApiKey.slice(-4)}: ${fallbackErr.message}`);
        lastError = fallbackErr;
      }
    }
  }

  if (!rawText) {
    const errMsg = lastError ? lastError.message : 'All API Keys & Model attempts failed';
    if (errMsg.includes('API_KEY_INVALID') || errMsg.includes('API key not valid')) {
      return res.status(401).json({ error: 'Gemini API Key 无效，请检查配置或输入有效的 Key' });
    }
    if (errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('429')) {
      return res.status(429).json({ error: 'Gemini API 额度不足/请求过于频繁，请稍后重试或使用个人 Key' });
    }
    return res.status(500).json({ error: `Gemini API 调用失败: ${errMsg}` });
  }

  try {
    const parsed = extractJSON(rawText);
    const normalized = normalizeResponse(parsed, theme || 'dark');
    normalized.channel = activeChannel; // Attach authenticated channel tag!
    return res.status(200).json(normalized);
  } catch (parseErr) {
    console.error('JSON Parse error:', parseErr);
    return res.status(500).json({ error: `卡片数据解析失败: ${parseErr.message}` });
  }
}
