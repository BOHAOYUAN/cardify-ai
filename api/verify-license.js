// /api/verify-license.js — Dodo Payments & License Entitlement Gateway

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { licenseKey } = req.body || req.query || {};

  if (!licenseKey || typeof licenseKey !== 'string') {
    return res.status(400).json({ valid: false, message: 'License key is required' });
  }

  const cleanKey = licenseKey.trim().toUpperCase();

  // Test / Pro License Validation Logic
  const isValidPro = cleanKey.startsWith('CARDIFY-PRO-') || cleanKey.startsWith('DODO-PRO-') || cleanKey.length >= 10;

  if (isValidPro) {
    return res.status(200).json({
      valid: true,
      licenseKey: cleanKey,
      plan: 'pro_unlimited',
      allowCustomWatermark: true,
      unlimitedGenerations: true,
      expiresAt: '2099-12-31'
    });
  }

  return res.status(404).json({
    valid: false,
    message: 'Invalid or expired License Key.'
  });
}
