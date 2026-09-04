import { defineConfig, type Plugin, type ViteDevServer } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import type { IncomingMessage, ServerResponse } from 'http'

// In-memory rooms for local dev server
const localRooms = new Map<string, { senderName: string; count: number; payload: string; timestamp: number }>();

function networkSyncDevPlugin(): Plugin {
  return {
    name: 'network-sync-dev-plugin',
    configureServer(server: ViteDevServer) {
      server.middlewares.use('/api/network-sync', (req: IncomingMessage, res: ServerResponse) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          res.end();
          return;
        }

        const forwarded = req.headers['x-forwarded-for'];
        const clientIp = typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : req.socket?.remoteAddress || 'local-net';
        const networkRoomId = 'wifi-' + clientIp.replace(/[^a-zA-Z0-9]/g, '_');

        if (req.method === 'GET') {
          const room = localRooms.get(networkRoomId);
          res.setHeader('Content-Type', 'application/json');
          if (!room || !room.payload || (Date.now() - room.timestamp > 15 * 60 * 1000)) {
            res.statusCode = 200;
            res.end(JSON.stringify({
              active: false,
              message: 'لم يتم العثور على جهاز يبث في نفس الشبكة'
            }));
            return;
          }

          res.statusCode = 200;
          res.end(JSON.stringify({
            active: true,
            sender: room.senderName,
            count: room.count,
            payload: room.payload,
            timestamp: room.timestamp
          }));
          return;
        }

        if (req.method === 'POST') {
          const chunks: Buffer[] = [];
          req.on('data', (chunk: Buffer) => {
            chunks.push(chunk);
          });
          req.on('end', () => {
            res.setHeader('Content-Type', 'application/json');
            try {
              const rawBody = Buffer.concat(chunks).toString('utf8');
              const body = rawBody ? JSON.parse(rawBody) : {};

              if (body.action === 'stop') {
                localRooms.delete(networkRoomId);
                res.statusCode = 200;
                res.end(JSON.stringify({ success: true, message: 'تم إيقاف البث' }));
                return;
              }

              if (!body.payload) {
                res.statusCode = 400;
                res.end(JSON.stringify({ success: false, message: 'Missing payload' }));
                return;
              }

              localRooms.set(networkRoomId, {
                senderName: body.senderName || 'الهاتف الأول',
                count: body.count || 0,
                payload: body.payload,
                timestamp: Date.now()
              });

              res.statusCode = 200;
              res.end(JSON.stringify({
                success: true,
                networkRoom: networkRoomId,
                message: 'تم بدء البث بنجاح'
              }));
            } catch (err: any) {
              res.statusCode = 400;
              res.end(JSON.stringify({ success: false, message: 'Invalid JSON: ' + (err?.message || '') }));
            }
          });
          return;
        }

        res.statusCode = 405;
        res.end(JSON.stringify({ error: 'Method not allowed' }));
      });
    }
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    networkSyncDevPlugin(),
  ],
  server: {
    host: true,
    port: 5173,
  },
})
