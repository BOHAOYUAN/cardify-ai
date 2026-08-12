// /api/radar.js — Cardify AI Today's Viral B2B Reads API
// Delivers curated daily viral reads for 1-Click Remix

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const viralReads = [
    {
      id: "viral_1",
      title: "Sam Altman: The $1B Solo Founder Playbook",
      category: "AI & Startup",
      url: "https://youtube.com/watch?v=example1",
      snippet: "How 1-person unicorns will dominate 2026 using AI leverage, extreme focus, and automated pipelines."
    },
    {
      id: "viral_2",
      title: "DeepSeek LLM Cost Reduction Secrets",
      category: "Engineering",
      url: "https://arxiv.org/abs/example2",
      snippet: "Architectural breakthroughs behind DeepSeek V3/R1. Multi-head latent attention and FP8 mixed precision training."
    },
    {
      id: "viral_3",
      title: "B2B LinkedIn Organic Growth SOP 2026",
      category: "Marketing",
      url: "https://blog.cardify.ai/linkedin-sop",
      snippet: "Convert Carousel views to booked calls via native PDF carousels & Comment-to-DM automation."
    }
  ];

  return res.status(200).json({ success: true, data: viralReads });
};
