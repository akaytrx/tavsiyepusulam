// Vercel serverless function: accepts a recommendation for moderation.
// Secrets are read only on the server; never expose SUPABASE_SECRET_KEY in HTML.
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Yalnızca POST destekleniyor.' });
  }
  const type = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
  if (type !== 'application/json') return res.status(415).json({ error: 'JSON içeriği gerekli.' });
  const fetchSite = req.headers['sec-fetch-site'];
  if (fetchSite && !['same-origin', 'none'].includes(fetchSite)) return res.status(403).json({ error: 'İzin verilmeyen istek.' });
  const length = Number(req.headers['content-length'] || 0);
  if (length > 12000) return res.status(413).json({ error: 'İstek çok büyük.' });
  const origin = req.headers.origin;
  const host = req.headers.host;
  if (origin) {
    try {
      if (new URL(origin).host !== host) return res.status(403).json({ error: 'İzin verilmeyen kaynak.' });
    } catch { return res.status(403).json({ error: 'Geçersiz kaynak.' }); }
  }
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return res.status(503).json({ error: 'Servis yapılandırması eksik.' });
  const body = typeof req.body === 'object' && req.body !== null && !Array.isArray(req.body) ? req.body : {};
  if (JSON.stringify(body).length > 12000) return res.status(413).json({ error: 'İstek çok büyük.' });
  // Invisible honeypot: basic bot deterrent, not a replacement for rate limits.
  if (body.website) return res.status(200).json({ ok: true });
  const clean = (v) => typeof v === 'string' ? v.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim() : '';
  const suspicious = (v) => /https?:\/\/|www\.|<[^>]*>/i.test(v);
  const venue_name = clean(body.venue_name);
  const district = clean(body.district);
  const category = clean(body.category);
  const description = clean(body.description);
  if (!venue_name || venue_name.length > 120 || !district || district.length > 120 ||
      !['Romantik','Kahvaltı','Manzara','Arkadaşlarla','Genel'].includes(category) ||
      description.length < 10 || description.length > 2000 ||
      [venue_name,district,description].some(suspicious)) {
    return res.status(400).json({ error: 'Alanları kontrol et. Açıklama 10–2000 karakter olmalı.' });
  }
  try {
    const response = await fetch(url.replace(/\/$/, '') + '/rest/v1/recommendations', {
      method: 'POST',
      headers: { apikey: key, Authorization: 'Bearer ' + key,
        'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ venue_name, district, category, description, status: 'pending' })
    });
    if (!response.ok) {
      console.error('Supabase insert failed:', response.status);
      return res.status(502).json({ error: 'Tavsiye kaydedilemedi. Lütfen tekrar dene.' });
    }
    return res.status(201).json({ ok: true, message: 'Tavsiyen onaya gönderildi.' });
  } catch (error) {
    console.error('Recommendation API unavailable:', error?.message);
    return res.status(502).json({ error: 'Bağlantı kurulamadı. Lütfen tekrar dene.' });
  }
}
