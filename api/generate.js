// /api/generate.js — Cardify AI v2.4 Master Carousel Engine
// Multi-Provider Failover & Rich Carousel Storytelling System

const rateLimitStore = new Map();
const DAILY_FREE_LIMIT = 3; // 3 free runs per IP per day for free tier

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

const UNIFIED_MASTER_PROMPT = `You are a World-Class Visual Content Architect and Viral Growth Hacker.
Your mission is to analyze raw input text and transform it into high-converting, structured content for visual social media Carousel cards (Twitter/X, LinkedIn, Xiaohongshu, Instagram, Reddit).

### EXECUTION MODE & CAROUSEL CARDS LAW
- If mode is "single": Output 1 highly concentrated, high-density summary card.
- If mode is "carousel": You MUST output a 3 to 5 SLIDE SEQUENCE (never output just 1 slide for carousel!).
  * Slide 1 (Hook): Scroll-stopping title, punchy context, screenshot-worthy golden quote.
  * Slide 2 (Data & Impact): Key metrics (e.g., $10K+, 350%, 10x) and core insights breakdown.
  * Slide 3 (Action Playbook): Step 1, Step 2, Step 3 clear actionable playbook.
  * Slide 4/5 (Optional Conclusion & CTA): Gold quote summary and Call to Action.

### STRICT OUTPUT RULES
1. Output MUST be ONLY valid JSON.
2. Do NOT write markdown codeblock wrappers like \`\`\`json or \`\`\`. Output raw JSON directly.
3. Language MUST strictly match the specified Target Language with ZERO mixed languages.
4. Do NOT include any conversational filler.

### JSON SCHEMA
{
  "language": "string (e.g., 'zh-CN' or 'en-US')",
  "mode": "string ('single' | 'carousel')",
  "total_slides": 3,
  "slides": [
    {
      "slide_index": 1,
      "slide_type": "string ('hook' | 'content' | 'action')",
      "title": "string (High-converting, scroll-stopping title)",
      "subtitle": "string (Punchy hook or section header)",
      "key_metric": {
        "value": "string (Optional bold number, e.g., '10x', '$10K+', '350%')",
        "label": "string (Short description of the impact)"
      },
      "bullet_points": [
        {
          "point_title": "string (Bold keyphrase)",
          "point_desc": "string (Actionable takeaway, 1 clear sentence)"
        }
      ],
      "takeaway_quote": "string (Shareable gold nugget sentence)"
    }
  ],
  "tags": ["string (3 viral hashtags without #)"],
  "footer_text": "string (Brand callout, e.g., '⚡️ Cardify.ai')",
  "twitter_thread": [
    "1/ Hook Tweet stopping the scroll with high impact statement.",
    "2/ Core insight or key argument detailed breakdown.",
    "3/ Actionable takeaway or call to action."
  ],
  "linkedin_post": "Engaging professional headline\\n\\nContext & Hard Truths:\\n- Key Point A\\n- Key Point B\\n\\nStrategic Action Item.\\n\\nWhat are your thoughts on this? Drop a comment below! 👇",
  "xiaohongshu_post": {
    "title": "💥爆款标题（情绪调动+Emoji+干货）",
    "content": "✨引言共鸣痛点\\n\\n🔥核心干货拆解：\\n1️⃣ 第一点...\\n2️⃣ 第二点...\\n\\n💡总结建议\\n\\n#干货分享 #知识卡片 #AI工具"
  },
  "instagram_caption": "Visual-first scroll-stopping caption summarizing main value proposition.\\n\\nSwipe through cards for step-by-step breakdown! 👉\\n\\n#growth #productivity #business"
}

### CONTENT & LANGUAGE RULES
- Target Language Constraints:
  * 'zh-CN': ALL fields must be in natural, viral, high-converting Chinese.
  * 'en-US': ALL fields must be in fluent, polished, native English.
- Quality Standard:
  * Re-frame, polish, and elevate raw text into "Social Currency".
  * For Carousel mode: Ensure 3 to 5 rich slides are generated so users can swipe for full value!`;

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

async function executeLLMCall(apiKey, sysInstruction, userPrompt) {
  if (apiKey.startsWith('gsk_')) {
    return await callGroq(apiKey, sysInstruction, userPrompt);
  }
  if (apiKey.startsWith('AIza')) {
    return await callGeminiRest(apiKey, sysInstruction, userPrompt);
  }
  try {
    return await callGroq(apiKey, sysInstruction, userPrompt);
  } catch (e) {
    if (apiKey.startsWith('AIza')) return await callGeminiRest(apiKey, sysInstruction, userPrompt);
    throw e;
  }
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

  const { input_text, target_style, target_lang, mode_preference, userApiKey, licenseKey } = req.body || {};

  if (!input_text || typeof input_text !== 'string' || input_text.trim().length < 10) {
    return res.status(400).json({ error: 'INPUT_TOO_SHORT', message: 'Input text must be at least 10 characters long.' });
  }

  const ip = getClientIp(req);
  let activeKey = null;
  let keyUsedType = 'free';

  if (typeof userApiKey === 'string' && userApiKey.trim().length > 10) {
    activeKey = userApiKey.trim();
    keyUsedType = 'user';
  } else if (typeof licenseKey === 'string' && licenseKey.trim().length >= 5) {
    activeKey = process.env.GROQ_API_KEY || process.env.GEMINI_API_KEY || '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';
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
    activeKey = process.env.GROQ_API_KEY || process.env.GEMINI_API_KEY || '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';
    keyUsedType = 'free';
  }

  const targetLangCode = LANG_NAMES[target_lang] || 'zh-CN';
  const modeVal = mode_preference === 'single' ? 'single' : 'carousel';

  const userPrompt = `[Target Language]: ${targetLangCode}\n[Mode Preference]: ${modeVal}\n[Style Profile]: ${target_style || 'cyber'}\n[Raw Content]:\n${input_text.trim()}`;

  try {
    const rawAiOutput = await executeLLMCall(activeKey, UNIFIED_MASTER_PROMPT, userPrompt);
    const parsedData = extractJSON(rawAiOutput);

    return res.status(200).json({
      success: true,
      key_used: keyUsedType,
      remaining_free: keyUsedType === 'free' ? getIpRemaining(ip) : 999,
      data: parsedData
    });
  } catch (err) {
    console.error('[Cardify AI Backend Error]', err);
    return res.status(500).json({
      error: 'AI_GENERATION_FAILED',
      message: err.message || 'Failed to generate viral content suite.',
      key_used: keyUsedType
    });
  }
}
