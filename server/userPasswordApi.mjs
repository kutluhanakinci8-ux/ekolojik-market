import { createHash, randomBytes } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { readTenantStore, writeTenantStore } from './tenantAuth.mjs';
import {
  applyVaultToStoreSnapshot,
  mergeUsersIntoVault,
  readCredentialVault,
  writeCredentialVault,
  hydrateStoreWithCredentialVault,
} from './credentialVault.mjs';
function hashPassword(password) {
  return createHash('sha256').update(String(password)).digest('hex');
}

function verifyPassword(password, passwordHash) {
  return Boolean(passwordHash) && hashPassword(password) === passwordHash;
}

function resetTokensPath(dataDir, tenantId) {
  const id = String(tenantId ?? 'main').trim() || 'main';
  return join(dataDir, 'password-reset', `${id}.json`);
}

async function readResetTokens(dataDir, tenantId) {
  const path = resetTokensPath(dataDir, tenantId);
  try {
    const raw = await readFile(path, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.tokens) ? parsed.tokens : [];
  } catch {
    return [];
  }
}

async function writeResetTokens(dataDir, tenantId, tokens) {
  const path = resetTokensPath(dataDir, tenantId);
  await mkdir(join(path, '..'), { recursive: true });
  await writeFile(path, JSON.stringify({ updatedAt: new Date().toISOString(), tokens }, null, 2), 'utf8');
}

async function persistUserPasswordHash(dataDir, tenantId, userId, passwordHash) {
  const raw = await readTenantStore(dataDir, tenantId);
  if (!raw?.users?.length) {
    return { ok: false, status: 404, message: 'Mağaza bulunamadı' };
  }
  const idx = raw.users.findIndex((u) => u.id === userId);
  if (idx < 0) {
    return { ok: false, status: 404, message: 'Kullanıcı bulunamadı' };
  }
  const users = raw.users.map((u, i) => (
    i === idx
      ? { ...u, passwordHash, updatedAt: new Date().toISOString(), mustChangePassword: false }
      : u
  ));
  let vault = await readCredentialVault(dataDir, tenantId);
  vault = mergeUsersIntoVault(vault, users);
  const store = applyVaultToStoreSnapshot(
    { ...raw, users, updatedAt: new Date().toISOString() },
    vault,
  );
  await writeTenantStore(dataDir, tenantId, store);
  await writeCredentialVault(dataDir, tenantId, vault);
  return { ok: true, user: users[idx] };
}

/**
 * @param {object} authPayload — verifyPosApiToken sonucu
 */
export async function handlePatchUserPassword(
  dataDir,
  tenantId,
  userId,
  authPayload,
  { newPassword, currentPassword },
) {
  const actorUserId = authPayload?.userId;
  const actorRole = authPayload?.role;
  const nextPassword = String(newPassword ?? '').trim();
  if (nextPassword.length < 4) {
    return { ok: false, status: 400, message: 'Yeni şifre en az 4 karakter olmalıdır' };
  }

  const { store } = await hydrateStoreWithCredentialVault(
    dataDir,
    tenantId,
    await readTenantStore(dataDir, tenantId),
  );
  const target = store?.users?.find((u) => u.id === userId);
  const actor = store?.users?.find((u) => u.id === actorUserId);
  if (!target) {
    return { ok: false, status: 404, message: 'Kullanıcı bulunamadı' };
  }
  if (!actor) {
    return { ok: false, status: 403, message: 'Oturum geçersiz' };
  }

  const isSelf = actor.id === target.id;
  const isAdmin = actorRole === 'admin';

  if (!isAdmin && !isSelf) {
    return { ok: false, status: 403, message: 'Bu işlem için yetkiniz yok' };
  }
  if (isSelf && !isAdmin && !target.mustChangePassword) {
    const current = String(currentPassword ?? '').trim();
    if (!current) {
      return { ok: false, status: 400, message: 'Mevcut şifrenizi girin' };
    }
    if (!verifyPassword(current, target.passwordHash)) {
      return { ok: false, status: 401, message: 'Mevcut şifre hatalı' };
    }
  }

  const passwordHash = hashPassword(nextPassword);
  const saved = await persistUserPasswordHash(dataDir, tenantId, userId, passwordHash);
  if (!saved.ok) return saved;
  const { passwordHash: _, pinHash, totpSecret, ...publicUser } = saved.user;
  return { ok: true, user: publicUser };
}

export async function handlePasswordResetRequest(dataDir, tenantId, { username, email }) {
  const normalized = String(username ?? '').trim().toLowerCase();
  const { normalizeRecoveryEmail, sendPasswordResetEmail } = await import('./passwordResetMail.mjs');
  const requestedEmail = normalizeRecoveryEmail(email);
  if (!normalized) {
    return { ok: false, status: 400, message: 'Kullanıcı adı gerekli' };
  }
  if (!requestedEmail) {
    return { ok: false, status: 400, message: 'Kayıtlı şifre sıfırlama e-postanızı girin' };
  }

  const genericOk = {
    ok: true,
    message: 'Talep alındı. Bilgiler doğruysa şifre sıfırlama bağlantısı e-postanıza gönderildi.',
  };

  const { store } = await hydrateStoreWithCredentialVault(
    dataDir,
    tenantId,
    await readTenantStore(dataDir, tenantId),
  );
  const user = store?.users?.find((u) => u.username === normalized && u.isActive !== false);
  const registeredEmail = normalizeRecoveryEmail(user?.recoveryEmail);
  if (!user || !registeredEmail || registeredEmail !== requestedEmail) {
    return genericOk;
  }

  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const tokens = (await readResetTokens(dataDir, tenantId)).filter(
    (t) => t.expiresAt > new Date().toISOString(),
  );
  tokens.push({ token, userId: user.id, username: user.username, expiresAt, used: false });
  await writeResetTokens(dataDir, tenantId, tokens.slice(-50));

  const baseUrl = process.env.EKOLOJIK_PUBLIC_BASE_URL?.trim() || 'https://www.ekolojikmarket.com.tr';
  const link = `${baseUrl}/giris?reset=${encodeURIComponent(token)}`;

  const mail = await sendPasswordResetEmail(dataDir, tenantId, {
    to: registeredEmail,
    displayName: user.displayName,
    username: user.username,
    resetLink: link,
    expiresMinutes: 60,
  });
  if (!mail.ok) {
    return { ok: false, status: 502, message: mail.error || 'E-posta gönderilemedi (SMTP kontrol edin)' };
  }
  return genericOk;
}

export async function handlePasswordResetConfirm(dataDir, tenantId, { token, newPassword }) {
  const rawToken = String(token ?? '').trim();
  const nextPassword = String(newPassword ?? '').trim();
  if (!rawToken || nextPassword.length < 4) {
    return { ok: false, status: 400, message: 'Geçersiz sıfırlama bağlantısı veya şifre' };
  }
  const tokens = await readResetTokens(dataDir, tenantId);
  const entry = tokens.find((t) => t.token === rawToken && !t.used && t.expiresAt > new Date().toISOString());
  if (!entry) {
    return { ok: false, status: 400, message: 'Bağlantı geçersiz veya süresi dolmuş' };
  }
  const passwordHash = hashPassword(nextPassword);
  const saved = await persistUserPasswordHash(dataDir, tenantId, entry.userId, passwordHash);
  if (!saved.ok) return saved;
  const next = tokens.map((t) => (t.token === rawToken ? { ...t, used: true } : t));
  await writeResetTokens(dataDir, tenantId, next);
  return { ok: true, message: 'Şifreniz güncellendi. Giriş yapabilirsiniz.' };
}
