import { WebSocketServer } from 'ws';
import { getPostaUnreadCounts } from './postaInbox.mjs';

/** SSE ile aynı olayları WebSocket üzerinden yayınlar (NB WS gateway lite). */
export function attachPostaWebSocketGateway(server, { dataDir, resolveTenantFromUrl }) {
  const wss = new WebSocketServer({ noServer: true });
  /** @type {Map<string, Set<import('ws').WebSocket>>} */
  const rooms = new Map();

  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname !== '/api/posta/ws') {
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      const tenantId = resolveTenantFromUrl(url) || 'main';
      const key = tenantId;
      if (!rooms.has(key)) rooms.set(key, new Set());
      rooms.get(key).add(ws);
      ws.on('close', () => rooms.get(key)?.delete(ws));

      void getPostaUnreadCounts(dataDir, tenantId).then((payload) => {
        ws.send(JSON.stringify({ event: 'unread', data: payload }));
      });

      const ping = setInterval(() => {
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({ event: 'ping', data: { t: Date.now() } }));
        }
      }, 25_000);
      ws.on('close', () => clearInterval(ping));
    });
  });

  function broadcast(tenantId, event, data) {
    const set = rooms.get(tenantId || 'main');
    if (!set) return;
    const body = JSON.stringify({ event, data });
    for (const ws of set) {
      if (ws.readyState === ws.OPEN) ws.send(body);
    }
  }

  return { broadcast };
}
