// Vercel Serverless Sync Relay Endpoint
let cachePayload = global.__SYNC_CACHE_PAYLOAD || '';
let cacheLastUpdated = global.__SYNC_CACHE_TIME || 0;

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method === 'GET') {
    return res.status(200).json({
      success: true,
      hasData: Boolean(global.__SYNC_CACHE_PAYLOAD),
      payload: global.__SYNC_CACHE_PAYLOAD || '',
      lastUpdated: global.__SYNC_CACHE_TIME || 0
    });
  }

  if (req.method === 'POST') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (body && body.payload) {
        global.__SYNC_CACHE_PAYLOAD = body.payload;
        global.__SYNC_CACHE_TIME = Date.now();
        return res.status(200).json({
          success: true,
          message: 'تم استقبال البيانات وتجهيزها في السيرفر',
          timestamp: global.__SYNC_CACHE_TIME
        });
      }
      return res.status(400).json({ success: false, message: 'Missing payload' });
    } catch (e) {
      return res.status(400).json({ success: false, message: 'Invalid payload body' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
