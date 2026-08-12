// /api/webhook.js — Cardify AI LinkedIn Comment-to-DM Webhook Handler
// Handles Zapier / Make.com / ManyChat automated comment triggers (e.g. 'GROWTH')

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { keyword = 'GROWTH', comment_author = 'prospect', card_id = 'demo_card_123' } = req.body || {};

    if (keyword && keyword.toUpperCase() === 'GROWTH') {
      const host = req.headers.host || 'cardifyai.lumiere-private.com';
      const protocol = req.headers['x-forwarded-proto'] || 'https';
      const h5Url = `${protocol}://${host}/#d=${card_id}`;

      return res.status(200).json({
        success: true,
        action: 'SEND_DM',
        recipient: comment_author,
        message: `Hey ${comment_author}! Thanks for commenting on my post. Here is your private access link to the interactive H5 Deck: ${h5Url}`
      });
    }

    return res.status(200).json({ success: true, action: 'NONE', reason: 'Keyword unmatched' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
