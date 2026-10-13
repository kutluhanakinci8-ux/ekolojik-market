import { loadTenantId } from '../storage/tenantSession';
import { posApiAuthHeaders, posApiFetch } from './posApiAuth';

function tenantQuery(): string {
  const tenant = loadTenantId();
  if (!tenant || tenant === 'main') return '';
  return `?tenant=${encodeURIComponent(tenant)}`;
}

export async function patchUserPassword(
  userId: string,
  newPassword: string,
  currentPassword?: string,
): Promise<{ ok: boolean; message?: string }> {
  try {
    const res = await posApiFetch(`/api/users/${encodeURIComponent(userId)}/password${tenantQuery()}`, {
      method: 'PATCH',
      headers: posApiAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        newPassword: newPassword.trim(),
        currentPassword: currentPassword?.trim() || undefined,
      }),
    });
    const data = (await res.json()) as { ok?: boolean; message?: string };
    if (!res.ok || !data.ok) {
      return { ok: false, message: data.message ?? 'Şifre güncellenemedi' };
    }
    return { ok: true };
  } catch {
    return { ok: false, message: 'Sunucuya bağlanılamadı' };
  }
}

export async function requestPasswordResetEmail(
  username: string,
  email: string,
): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch(`/api/auth/password-reset-request${tenantQuery()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ username: username.trim(), email: email.trim() }),
    });
    const data = (await res.json()) as { ok?: boolean; message?: string };
    return {
      ok: Boolean(data.ok),
      message: data.message ?? (data.ok ? 'E-posta gönderildi' : 'İşlem başarısız'),
    };
  } catch {
    return { ok: false, message: 'Sunucuya bağlanılamadı' };
  }
}

export async function confirmPasswordReset(
  token: string,
  newPassword: string,
): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch(`/api/auth/password-reset-confirm${tenantQuery()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ token, newPassword: newPassword.trim() }),
    });
    const data = (await res.json()) as { ok?: boolean; message?: string };
    return {
      ok: Boolean(data.ok),
      message: data.message ?? (data.ok ? 'Şifre güncellendi' : 'İşlem başarısız'),
    };
  } catch {
    return { ok: false, message: 'Sunucuya bağlanılamadı' };
  }
}
