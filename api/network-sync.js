// In-memory encrypted network relay
// Scoped by client's public network identity (Same Wi-Fi Router)
if (!global.__CAO_NETWORK_ROOMS) {
  global.__CAO_NETWORK_ROOMS = new Map();
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // Detect the shared router's IP address (Same Wi-Fi signature)
  const forwarded = req.headers['x-forwarded-for'];
  const clientIp = forwarded ? forwarded.split(',')[0].trim() : req.socket?.remoteAddress || 'local-net';
  
  // Hash/Room based on the shared Wi-Fi IP
  const networkRoomId = 'wifi-' + clientIp.replace(/[^a-zA-Z0-9]/g, '_');

  // 1. Phone 2: PULL / CHECK for active server on same Wi-Fi
  if (req.method === 'GET') {
    const room = global.__CAO_NETWORK_ROOMS.get(networkRoomId);
    
    // If no server or data older than 15 minutes, report not found
    if (!room || !room.payload || (Date.now() - room.timestamp > 15 * 60 * 1000)) {
      return res.status(200).json({
        active: false,
        message: 'لا يوجد هاتف يشارك البيانات على نفس الشبكة حالياً'
      });
    }

    return res.status(200).json({
      active: true,
      sender: room.senderName,
      count: room.count,
      payload: room.payload,
      timestamp: room.timestamp
    });
  }

  // 2. Phone 1: POST / BROADCAST data to same Wi-Fi
  if (req.method === 'POST') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      
      if (body.action === 'stop') {
        global.__CAO_NETWORK_ROOMS.delete(networkRoomId);
        return res.status(200).json({ success: true, message: 'تم إيقاف الخادم' });
      }

      if (!body.payload) {
        return res.status(400).json({ success: false, message: 'Missing payload' });
      }

      // Store in the shared Wi-Fi room
      global.__CAO_NETWORK_ROOMS.set(networkRoomId, {
        senderName: body.senderName || 'الهاتف الرئيسي',
        count: body.count || 0,
        payload: body.payload,
        timestamp: Date.now()
      });

      return res.status(200).json({
        success: true,
        networkRoom: networkRoomId,
        message: 'الخادم نشط ويبث الآن لكافة الأجهزة في نفس الشبكة'
      });
    } catch (e) {
      return res.status(400).json({ success: false, message: 'Invalid request' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
