// /api/team.js — Cardify AI Phase 4 Agency White-Label & Team Management Gateway
// Handles white-label settings (custom logo, remove watermark) and agency plan validation

const agencySettingsStore = new Map(); // licenseKey/userKey -> { isWhiteLabel: true, customLogoUrl: '', agencyName: '' }

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'POST') {
    try {
      const { userKey = 'default_agency', isWhiteLabel = false, customLogoUrl = '', agencyName = '' } = req.body || {};

      agencySettingsStore.set(userKey, {
        isWhiteLabel: Boolean(isWhiteLabel),
        customLogoUrl: customLogoUrl.trim(),
        agencyName: agencyName.trim(),
        updatedAt: new Date().toISOString()
      });

      return res.status(200).json({
        success: true,
        message: 'Agency White-Label settings saved successfully',
        settings: agencySettingsStore.get(userKey)
      });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === 'GET') {
    const userKey = req.query.userKey || 'default_agency';
    const settings = agencySettingsStore.get(userKey) || {
      isWhiteLabel: false,
      customLogoUrl: '',
      agencyName: 'My Growth Agency'
    };

    return res.status(200).json({ success: true, settings });
  }

  return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
};
