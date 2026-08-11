// /api/share.js — Cardify AI v6.9 Ultra-Short Link Gateway
// In-Memory & Failover KV Shortener Store

const shareKvStore = new Map();

function generateShortId() {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id = '';
  for (let i = 0; i < 6; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'POST') {
    try {
      const { slides, preset, ctaType, ctaValue } = req.body || {};
      if (!slides || !Array.isArray(slides)) {
        return res.status(400).json({ error: 'Invalid slides payload' });
      }

      const shortId = generateShortId();
      shareKvStore.set(shortId, { slides, preset, ctaType, ctaValue, createdAt: Date.now() });

      const host = req.headers.host || 'cardifyai.lumiere-private.com';
      const protocol = req.headers['x-forwarded-proto'] || 'https';

      return res.status(200).json({
        shortId,
        shortUrl: `${protocol}://${host}/#d=${shortId}`
      });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === 'GET') {
    const { id } = req.query || {};
    if (!id || !shareKvStore.has(id)) {
      return res.status(404).json({ error: 'Short link not found' });
    }

    return res.status(200).json({ data: shareKvStore.get(id) });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
