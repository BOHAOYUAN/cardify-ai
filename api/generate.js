// /api/generate.js — Cardify AI v3.4 Resilient Multi-Provider API Gateway
// Failover Chain: Custom Key -> Groq Llama-3 70B -> Gemini 1.5 Flash REST -> Robust Fallback JSON

const rateLimitStore = new Map();
const DAILY_FREE_LIMIT = 3;

function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.socket?.remoteAddress
    || '127.0.0.1';
}

function checkDailyIpLimit(ip) {
  const today = new Date().toISOString().slice(0, 10);
  const record = rateLimitStore.get(ip);
  if (!record || record.dateStr !== today) {
    rateLimitStore.set(ip, { count: 1, dateStr: today });
    return { allowed: true, count: 1, remaining: DAILY_FREE_LIMIT - 1 };
  }
  if (record.count >= DAILY_FREE_LIMIT) {
    return { allowed: false, count: record.count, remaining: 0 };
  }
  record.count += 1;
  rateLimitStore.set(ip, record);
  return { allowed: true, count: record.count, remaining: DAILY_FREE_LIMIT - record.count };
}

function getIpRemaining(ip) {
  const today = new Date().toISOString().slice(0, 10);
  const record = rateLimitStore.get(ip);
  if (!record || record.dateStr !== today) return DAILY_FREE_LIMIT;
  return Math.max(0, DAILY_FREE_LIMIT - record.count);
}

const LANG_NAMES = {
  en: 'en-US',
  zh: 'zh-CN',
  es: 'es-ES',
  pt: 'pt-BR',
  ru: 'ru-RU',
  ja: 'ja-JP',
  ko: 'ko-KR',
  fr: 'fr-FR',
  de: 'de-DE'
};

const PLATFORM_INJECTORS = {
  xiaohongshu: `### PLATFORM-SPECIFIC STYLE INJECTOR (Xiaohongshu)
- Style: Highly engaging, emotional hooks, punchy contrast, high value-density.
- Tone: Warm, actionable, empathetic, uses visual keywords & emojis.
- Headline Rules: Must use curiosity gap or benefit-driven numbers (e.g., "建议收藏", "3个避坑指南").`,

  wechat: `### PLATFORM-SPECIFIC STYLE INJECTOR (WeChat)
- Style: Deep insights, structured key takeaways, elegant quotes.
- Tone: Professional, authoritative, engaging.`,

  zhihu: `### PLATFORM-SPECIFIC STYLE INJECTOR (Zhihu/Jike)
- Style: Hardcore tech breakdown, data ROI metrics, contrarian insights.`,

  bilibili: `### PLATFORM-SPECIFIC STYLE INJECTOR (Bilibili/Video Script)
- Style: Hook -> Problem -> Solution -> Call to Action storyboard format.`,

  linkedin: `### PLATFORM-SPECIFIC STYLE INJECTOR (LinkedIn)
- Style: Professional, concise, data-driven, thought leadership.
- Tone: Authoritative, polished, action-oriented.
- Headline Rules: Focus on ROI, career growth, or industry paradigm shift.`,

  twitter: `### PLATFORM-SPECIFIC STYLE INJECTOR (Twitter/X)
- Style: Punchy, contrarian claims, high-retweet potential.
- Tone: Crisp, direct, razor-sharp insights.
- Headline Rules: Must hook scrolling users immediately in <10 words.`,

  instagram: `### PLATFORM-SPECIFIC STYLE INJECTOR (Instagram)
- Style: Visual-first, slide-by-slide progression, high save-rate.
- Tone: Aspirational, structured, inspiring.
- Headline Rules: Visually arresting titles with strong value promise.`,

  youtube_script: `### PLATFORM-SPECIFIC STYLE INJECTOR (YouTube Shorts Script)
- Style: Hook -> Problem -> Solution -> CTA storyboard format.`
};

const BASE_MASTER_PROMPT = `You are a World-Class Visual Content Architect and Viral Growth Specialist.
Your task is to take raw user text and output ONLY valid JSON according to the schema.

### EXECUTION MODE & INFOGRAPHIC VISUAL STRUCTURING
- Extract a scroll-stopping Viral Hook Title for Slide 1.
- Structure content into Infographic Visual Diagrams (e.g., 'versus' comparison, 'flow' step-by-step, or 'matrix' takeaways).
- Generate a dynamic CSS Theme based on the user's requested style/prompt.

### STRICT OUTPUT RULES
1. Output MUST be ONLY valid JSON.
2. Do NOT write markdown codeblock wrappers like \`\`\`json or \`\`\`. Output raw JSON directly.
3. Language MUST strictly match the specified Target Language with ZERO mixed languages.
4. Do NOT include any conversational filler.

### JSON SCHEMA
{
  "language": "string",
  "mode": "string ('single' | 'carousel')",
  "total_slides": 3,
  "custom_css_theme": {
    "themeName": "string",
    "background": "string (CSS gradient or color, e.g., 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)')",
    "textColor": "string (CSS hex, e.g., '#f8fafc')",
    "titleColor": "string (CSS hex, e.g., '#00ffcc')",
    "subtitleColor": "string (CSS hex, e.g., '#ff007f')",
    "cardBorder": "string (CSS border, e.g., '1px solid rgba(0, 255, 204, 0.4)')",
    "boxShadow": "string (CSS box-shadow)",
    "metricBg": "string (CSS rgba background)",
    "quoteBg": "string (CSS rgba background)",
    "quoteBorder": "string (CSS rgba border)"
  },
  "slides": [
    {
      "slide_index": 1,
      "slide_type": "string ('hook' | 'content' | 'action')",
      "diagram_type": "string ('matrix' | 'versus' | 'flow')",
      "title": "string (Scroll-stopping headline for this platform)",
      "subtitle": "string (Context or transition)",
      "key_metric": {
        "value": "string (Optional bold number, e.g., '10x', '$10K+', '85%')",
        "label": "string (Short description of the impact)"
      },
      "versus_comparison": {
        "old_way": "string (Common mistake or old paradigm)",
        "new_way": "string (Viral breakthrough approach)"
      },
      "bullet_points": [
        {
          "point_title": "string",
          "point_desc": "string"
        }
      ],
      "takeaway_quote": "string (Shareable gold nugget sentence)"
    }
  ],
  "tags": ["string"],
  "footer_text": "string",
  "twitter_thread": ["Tweet 1", "Tweet 2", "Tweet 3"],
  "linkedin_post": "Professional LinkedIn post...",
  "xiaohongshu_post": { "title": "爆款标题", "content": "爆款内容" },
  "instagram_caption": "Instagram caption..."
}`;

function extractJSON(raw) {
  if (!raw || typeof raw !== 'string') throw new Error('AI returned an empty response.');
  let text = raw.trim();

  try { return JSON.parse(text); } catch (_) {}

  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    try { return JSON.parse(fenceMatch[1].trim()); } catch (_) {}
  }

  const objStart = text.indexOf('{');
  const objEnd = text.lastIndexOf('}');
  if (objStart !== -1 && objEnd > objStart) {
    try { return JSON.parse(text.slice(objStart, objEnd + 1)); } catch (_) {}
  }

  const cleaned = text.replace(/[\u0000-\u001F\u007F]/g, ' ');
  const cs = cleaned.indexOf('{');
  const ce = cleaned.lastIndexOf('}');
  if (cs !== -1 && ce > cs) {
    try { return JSON.parse(cleaned.slice(cs, ce + 1)); } catch (_) {}
  }

  throw new Error('Failed to parse AI structured response as valid JSON.');
}

async function callGroq(apiKey, sysInstruction, userPrompt) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey.trim()}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: sysInstruction },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' }
    })
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Groq API Error (${res.status}): ${errText.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

async function callGeminiRest(apiKey, sysInstruction, userPrompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey.trim()}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: sysInstruction }] },
      contents: [{ parts: [{ text: userPrompt }] }],
      generationConfig: {
        temperature: 0.7,
        responseMimeType: 'application/json'
      }
    })
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Gemini API Error (${res.status}): ${errText.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

// Multi-tier API Key Failover Provider Strategy
async function robustLLMFailover(userKey, sysInstruction, userPrompt) {
  const keysToTry = [];

  // 1. User-supplied Key
  if (userKey && typeof userKey === 'string' && userKey.trim().length > 10) {
    keysToTry.push({ type: 'user', key: userKey.trim() });
  }

  // 2. Groq Env Keys
  if (process.env.GROQ_API_KEY) {
    keysToTry.push({ type: 'groq_env', key: process.env.GROQ_API_KEY.trim() });
  }

  // 3. Gemini Env Keys
  if (process.env.GEMINI_API_KEY) {
    keysToTry.push({ type: 'gemini_env', key: process.env.GEMINI_API_KEY.trim() });
  }

  // 4. Default Fallback Public Keys
  keysToTry.push({ type: 'groq_default', key: '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' });

  let lastError = null;

  for (const item of keysToTry) {
    try {
      let rawText = '';
      if (item.key.startsWith('gsk_')) {
        rawText = await callGroq(item.key, sysInstruction, userPrompt);
      } else if (item.key.startsWith('AIza')) {
        rawText = await callGeminiRest(item.key, sysInstruction, userPrompt);
      } else {
        try {
          rawText = await callGroq(item.key, sysInstruction, userPrompt);
        } catch (e) {
          rawText = await callGeminiRest(item.key, sysInstruction, userPrompt);
        }
      }

      if (rawText && rawText.trim().length > 0) {
        return { rawText, usedProvider: item.type };
      }
    } catch (e) {
      console.warn(`[LLM Failover] Provider ${item.type} failed:`, e.message);
      lastError = e;
    }
  }

  throw lastError || new Error('All AI LLM providers failed.');
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    const ip = getClientIp(req);
    return res.status(200).json({ remaining: getIpRemaining(ip), limit: DAILY_FREE_LIMIT });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }

  const { input_text, target_style, target_lang, mode_preference, platform, preset_hook, custom_theme_prompt, userApiKey, licenseKey } = req.body || {};

  if (!input_text || typeof input_text !== 'string' || input_text.trim().length < 5) {
    return res.status(400).json({ error: 'INPUT_TOO_SHORT', message: 'Input text must be at least 5 characters long.' });
  }

  const ip = getClientIp(req);
  let keyUsedType = 'free';

  if (typeof userApiKey === 'string' && userApiKey.trim().length > 10) {
    keyUsedType = 'user';
  } else if (typeof licenseKey === 'string' && licenseKey.trim().length >= 5) {
    keyUsedType = 'official_vip';
  } else {
    const limitCheck = checkDailyIpLimit(ip);
    if (!limitCheck.allowed) {
      return res.status(429).json({
        error: 'DAILY_LIMIT_EXCEEDED',
        message: 'Daily free limit reached (3/3). Please upgrade to Pro or provide your own Groq/Gemini API Key.',
        key_used: 'none'
      });
    }
    keyUsedType = 'free';
  }

  const targetLangCode = LANG_NAMES[target_lang] || 'en-US';
  const modeVal = mode_preference === 'single' ? 'single' : 'carousel';
  const platformKey = platform || 'twitter';
  const platformInjector = PLATFORM_INJECTORS[platformKey] || PLATFORM_INJECTORS.twitter;

  const finalSystemPrompt = `${BASE_MASTER_PROMPT}\n\n[TARGET LANGUAGE]: ${targetLangCode}\n[TARGET PLATFORM]: ${platformKey}\n\n${platformInjector}`;

  let userPrompt = `[Target Language]: ${targetLangCode}\n[Mode Preference]: ${modeVal}\n[Platform]: ${platformKey}\n[Style Profile]: ${target_style || 'cyber'}`;
  if (custom_theme_prompt) userPrompt += `\n[Custom Prompt Visual Theme]: ${custom_theme_prompt}`;
  if (preset_hook) userPrompt += `\n[Viral Hook Focus]: ${preset_hook}`;
  userPrompt += `\n[Raw Content]:\n${input_text.trim()}`;

  try {
    const { rawText, usedProvider } = await robustLLMFailover(userApiKey, finalSystemPrompt, userPrompt);
    const parsedData = extractJSON(rawText);

    return res.status(200).json({
      success: true,
      key_used: keyUsedType,
      provider: usedProvider,
      remaining_free: keyUsedType === 'free' ? getIpRemaining(ip) : 999,
      data: parsedData
    });
  } catch (err) {
    console.error('[Cardify AI Backend Error]', err);
    return res.status(500).json({
      error: 'AI_GENERATION_FAILED',
      message: err.message || 'AI generation failed. Please check your API key or try again.',
      key_used: keyUsedType
    });
  }
}
