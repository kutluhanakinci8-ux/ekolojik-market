import { readTenantStore } from './tenantAuth.mjs';
import { extractBearerToken, verifyPosApiToken } from './posApiAuth.mjs';
import { checkRateLimit } from './rateLimit.mjs';

export function isPostaAuthExempt(pathname, method) {
  if (method === 'OPTIONS') return true;
  if (/^\/api\/posta\/track\/open\//i.test(pathname)) return true;
  if (pathname === '/api/posta/calendar/feed.ics' && method === 'GET') return true;
  return false;
}

export function requiresPostaPosAuth(pathname, method) {
  if (!pathname.startsWith('/api/posta/')) return false;
  return !isPostaAuthExempt(pathname, method);
}

export function requiresMessagingPosAuth(pathname) {
  return pathname.startsWith('/api/messaging/');
}

function resolveAccessToken(req, url) {
  const bearer = extractBearerToken(req);
  if (bearer) return bearer;
  const q = url.searchParams.get('access_token')?.trim();
  return q || '';
}

function userHasPostaAccess(user) {
  if (!user || user.isActive === false) return false;
  if (user.role === 'admin') return true;
  const tabs = Array.isArray(user.allowedTabs) ? user.allowedTabs : [];
  return tabs.includes('posta');
}

export async function enforcePostaApiAccess(req, res, url, dataDir, tenantId) {
  if (process.env.EKOLOJIK_POS_POSTA_AUTH === '0') {
    return { userId: null, role: 'admin', tenantId, bypass: true };
  }

  const ip = String(req.headers['x-forwarded-for'] ?? req.socket?.remoteAddress ?? 'unknown').split(',')[0].trim();
  const token = resolveAccessToken(req, url);
  const verified = await verifyPosApiToken(dataDir, token, tenantId, { requireAdmin: false });
  if (!verified.ok) {
    res.writeHead(verified.status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: verified.error }));
    return false;
  }

  const rl = checkRateLimit(`posta:${ip}:${verified.payload.userId}`, { limit: 180, windowMs: 60_000 });
  if (!rl.ok) {
    res.writeHead(429, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'Çok fazla istek — lütfen bekleyin' }));
    return false;
  }

  const store = await readTenantStore(dataDir, tenantId);
  const user = store?.users?.find((u) => u.id === verified.payload.userId);
  if (!userHasPostaAccess(user)) {
    res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'Posta sekmesi yetkisi gerekli' }));
    return false;
  }

  return { ...verified.payload, bypass: false };
}
