// /api/parse-url.js — Cardify AI Bulletproof URL & YouTube oEmbed Content Extractor Engine

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }

  const { url } = req.body || {};

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'INVALID_URL', message: 'Please provide a valid URL.' });
  }

  // Extract first URL using Regex matching
  const urlMatch = url.match(/(https?:\/\/[^\s]+)/);
  if (!urlMatch) {
    return res.status(400).json({ error: 'NO_URL_FOUND', message: 'No valid HTTP/HTTPS URL found in input.' });
  }

  const cleanUrl = urlMatch[1].trim();

  try {
    // 1. YouTube Video URL Extractor via Official oEmbed API
    if (cleanUrl.includes('youtube.com/') || cleanUrl.includes('youtu.be/')) {
      const parsedData = await extractYouTubeContentViaOEmbed(cleanUrl);
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

// Helper: Extract YouTube Video metadata via 100% Reliable Official oEmbed API
async function extractYouTubeContentViaOEmbed(targetUrl) {
  const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(targetUrl)}&format=json`;
  
  const oembedRes = await fetch(oembedUrl);
  if (!oembedRes.ok) {
    throw new Error('Unable to fetch YouTube video metadata');
  }

  const oembedData = await oembedRes.json();
  const title = oembedData.title || 'YouTube Video';
  const author = oembedData.author_name || 'YouTube Channel';

  // Try extracting transcript XML as supplementary content
  let transcriptText = '';
  let videoId = '';
  if (targetUrl.includes('youtu.be/')) {
    videoId = targetUrl.split('youtu.be/')[1]?.split('?')[0]?.split('#')[0];
  } else {
    const match = targetUrl.match(/[?&]v=([^&]+)/);
    if (match) videoId = match[1];
  }

  if (videoId) {
    try {
      const pageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
      });
      if (pageRes.ok) {
        const html = await pageRes.text();
        const captionMatch = html.match(/"captionTracks":\s*(\[.*?\])/);
        if (captionMatch) {
          const tracks = JSON.parse(captionMatch[1]);
          if (tracks && tracks[0] && tracks[0].baseUrl) {
            const xmlRes = await fetch(tracks[0].baseUrl);
            if (xmlRes.ok) {
              const xml = await xmlRes.text();
              transcriptText = xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 8000);
            }
          }
        }
      }
    } catch (_) {}
  }

  const fullPayload = `[EXACT YOUTUBE VIDEO TITLE]: ${title}\n[CHANNEL AUTHOR]: ${author}\n\n${transcriptText ? '[VIDEO TRANSCRIPT]:\n' + transcriptText : '[PRIMARY VIDEO SUBJECT]:\n' + title}\n\nCRITICAL INSTRUCTION FOR AI: You MUST strictly generate slides specifically analyzing and explaining the exact video title subject ("${title}"). For example, if the video is about "公众表达与背稿优缺点", all slides MUST specifically discuss public speaking and script vs no-script techniques. Do NOT generate generic efficiency or growth hacking slides.`;

  return {
    title,
    author,
    text: fullPayload,
    word_count: fullPayload.split(/\s+/).length
  };
}

// Helper: Extract Web Article Content via Jina Reader Engine
async function extractWebArticleContent(targetUrl) {
  try {
    const jinaUrl = 'https://r.jina.ai/' + targetUrl;
    const res = await fetch(jinaUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (res.ok) {
      const markdown = await res.text();
      if (markdown && markdown.length > 200 && !markdown.includes('Target URL returned error')) {
        const titleMatch = markdown.match(/Title:\s*(.+)/i);
        const title = titleMatch ? titleMatch[1].trim() : 'Web Article';
        const fullPayload = `[ARTICLE TITLE]: ${title}\n\n[ARTICLE SOURCE URL]: ${targetUrl}\n\n[ARTICLE CONTENT]:\n${markdown.slice(0, 12000)}\n\nCRITICAL INSTRUCTION FOR AI: You MUST strictly generate slides specifically analyzing and explaining the exact article title subject ("${title}").`;
        return {
          title,
          text: fullPayload,
          word_count: fullPayload.split(/\s+/).length
        };
      }
    }
  } catch (_) {}

  // Fallback: Direct HTML fetch
  const response = await fetch(targetUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP Error ${response.status}: Unable to fetch webpage`);
  }

  const html = await response.text();
  const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : 'Web Article';

  const cleanHtml = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

  const extractedText = cleanHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 10000);
  if (extractedText.length < 50) {
    throw new Error('Could not extract readable article text');
  }

  const fullPayload = `[ARTICLE TITLE]: ${title}\n\n[ARTICLE SOURCE URL]: ${targetUrl}\n\n[ARTICLE CONTENT]:\n${extractedText}\n\nCRITICAL INSTRUCTION FOR AI: You MUST strictly generate slides specifically analyzing and explaining the exact article title subject ("${title}").`;

  return {
    title,
    text: fullPayload,
    word_count: fullPayload.split(/\s+/).length
  };
}
