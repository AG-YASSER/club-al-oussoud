import http from 'http';
import os from 'os';
import fs from 'fs';
import path from 'path';

const PORT = process.env.PORT || 8080;
const CACHE_FILE = path.join(process.cwd(), 'club_sync_store.json');

let storedPayload = '';
let lastUpdated = Date.now();

// Load cache if exists
try {
  if (fs.existsSync(CACHE_FILE)) {
    const data = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
    storedPayload = data.payload || '';
    lastUpdated = data.lastUpdated || Date.now();
  }
} catch (e) {
  console.warn('[SyncServer] Cache file read error:', e.message);
}

function getLocalIpAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push({ name, address: iface.address });
      }
    }
  }
  return addresses;
}

const server = http.createServer((req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || '/', `http://${req.headers.host}`);

  if (url.pathname === '/' || url.pathname === '/api/ping') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      server: 'Club Al Oussoud Local Sync Server',
      version: 4,
      hasData: Boolean(storedPayload),
      lastUpdated,
      ips: getLocalIpAddresses().map(a => a.address)
    }));
    return;
  }

  if (url.pathname === '/api/sync') {
    if (req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        payload: storedPayload,
        lastUpdated
      }));
      return;
    }

    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (!parsed.payload) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Missing payload parameter' }));
            return;
          }
          storedPayload = parsed.payload;
          lastUpdated = Date.now();

          // Persist to file
          try {
            fs.writeFileSync(CACHE_FILE, JSON.stringify({ payload: storedPayload, lastUpdated }), 'utf-8');
          } catch (err) {
            console.error('[SyncServer] Error writing cache:', err);
          }

          console.log(`[SyncServer] ✅ Data received & saved at ${new Date().toLocaleTimeString()} (${storedPayload.length} bytes)`);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, message: 'Payload received and saved', timestamp: lastUpdated }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, message: 'Invalid JSON body' }));
        }
      });
      return;
    }
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Endpoint not found' }));
});

server.listen(PORT, '0.0.0.0', () => {
  const ips = getLocalIpAddresses();
  console.log('\n=============================================================');
  console.log('🦁 خادم المزامنة المحلي لنادي الأسود (Club Al Oussoud Sync)');
  console.log('=============================================================');
  console.log(`📡 الخادم يعمل الآن على المنفذ: ${PORT}`);
  if (ips.length > 0) {
    console.log('📱 عناوين IP الخاصة بشبكتك المحلية (Wi-Fi):');
    ips.forEach(ip => {
      console.log(`   👉 http://${ip.address}:${PORT}`);
    });
  } else {
    console.log(`   👉 http://localhost:${PORT}`);
  }
  console.log('-------------------------------------------------------------');
  console.log('قم بإدخال هذا العنوان في تطبيق الهاتف في تبويب شبكة Wi-Fi للمزامنة فورياً!');
  console.log('=============================================================\n');
});
