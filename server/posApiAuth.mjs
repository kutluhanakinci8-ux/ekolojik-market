import { createHmac, randomBytes, timingSafeEqual, createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { readTenantStore } from './tenantAuth.mjs';

const TOKEN_VERSION = 'v1';
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
/** Süresi dolmuş token ile yenileme (ağ gecikmesi) */
export const TOKEN_REFRESH_GRACE_MS = 30 * 60 * 1000;

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

export async function createPosApiToken(dataDir, {
  tenantId,
  userId,
  role,
  username,
  authEpoch,
  platformEpoch,
}) {
  const secret = await getPosApiSecret(dataDir);
  const exp = Date.now() + TOKEN_TTL_MS;
  const payload = { tenantId, userId, role, exp };
  if (username) payload.username = String(username).trim().toLowerCase();
  if (authEpoch != null && Number.isFinite(Number(authEpoch))) {
    payload.ae = Number(authEpoch);
  }
  if (platformEpoch != null && Number.isFinite(Number(platformEpoch))) {
    payload.pe = Number(platformEpoch);
  }
  const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = signPayload(secret, payloadB64);
  return `${TOKEN_VERSION}.${payloadB64}.${sig}`;
}

export async function verifyPosApiToken(
  dataDir,
  token,
  expectedTenantId,
  { requireAdmin = false, requirePlatform = false, refreshGraceMs = 0 } = {},
) {
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

  const now = Date.now();
  if (!payload.exp || payload.exp < now) {
    const grace = Math.max(0, Number(refreshGraceMs) || 0);
    if (!(grace > 0 && payload.exp && payload.exp + grace >= now)) {
      return { ok: false, status: 401, error: 'Token süresi doldu — tekrar giriş yapın' };
    }
  }
  const isPlatform = payload.role === 'platform';
  if (requirePlatform && !isPlatform) {
    return { ok: false, status: 403, error: 'Platform yöneticisi oturumu gerekli' };
  }
  if (expectedTenantId && payload.tenantId !== expectedTenantId) {
    if (!isPlatform) {
      return { ok: false, status: 403, error: 'Token bu mağaza için geçerli değil' };
    }
    if (expectedTenantId === '__platform__') {
      return { ok: false, status: 403, error: 'Token bu mağaza için geçerli değil' };
    }
  }
  if (requireAdmin && payload.role !== 'admin' && !isPlatform) {
    return { ok: false, status: 403, error: 'Yönetici yetkisi gerekli' };
  }

  if (isPlatform) {
    const { readPlatformSessionEpoch } = await import('./platformSessionRevoke.mjs');
    const pe = await readPlatformSessionEpoch(dataDir);
    if ((payload.pe ?? 0) !== pe) {
      return { ok: false, status: 401, error: 'Platform oturumu sonlandırıldı — tekrar giriş yapın' };
    }
  } else if (payload.userId && payload.tenantId) {
    const store = await readTenantStore(dataDir, payload.tenantId);
    const user = store?.users?.find((u) => u.id === payload.userId);
    const ae = Number(user?.authEpoch) || 0;
    if ((payload.ae ?? 0) !== ae) {
      return { ok: false, status: 401, error: 'Oturum sonlandırıldı — tekrar giriş yapın' };
    }
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

export async function assertPosApiAuth(req, res, dataDir, tenantId, { requireAdmin = false } = {}) {
  const token = extractBearerToken(req);
  const result = await verifyPosApiToken(dataDir, token, tenantId, { requireAdmin });
  if (!result.ok) {
    res.writeHead(result.status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: result.error }));
    return false;
  }
  return result.payload;
}

export async function assertPosAdminApiAuth(req, res, dataDir, tenantId) {
  const payload = await assertPosApiAuth(req, res, dataDir, tenantId, { requireAdmin: true });
  return payload || false;
}

const ISOLATED_STORE_USERNAME_PATTERN = /^lima/i;

function assertUserBelongsToTenant(username, tenantId) {
  const name = String(username ?? '').trim().toLowerCase();
  const tenant = String(tenantId ?? 'main').trim() || 'main';
  if (tenant === 'main' && ISOLATED_STORE_USERNAME_PATTERN.test(name)) {
    return {
      ok: false,
      status: 403,
      message: 'Bu hesap Lima Market (lima-market) mağaza kodu ile giriş yapmalıdır.',
    };
  }
  return { ok: true };
}

const GREENLEAF_LOGIN_ALIASES = new Map([
  ['kutluhan', 'kutluhan08'],
  ['kutluhanakinci8', 'kutluhan08'],
]);

async function auditPosLoginAttempt(dataDir, tenantId, partial) {
  try {
    const { appendTenantLoginAudit } = await import('./tenantLoginAudit.mjs');
    await appendTenantLoginAudit(dataDir, tenantId, partial);
  } catch {
    /* audit opsiyonel */
  }
}

async function denyPosLogin(dataDir, tenant, auditMeta, auditBody, httpStatus, message) {
  await auditPosLoginAttempt(dataDir, tenant, {
    ...auditMeta,
    success: false,
    ...auditBody,
    failureReason: auditBody.failureReason ?? message,
  });
  return { ok: false, status: httpStatus, message };
}

export async function issuePosApiTokenFromCredentials(
  dataDir,
  tenantId,
  { username, password, pin, clientIp, userAgent },
) {
  let normalized = String(username ?? '').trim().toLowerCase();
  const tenant = String(tenantId ?? 'main').trim() || 'main';
  const auditMeta = {
    clientIp: clientIp ? String(clientIp).trim() : undefined,
    deviceInfo: userAgent ? String(userAgent).slice(0, 160) : 'web',
    method: pin ? 'pin' : 'password',
  };
  const { LOGIN_AUDIT_KINDS, lifecycleKindFromMessage } = await import('./loginAuditKinds.mjs');
  const wrongSecretMsg = pin ? 'Kullanıcı adı veya PIN hatalı' : 'Kullanıcı adı veya şifre hatalı';
  const wrongSecretKind = pin ? LOGIN_AUDIT_KINDS.WRONG_PIN : LOGIN_AUDIT_KINDS.WRONG_CREDENTIALS;

  if (!password && !pin) {
    return denyPosLogin(
      dataDir,
      tenant,
      auditMeta,
      {
        username: normalized,
        failureKind: LOGIN_AUDIT_KINDS.MISSING_CREDENTIALS,
        failureReason: 'Kullanıcı adı ve şifre girin',
      },
      401,
      'Kullanıcı adı veya şifre hatalı',
    );
  }

  const {
    isPlatformOperatorUsername,
    normalizePlatformOperatorUsername,
    isDedicatedPlatformOnlyUsername,
  } = await import('./platformOperators.mjs');
  if (isPlatformOperatorUsername(normalized) && password) {
    const { issuePlatformApiTokenFromCredentials } = await import('./platformAuth.mjs');
    const platformResult = await issuePlatformApiTokenFromCredentials(dataDir, { username: normalized, password });
    if (platformResult.ok) return platformResult;
    if (platformResult.status !== 401) return platformResult;
    if (isDedicatedPlatformOnlyUsername(normalized)) {
      return denyPosLogin(
        dataDir,
        tenant,
        auditMeta,
        {
          username: normalized,
          failureKind: LOGIN_AUDIT_KINDS.PLATFORM_ONLY,
          failureReason: 'Kullanıcı adı veya şifre hatalı',
        },
        401,
        'Kullanıcı adı veya şifre hatalı',
      );
    }
  }
  if (tenant === 'main' && GREENLEAF_LOGIN_ALIASES.has(normalized)) {
    normalized = GREENLEAF_LOGIN_ALIASES.get(normalized);
  }
  normalized = normalizePlatformOperatorUsername(normalized);
  if (isDedicatedPlatformOnlyUsername(normalized)) {
    return denyPosLogin(
      dataDir,
      tenant,
      auditMeta,
      {
        username: normalized,
        failureKind: LOGIN_AUDIT_KINDS.PLATFORM_ONLY,
        failureReason: 'Kullanıcı adı veya şifre hatalı',
      },
      401,
      'Kullanıcı adı veya şifre hatalı',
    );
  }
  const tenantAffinity = assertUserBelongsToTenant(normalized, tenantId);
  if (!tenantAffinity.ok) {
    return denyPosLogin(
      dataDir,
      tenant,
      auditMeta,
      {
        username: normalized,
        failureKind: LOGIN_AUDIT_KINDS.TENANT_AFFINITY,
        failureReason: tenantAffinity.message,
      },
      tenantAffinity.status ?? 403,
      tenantAffinity.message,
    );
  }

  const { assertTenantLoginAllowed } = await import('./platformTenantLifecycle.mjs');
  const loginGate = await assertTenantLoginAllowed(dataDir, tenantId);
  if (!loginGate.ok) {
    return denyPosLogin(
      dataDir,
      tenant,
      auditMeta,
      {
        username: normalized,
        failureKind: lifecycleKindFromMessage(loginGate.message),
        failureReason: loginGate.message,
      },
      403,
      loginGate.message,
    );
  }

  const rawStore = await readTenantStore(dataDir, tenantId);
  const { hydrateStoreWithCredentialVault } = await import('./credentialVault.mjs');
  const { store } = await hydrateStoreWithCredentialVault(dataDir, tenantId, rawStore);
  if (!store?.users?.length) {
    return denyPosLogin(
      dataDir,
      tenant,
      auditMeta,
      {
        username: normalized,
        failureKind: LOGIN_AUDIT_KINDS.STORE_MISSING,
        failureReason: 'Mağaza bulunamadı',
      },
      404,
      'Mağaza bulunamadı',
    );
  }
  const matched = store.users.find((u) => u.username === normalized);
  if (!matched || matched.isActive === false) {
    const disabled = matched && matched.isActive === false;
    return denyPosLogin(
      dataDir,
      tenant,
      auditMeta,
      {
        username: normalized,
        userId: disabled ? matched.id : undefined,
        displayName: disabled ? matched.displayName : undefined,
        failureKind: disabled ? LOGIN_AUDIT_KINDS.ACCOUNT_DISABLED : LOGIN_AUDIT_KINDS.UNKNOWN_USER,
        failureReason: disabled
          ? 'Hesap kilitli (yönetici)'
          : 'Kullanıcı adı veya şifre hatalı',
      },
      401,
      disabled ? 'Hesabınız yönetici tarafından kilitlendi. Giriş yapamazsınız.' : 'Kullanıcı adı veya şifre hatalı',
    );
  }
  const user = matched;

  let authed = false;
  if (password) {
    authed = verifyPassword(String(password), user.passwordHash);
  } else if (pin) {
    authed = verifyPin(String(pin), user.pinHash);
  }
  if (!authed) {
    return denyPosLogin(
      dataDir,
      tenant,
      auditMeta,
      {
        userId: user.id,
        username: user.username,
        displayName: user.displayName,
        failureKind: wrongSecretKind,
        failureReason: wrongSecretMsg,
      },
      401,
      wrongSecretMsg,
    );
  }

  await auditPosLoginAttempt(dataDir, tenant, {
    ...auditMeta,
    userId: user.id,
    username: user.username,
    displayName: user.displayName,
    success: true,
  });

  const token = await createPosApiToken(dataDir, {
    tenantId,
    userId: user.id,
    role: user.role,
    username: user.username,
    authEpoch: user.authEpoch ?? 0,
  });
  const exp = Date.now() + TOKEN_TTL_MS;
  const { passwordHash, pinHash, totpSecret, ...publicUser } = user;
  return {
    ok: true,
    token,
    expiresInSec: Math.floor(TOKEN_TTL_MS / 1000),
    expiresAt: new Date(exp).toISOString(),
    role: user.role,
    userId: user.id,
    user: publicUser,
  };
}

export async function refreshPosApiTokenFromBearer(dataDir, token, tenantId) {
  const { PLATFORM_TENANT_ID } = await import('./platformOperators.mjs');
  let verified = await verifyPosApiToken(dataDir, token, PLATFORM_TENANT_ID, {
    refreshGraceMs: TOKEN_REFRESH_GRACE_MS,
  });
  if (!verified.ok) {
    verified = await verifyPosApiToken(dataDir, token, tenantId, {
      refreshGraceMs: TOKEN_REFRESH_GRACE_MS,
    });
  }
  if (!verified.ok) {
    return { ok: false, status: verified.status ?? 401, message: verified.error };
  }

  if (verified.payload.role === 'platform') {
    const { readPlatformSessionEpoch } = await import('./platformSessionRevoke.mjs');
    const pe = await readPlatformSessionEpoch(dataDir);
    const newToken = await createPosApiToken(dataDir, {
      tenantId: PLATFORM_TENANT_ID,
      userId: verified.payload.userId,
      role: 'platform',
      username: verified.payload.username,
      platformEpoch: pe,
    });
    return { ok: true, token: newToken, role: 'platform', userId: verified.payload.userId };
  }

  const store = await readTenantStore(dataDir, tenantId);
  const user = store?.users?.find((u) => u.id === verified.payload.userId);
  if (!user || user.isActive === false) {
    return { ok: false, status: 401, message: 'Kullanıcı artık aktif değil' };
  }

  const newToken = await createPosApiToken(dataDir, {
    tenantId,
    userId: user.id,
    role: user.role,
    username: user.username,
    authEpoch: user.authEpoch ?? 0,
  });
  const exp = Date.now() + TOKEN_TTL_MS;
  return {
    ok: true,
    token: newToken,
    expiresInSec: Math.floor(TOKEN_TTL_MS / 1000),
    expiresAt: new Date(exp).toISOString(),
    role: user.role,
    userId: user.id,
  };
}
