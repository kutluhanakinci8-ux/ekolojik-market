import { createHmac, randomBytes, timingSafeEqual, createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { readTenantStore } from './tenantAuth.mjs';

const TOKEN_VERSION = 'v1';
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

function hashPassword(password) {
  return createHash('sha256').update(password).digest('hex');
}

function verifyPassword(password, passwordHash) {
  return hashPassword(password) === passwordHash;
}

function verifyPin(pin, pinHash) {
  if (!pinHash) return false;
  return hashPassword(`pin:${pin}`) === pinHash;
}

function secretPath(dataDir) {
  return join(dataDir, 'pos-api-secret');
}

let cachedSecret = null;

export async function getPosApiSecret(dataDir) {
  const env = process.env.EKOLOJIK_POS_API_SECRET?.trim();
  if (env) return env;
  if (cachedSecret) return cachedSecret;
  const path = secretPath(dataDir);
  try {
    cachedSecret = (await readFile(path, 'utf8')).trim();
    if (cachedSecret) return cachedSecret;
  } catch {
    /* generate */
  }
  cachedSecret = randomBytes(32).toString('base64url');
  await mkdir(dataDir, { recursive: true });
  await writeFile(path, `${cachedSecret}\n`, 'utf8');
  return cachedSecret;
}

function signPayload(secret, payloadB64) {
  return createHmac('sha256', secret).update(`${TOKEN_VERSION}.${payloadB64}`).digest('base64url');
}

export async function createPosApiToken(dataDir, { tenantId, userId, role }) {
  const secret = await getPosApiSecret(dataDir);
  const exp = Date.now() + TOKEN_TTL_MS;
  const payloadB64 = Buffer.from(JSON.stringify({ tenantId, userId, role, exp }), 'utf8').toString('base64url');
  const sig = signPayload(secret, payloadB64);
  return `${TOKEN_VERSION}.${payloadB64}.${sig}`;
}

export async function verifyPosApiToken(dataDir, token, expectedTenantId, { requireAdmin = false } = {}) {
  if (!token?.trim()) {
    return { ok: false, status: 401, error: 'Oturum token gerekli (POS girişi yapın)' };
  }
  const parts = token.trim().split('.');
  if (parts.length !== 3 || parts[0] !== TOKEN_VERSION) {
    return { ok: false, status: 401, error: 'Geçersiz token' };
  }
  const [, payloadB64, sig] = parts;
  const secret = await getPosApiSecret(dataDir);
  const expectedSig = signPayload(secret, payloadB64);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return { ok: false, status: 401, error: 'Geçersiz token imzası' };
    }
  } catch {
    return { ok: false, status: 401, error: 'Geçersiz token imzası' };
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
  } catch {
    return { ok: false, status: 401, error: 'Geçersiz token içeriği' };
  }

  if (!payload.exp || payload.exp < Date.now()) {
    return { ok: false, status: 401, error: 'Token süresi doldu — tekrar giriş yapın' };
  }
  if (expectedTenantId && payload.tenantId !== expectedTenantId) {
    return { ok: false, status: 403, error: 'Token bu mağaza için geçerli değil' };
  }
  if (requireAdmin && payload.role !== 'admin') {
    return { ok: false, status: 403, error: 'Yönetici yetkisi gerekli' };
  }

  return { ok: true, payload };
}

export function extractBearerToken(req) {
  const auth = req.headers.authorization || req.headers.Authorization;
  if (typeof auth === 'string' && auth.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7).trim();
  }
  const header = req.headers['x-ekolojik-pos-token'];
  if (typeof header === 'string' && header.trim()) return header.trim();
  return '';
}

export async function assertPosAdminApiAuth(req, res, dataDir, tenantId) {
  const token = extractBearerToken(req);
  const result = await verifyPosApiToken(dataDir, token, tenantId, { requireAdmin: true });
  if (!result.ok) {
    res.writeHead(result.status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: result.error }));
    return false;
  }
  return result.payload;
}

export async function issuePosApiTokenFromCredentials(dataDir, tenantId, { username, password, pin }) {
  const store = await readTenantStore(dataDir, tenantId);
  if (!store?.users?.length) {
    return { ok: false, status: 404, message: 'Mağaza bulunamadı' };
  }
  const normalized = String(username ?? '').trim().toLowerCase();
  const user = store.users.find((u) => u.username === normalized && u.isActive !== false);
  if (!user) {
    return { ok: false, status: 401, message: 'Kullanıcı adı veya şifre hatalı' };
  }

  let authed = false;
  if (password) {
    authed = verifyPassword(String(password), user.passwordHash);
  } else if (pin) {
    authed = verifyPin(String(pin), user.pinHash);
  }
  if (!authed) {
    return { ok: false, status: 401, message: 'Kullanıcı adı veya şifre hatalı' };
  }

  const token = await createPosApiToken(dataDir, {
    tenantId,
    userId: user.id,
    role: user.role,
  });
  return {
    ok: true,
    token,
    expiresInSec: Math.floor(TOKEN_TTL_MS / 1000),
    role: user.role,
    userId: user.id,
  };
}
