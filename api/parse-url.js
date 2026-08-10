// /api/parse-url.js — Cardify AI URL & YouTube Content Extractor Engine
// Parses Web Articles & YouTube Videos into clean structured Markdown for 1-click Carousel Repurposing

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }

  const { url } = req.body || {};

  if (!url || typeof url !== 'string' || !url.trim().startsWith('http')) {
    return res.status(400).json({ error: 'INVALID_URL', message: 'Please provide a valid HTTP/HTTPS URL.' });
  }

  const cleanUrl = url.trim();

  try {
    // 1. YouTube Video URL Extractor
    if (cleanUrl.includes('youtube.com/') || cleanUrl.includes('youtu.be/')) {
      const parsedData = await extractYouTubeContent(cleanUrl);
      return res.status(200).json({ success: true, type: 'youtube', ...parsedData });
    }

    // 2. Web Article / Blog URL Extractor
    const parsedArticle = await extractWebArticleContent(cleanUrl);
    return res.status(200).json({ success: true, type: 'article', ...parsedArticle });

  } catch (err) {
    console.error('[API Parse URL Error]:', err.message);
    return res.status(200).json({
      success: false,
      fallback_to_text: true,
      error: err.message || 'Protected site',
      message: 'Looks like this site is protected by a firewall. Paste the text/Markdown directly and we will handle the magic!'
    });
  }
}

// Helper: Extract YouTube Video Title & Subtitle Track
async function extractYouTubeContent(targetUrl) {
  let videoId = '';
  if (targetUrl.includes('youtu.be/')) {
    videoId = targetUrl.split('youtu.be/')[1]?.split('?')[0]?.split('#')[0];
  } else {
    const match = targetUrl.match(/[?&]v=([^&]+)/);
    if (match) videoId = match[1];
  }

  if (!videoId) throw new Error('Invalid YouTube URL');

  const pageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9'
    }
  });

  if (!pageRes.ok) throw new Error('YouTube video page unreachable');

  const html = await pageRes.text();
  const titleMatch = html.match(/<title>(.*?)<\/title>/);
  let title = titleMatch ? titleMatch[1].replace('- YouTube', '').trim() : 'YouTube Video Summary';

  // Extract meta description & og:description
  const descMatch = html.match(/meta name="description" content="(.*?)"/) || html.match(/meta property="og:description" content="(.*?)"/);
  let description = descMatch ? descMatch[1] : '';

  // Deep extract keywords & shortDescription from YouTube JSON data if available
  let keywordsStr = '';
  const keywordsMatch = html.match(/"keywords":s*([.*?])/);
  if (keywordsMatch) {
    try {
      const kwArr = JSON.parse(keywordsMatch[1]);
      if (Array.isArray(kwArr)) keywordsStr = kwArr.slice(0, 15).join(', ');
    } catch (_) {}
  }

  const shortDescMatch = html.match(/"shortDescription":s*"(.*?)"/);
  if (shortDescMatch && !description) {
    description = shortDescMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
  }

  // Extract captions JSON track if available
  let transcriptText = '';
  const captionMatch = html.match(/"captionTracks":\s*(\[.*?\])/);
  if (captionMatch) {
    try {
      const tracks = JSON.parse(captionMatch[1]);
      if (tracks && tracks.length > 0) {
        const trackUrl = tracks[0].baseUrl;
        const xmlRes = await fetch(trackUrl);
        if (xmlRes.ok) {
          const xml = await xmlRes.text();
          transcriptText = xml
            .replace(/<text[^>]*>/g, ' ')
            .replace(/<\/text>/g, '\n')
            .replace(/<[^>]+>/g, '')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&#39;/g, "'")
            .replace(/&quot;/g, '"')
            .replace(/\s+/g, ' ')
            .trim();
        }
      }
    } catch (_) {}
  }

  const contextBody = transcriptText 
    ? `[FULL VIDEO TRANSCRIPT]:\n${transcriptText}`
    : `[VIDEO DESCRIPTION & CHAPTERS]:\n${description || title}\n\n[KEY TOPICS & TAGS]:\n${keywordsStr || title}`;

  const fullContent = `[SPECIFIC VIDEO TOPIC & TITLE]: ${title}\n\n${contextBody}\n\nCRITICAL INSTRUCTION FOR AI: You MUST strictly generate slides focused 100% on the exact subject matter of this video title ("${title}"). Do NOT hallucinate generic business buzzwords like "Growth Hacking" unless the video is specifically about growth hacking.`;

  return {
    title,
    text: fullContent.slice(0, 15000),
    word_count: fullContent.split(/\s+/).length
  };
}

// Helper: Extract Web Article Content
async function extractWebArticleContent(targetUrl) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  const response = await fetch(targetUrl, {
    signal: controller.signal,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    }
  });

  clearTimeout(timeoutId);

  if (!response.ok) {
    throw new Error(`HTTP Error ${response.status}: Unable to fetch webpage`);
  }

  const html = await response.text();

  // Extract Page Title
  const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : 'Web Article';

  // Strip script, style, nav, footer, header tags
  let cleanedHtml = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, '')
    .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, '')
    .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, '');

  // Extract headings and paragraphs
  const textBlocks = [];
  const regex = /<(h1|h2|h3|p)[^>]*>(.*?)<\/\1>/gi;
  let match;
  while ((match = regex.exec(cleanedHtml)) !== null) {
    const txt = match[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    if (txt.length > 20) {
      textBlocks.push(txt);
    }
  }

  let extractedText = textBlocks.join('\n\n');

  if (!extractedText || extractedText.length < 100) {
    // Fallback body text extraction
    extractedText = cleanedHtml
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  if (extractedText.length < 100) {
    throw new Error('Could not extract readable article text');
  }

  const fullPayload = `[ARTICLE TITLE]: ${title}\n\n[ARTICLE SOURCE URL]: ${targetUrl}\n\n[ARTICLE CONTENT]:\n${extractedText}`;

  return {
    title,
    text: fullPayload.slice(0, 15000),
    word_count: fullPayload.split(/\s+/).length
  };
}
