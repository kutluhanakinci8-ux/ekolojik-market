import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

function configPath(dataDir, tenantId) {
  return join(dataDir, 'messaging', tenantId, 'public-config.json');
}

async function readAllowedOrigins(dataDir, tenantId = 'main') {
  try {
    const raw = JSON.parse(await readFile(configPath(dataDir, tenantId), 'utf8'));
    const list = Array.isArray(raw.allowedOrigins) ? raw.allowedOrigins : [];
    return list.map((o) => String(o).trim()).filter(Boolean);
  } catch {
    return [];
  }
}

function originMatches(origin, entry) {
  if (entry === '*') return true;
  if (origin === entry) return true;
  if (entry.startsWith('*.') && origin.endsWith(entry.slice(1))) return true;
  return false;
}

/** Cross-origin public messaging — allowlist tenant config veya aynı-origin (Origin yok). */
export async function resolveMessagingPublicCors(req, dataDir, tenantId = 'main') {
  const origin = String(req.headers.origin ?? '').trim();
  const baseHeaders = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-ekolojik-messaging-key, Authorization',
    'Access-Control-Max-Age': '86400',
  };

  if (!origin) {
    return { ok: true, headers: baseHeaders };
  }

  const allowed = await readAllowedOrigins(dataDir, tenantId);
  if (allowed.length === 0) {
    return {
      ok: false,
      status: 403,
      error: 'CORS: allowedOrigins boş — tenant public-config içine site kökeni ekleyin',
      headers: baseHeaders,
    };
  }

  const match = allowed.some((entry) => originMatches(origin, entry));
  if (!match) {
    return {
      ok: false,
      status: 403,
      error: `CORS: Origin izinli değil (${origin})`,
      headers: { ...baseHeaders, 'Access-Control-Allow-Origin': 'null' },
    };
  }

  return {
    ok: true,
    headers: { ...baseHeaders, 'Access-Control-Allow-Origin': origin, Vary: 'Origin' },
  };
}

export async function writeMessagingCorsHeaders(req, res, dataDir, tenantId) {
  const cors = await resolveMessagingPublicCors(req, dataDir, tenantId);
  if (cors.headers) {
    for (const [k, v] of Object.entries(cors.headers)) {
      res.setHeader(k, v);
    }
  }
  return cors;
}
