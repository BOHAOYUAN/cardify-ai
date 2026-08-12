// /api/schedule.js — Cardify AI Phase 4 Social Scheduler & Webhook Exporter
// Manages social post queues and triggers webhooks (compatible with Zapier, Make.com, Feishu, etc.)

const scheduleQueue = [];

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'POST') {
    try {
      const { action = 'create', webhookUrl, postData = {} } = req.body || {};

      if (action === 'create') {
        const task = {
          id: 'task_' + Math.random().toString(36).substring(2, 9),
          platform: postData.platform || 'linkedin',
          scheduledTime: postData.scheduledTime || new Date(Date.now() + 86400000).toISOString(),
          postText: postData.postText || '',
          liveLink: postData.liveLink || '',
          status: 'scheduled',
          createdAt: new Date().toISOString()
        };

        scheduleQueue.push(task);

        // If user provided a webhook (e.g. Zapier / Make / Feishu), trigger it immediately for testing/integration
        if (webhookUrl && typeof webhookUrl === 'string' && webhookUrl.startsWith('http')) {
          try {
            await fetch(webhookUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                event: 'social_post_scheduled',
                task,
                message: 'New B2B Social Post Task ready for automated publishing'
              })
            });
          } catch (e) {
            console.warn('[Schedule Webhook Error]:', e.message);
          }
        }

        return res.status(200).json({ success: true, task, message: 'Scheduled task created successfully' });
      }
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === 'GET') {
    return res.status(200).json({
      success: true,
      tasks: scheduleQueue.length > 0 ? scheduleQueue : [
        {
          id: 'demo_task_1',
          platform: 'linkedin',
          scheduledTime: new Date(Date.now() + 3600000 * 4).toISOString(),
          postText: '🚀 Zero to $10k/mo MRR Solo Business Playbook...\n\n👉 Full H5 Deck in 1st comment!',
          liveLink: 'https://cardifyai.lumiere-private.com/#d=demo1',
          status: 'scheduled'
        }
      ]
    });
  }

  return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
};
