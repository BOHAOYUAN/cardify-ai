
async function resolveUrlContentIfPresent(inputText, ctaValue) {
  const textToScan = ((inputText || '') + ' ' + (ctaValue || '')).trim();
  if (!textToScan) return inputText || '';
  const urlMatch = textToScan.match(/(https?:\/\/[^\s]+)/);
  if (!urlMatch) return inputText;

  const targetUrl = urlMatch[1].trim();

  // 1. YouTube Video URL via oEmbed
  if (targetUrl.includes('youtube.com/') || targetUrl.includes('youtu.be/')) {
    try {
      const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(targetUrl)}&format=json`;
      const res = await fetch(oembedUrl);
      if (res.ok) {
        const data = await res.json();
        const title  = data.title || 'YouTube Video';
        const author = data.author_name || 'YouTube Channel';
        return `[EXACT YOUTUBE VIDEO TITLE]: ${title}\n[CHANNEL AUTHOR]: ${author}\n\n[USER INPUT]: ${inputText}\n\nCRITICAL INSTRUCTION FOR AI: The user provided a YouTube video titled "${title}". You MUST strictly generate slides specifically analyzing and explaining the exact video title subject ("${title}"). Do NOT generate generic efficiency or growth hacking slides.`;
      }
    } catch (_) {}
  }

  // 2. Web Article / Blog URL via Jina Reader Engine (High-Precision Web Scraper)
  try {
    const jinaUrl = 'https://r.jina.ai/' + targetUrl;
    const res = await fetch(jinaUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
    if (res.ok) {
      const markdown = await res.text();
      if (markdown && markdown.length > 200 && !markdown.includes('Target URL returned error')) {
        const titleMatch = markdown.match(/Title:\s*(.+)/i);
        const title = titleMatch ? titleMatch[1].trim() : 'Web Article';
        const slicedContent = markdown.slice(0, 12000);
        return `[ARTICLE TITLE]: ${title}\n[SOURCE URL]: ${targetUrl}\n\n[EXTRACTED ARTICLE CONTENT]:\n${slicedContent}\n\nCRITICAL INSTRUCTION FOR AI: You MUST strictly generate slides specifically analyzing and summarizing the article topic "${title}". All key points, cards, quotes, and takeaways MUST be directly derived from this extracted content. Do NOT generate generic templates.`;
      }
    }
  } catch (_) {}

  // 3. Fallback Raw HTML Parser
  try {
    const res = await fetch(targetUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
    if (res.ok) {
      const html = await res.text();
      const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
      const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : 'Web Article';
      const cleanHtml = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
      const plainText = cleanHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 10000);
      if (plainText.length > 80) {
        return `[ARTICLE TITLE]: ${title}\n[SOURCE URL]: ${targetUrl}\n\n[ARTICLE CONTENT]:\n${plainText}\n\nCRITICAL INSTRUCTION FOR AI: You MUST strictly generate slides specifically analyzing and summarizing the article topic "${title}".`;
      }
    }
  } catch (_) {}

  return inputText;
}

// /api/generate.js — Cardify AI v3.4 Resilient Multi-Provider API Gateway
// Failover Chain: Custom Key -> Groq Llama-3 70B -> Gemini 1.5 Flash REST -> Robust Fallback JSON

const rateLimitStore = new Map();
const DAILY_FREE_LIMIT = 10;

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
  auto: 'Auto Detect (Preserve Native Input Language)',
  en: 'en-US',
  zh: 'zh-CN',
  hi: 'hi-IN',
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

  linkedin: `### PLATFORM-SPECIFIC STYLE INJECTOR (LinkedIn Carousel & Lead Gen Engine)
- Style: B2B Thought Leadership & Executive Visual Carousel.
- Structure Rules: 
  * Page 1 (Hook): Scroll-stopping bold claim, high-ROI metric or curiosity gap.
  * Body Pages: 5 core actionable insights, step-by-step SOP, or versus comparisons (old way vs new way).
  * FINAL PAGE (Lead Magnet CTA): MUST contain a high-converting B2B lead generation call to action!
    - Subtitle: "🎁 EXCLUSIVE BONUS SOP"
    - Title: "Want the Complete Step-by-Step Guide PDF?"
    - Takeaway Quote: "Comment 'GROWTH' below and I'll DM you the full unredacted PDF guide!"
- Tone: Authoritative, executive, highly valuable, ROI-driven.`,

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
- VIRAL HOOK REWRITING: Do NOT output plain summary headlines. Rewrite raw titles into scroll-stopping social hooks with curiosity gaps and bold ROI claims (e.g. "Why 99% of Indie Hackers Quit at Day 10 (And the 3 Rules to Reach $10k ARR)").
- DIAGRAM LAYOUT SELECTION: Assign 'diagram_type' to 'versus' for mistake vs solution comparisons, 'flow' for step-by-step execution, or 'matrix' for data highlights.
- Generate a dynamic CSS Theme based on the user's requested style/prompt.
- STRICT TOPIC ANCHORING & ACCURACY: The generated carousel deck MUST strictly be anchored to the actual subject matter of the input content (e.g., if the input is about "Public Speaking / Speech without Script vs Scripted Speech", the generated slides MUST specifically discuss public speaking and script vs no script techniques). NEVER fallback to generic business/marketing buzzwords like "Growth Hacking" or "Traditional Marketing" unless the input text is explicitly about growth hacking.
- CREATIVE EXPANSION & URL REPURPOSING: If the input text is a URL, blog article or video transcript, extract the 5 most valuable insights and construct a structured viral deck.
- RICH CONTENT DENSITY: Every slide MUST have rich, deep, insightful content. Always include 2-3 detailed bullet points with concrete explanations ('point_desc'), specific examples, data points, or step-by-step guidance rather than sparse 1-line cards.
- FINAL SLIDE LEAD MAGNET RULE: The final slide of every carousel deck MUST be a Lead Magnet CTA encouraging the reader to comment a keyword (e.g. "GROWTH" or "TEMPLATE") to get the full PDF in their DMs.

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
  "linkedin_post": "Professional LinkedIn post ending with: \n\n📌 Want the interactive checklist & PDF template? Check the 1st comment below! 👇",
  "linkedin_comment": "👉 Here is the interactive H5 deck & 1-Click SOP: [LIVE_LINK]\n\n💬 Comment 'GROWTH' below and I'll DM you the unredacted PDF!",
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

  // 4. Default Fallback Public Keys (Multiple Redundant High-Quota Keys)
  keysToTry.push({ type: 'groq_default_1', key: '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' });
  keysToTry.push({ type: 'groq_default_2', key: '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' });

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

  const { input_text, slide_count, cta_value, target_style, target_lang, mode_preference, platform, preset_hook, custom_theme_prompt, userApiKey, licenseKey } = req.body || {};
  const resolvedInputText = await resolveUrlContentIfPresent(input_text, cta_value);
  const targetSlideCount = Math.min(40, Math.max(3, Number(slide_count) || 5));

  if (!input_text || typeof input_text !== 'string' || resolvedInputText.trim().length < 2) {
    return res.status(400).json({ error: 'INPUT_TOO_SHORT', message: 'Input text must be at least 2 characters long.' });
  }

  const ip = getClientIp(req);
  let keyUsedType = 'free';

  const customHeaderKey = req.headers['x-custom-key'];
  const effectiveUserKey = (typeof userApiKey === 'string' && userApiKey.trim().length > 10) ? userApiKey.trim() : (customHeaderKey || '');

  if (effectiveUserKey) {
    keyUsedType = 'user';
  } else if (typeof licenseKey === 'string' && licenseKey.trim().length >= 5) {
    keyUsedType = 'official_vip';
  } else {
    const limitCheck = checkDailyIpLimit(ip);
    if (!limitCheck.allowed) {
      return res.status(429).json({
        error: 'DAILY_LIMIT_EXCEEDED',
        message: 'Daily free limit reached (10/10). Please upgrade to Pro or provide your own Groq/Gemini API Key.',
        key_used: 'none'
      });
    }
    keyUsedType = 'free';
  }

  const isAutoDetect = (!target_lang || target_lang === 'auto');
  const targetLangCode = isAutoDetect 
    ? 'Auto Detect (MUST match native language of user input text)' 
    : (LANG_NAMES[target_lang] || 'en-US');

  const modeVal = mode_preference === 'single' ? 'single' : 'carousel';
  const platformKey = platform || 'linkedin';
  const langRule = isAutoDetect 
    ? 'CRITICAL LANGUAGE RULE: Output MUST strictly match and preserve the native language of the user input content (e.g. if input text is Chinese, output Chinese; if input text is English, output English). Do NOT translate.' 
    : `CRITICAL LANGUAGE RULE: Output MUST strictly translate, adapt, and localize content into ${targetLangCode} with zero language mix.`;

  const platformStyle = PLATFORM_INJECTORS[platformKey] || PLATFORM_INJECTORS.linkedin;
  
  const finalSystemPrompt = `${BASE_MASTER_PROMPT}

### DYNAMIC USER INJECTIONS & SLIDE COUNT TARGET
- TOTAL SLIDES TARGET: You MUST generate exactly ${targetSlideCount} slides in total.
- CHAPTER NARRATIVE STRUCTURE: Organize slides into progressive Chapters (Chapter 1: The Hook, Chapter 2: The Trap, Chapter 3: Breakthrough, Chapter 4: Action SOP, Chapter 5: Take Action Lead Magnet CTA). Each slide's 'subtitle' MUST contain the chapter tag (e.g., "Chapter 1: The Hook" or "Chapter 2: Core Trap").
- TARGET LANGUAGE: ${targetLangCode}
- PRESET HOOK STRATEGY: ${preset_hook || 'High Impact Viral Hook'}
- VISUAL THEME DIRECTIVE: ${custom_theme_prompt || target_style || 'Luxury Dark Gold Cyberpunk'}

${langRule}

${platformStyle}`;

  let userPrompt = `[Target Language Mode]: ${targetLangCode}\n[Mode Preference]: ${modeVal}\n[Platform]: ${platformKey}\n[Style Profile]: ${target_style || 'cyber'}`;
  if (custom_theme_prompt) userPrompt += `\n[Custom Prompt Visual Theme]: ${custom_theme_prompt}`;
  if (preset_hook) userPrompt += `\n[Viral Hook Focus]: ${preset_hook}`;
  userPrompt += `\n[Raw Content]:\n${resolvedInputText.trim()}`;

  try {
    const { rawText, usedProvider } = await robustLLMFailover(userApiKey, finalSystemPrompt, userPrompt);
    const parsedData = extractJSON(rawText);

    // Normalize slides array if LLM returned alternate key names
    if (!Array.isArray(parsedData.slides)) {
      if (Array.isArray(parsedData.cards)) parsedData.slides = parsedData.cards;
      else if (Array.isArray(parsedData.items)) parsedData.slides = parsedData.items;
      else if (Array.isArray(parsedData.pages)) parsedData.slides = parsedData.pages;
      else parsedData.slides = [];
    }

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
