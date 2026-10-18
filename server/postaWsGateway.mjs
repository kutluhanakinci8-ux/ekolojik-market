import { WebSocketServer } from 'ws';
import { getPostaUnreadCounts } from './postaInbox.mjs';
import { recordPostaDeliveryLatency } from './postaLive.mjs';

let lastWsBroadcastAt = null;
let wsBroadcastCount = 0;
/** @type {Map<string, Set<import('ws').WebSocket>> | null} */
let roomsRef = null;

/** SSE ile aynı olayları WebSocket üzerinden yayınlar (NB WS gateway lite). */
export function attachPostaWebSocketGateway(server, { dataDir, resolveTenantFromUrl }) {
  const wss = new WebSocketServer({ noServer: true });
  /** @type {Map<string, Set<import('ws').WebSocket>>} */
  const rooms = new Map();
  roomsRef = rooms;

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

  async function broadcast(tenantId, event, data) {
    const set = rooms.get(tenantId || 'main');
    if (!set?.size) return;
    const body = JSON.stringify({ event, data });
    lastWsBroadcastAt = new Date().toISOString();
    wsBroadcastCount += 1;
    for (const ws of set) {
      if (ws.readyState === ws.OPEN) ws.send(body);
    }
    if (event === 'messaging' && data?.messageAt) {
      void recordPostaDeliveryLatency(dataDir, {
        channel: 'ws-messaging',
        messageAt: data.messageAt,
        sourceId: data.messageId ?? data.threadId ?? null,
      });
    }
  }

  return { broadcast };
}

export function getPostaWsGatewayMetrics() {
  let connectedClients = 0;
  if (roomsRef) {
    for (const set of roomsRef.values()) connectedClients += set.size;
  }
  return {
    path: '/api/posta/ws',
    connectedClients,
    lastBroadcastAt: lastWsBroadcastAt,
    broadcastCount: wsBroadcastCount,
  };
}
