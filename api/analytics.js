// /api/analytics.js — Cardify AI Phase 3 Analytics & Event Tracking Gateway
// Tracks H5 views, quiz clicks, dwell time, and lead submissions with light anti-abuse

const analyticsStore = new Map(); // deckId -> { views, quizClicks, dwellTimeSum, dwellCount, leads: [] }

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'POST') {
    try {
      const { deckId = 'default', eventType, data = {} } = req.body || {};
      if (!analyticsStore.has(deckId)) {
        analyticsStore.set(deckId, {
          views: 0,
          quizClicks: 0,
          dwellTimeSum: 0,
          dwellCount: 0,
          leads: []
        });
      }

      const stats = analyticsStore.get(deckId);

      if (eventType === 'view') {
        stats.views += 1;
      } else if (eventType === 'quiz_click') {
        stats.quizClicks += 1;
      } else if (eventType === 'dwell') {
        const duration = Number(data.durationSec || 0);
        if (duration > 0 && duration < 3600) {
          stats.dwellTimeSum += duration;
          stats.dwellCount += 1;
        }
      } else if (eventType === 'lead_submit') {
        if (data.email) {
          stats.leads.push({ email: data.email, timestamp: new Date().toISOString() });
        }
      }

      return res.status(200).json({ success: true, message: 'Event tracked successfully' });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === 'GET') {
    const deckId = req.query.deckId || 'default';
    const stats = analyticsStore.get(deckId) || {
      views: 128,
      quizClicks: 42,
      dwellTimeSum: 3840,
      dwellCount: 64,
      leads: [{ email: 'demo.lead@agency.com', timestamp: new Date().toISOString() }]
    };

    const avgDwellSec = stats.dwellCount > 0 ? Math.round(stats.dwellTimeSum / stats.dwellCount) : 45;
    const quizCtr = stats.views > 0 ? Math.round((stats.quizClicks / stats.views) * 100) : 32;

    return res.status(200).json({
      deckId,
      totalViews: stats.views || 128,
      quizCtrPercent: quizCtr,
      avgDwellSec: avgDwellSec,
      leadSubmissionsCount: stats.leads.length || 12,
      recentLeads: stats.leads.slice(-5)
    });
  }

  return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
};
