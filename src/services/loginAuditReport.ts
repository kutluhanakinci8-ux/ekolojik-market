import type { LoginMethod } from '../types/security';
import { loadTenantId } from '../storage/tenantSession';

export type LoginAuditFailureKind =
  | 'wrong_credentials'
  | 'wrong_pin'
  | 'unknown_user'
  | 'account_disabled'
  | 'wrong_2fa'
  | 'browser_lockout'
  | 'invalid_store_code'
  | 'tenant_affinity'
  | 'lifecycle_suspended'
  | 'lifecycle_trial'
  | 'store_missing'
  | 'network_error'
  | 'server_rejected'
  | 'platform_only'
  | 'missing_credentials';

export const LOGIN_AUDIT_KIND_LABELS: Record<string, string> = {
  wrong_credentials: 'Yanlış şifre',
  wrong_pin: 'Yanlış PIN',
  unknown_user: 'Bilinmeyen kullanıcı',
  account_disabled: 'Hesap kilitli',
  wrong_2fa: '2FA hatası',
  browser_lockout: 'Tarayıcı kilidi',
  invalid_store_code: 'Mağaza kodu',
  tenant_affinity: 'Yanlış mağaza',
  lifecycle_suspended: 'Askıda',
  lifecycle_trial: 'Deneme bitti',
  store_missing: 'Mağaza yok',
  network_error: 'Bağlantı',
  server_rejected: 'Sunucu',
  platform_only: 'Platform hesabı',
  missing_credentials: 'Eksik bilgi',
};

export function inferLoginAuditKind(
  failureReason: string | undefined,
  method: LoginMethod = 'password',
): LoginAuditFailureKind {
  const r = (failureReason ?? '').toLowerCase();
  if (r.includes('2fa') || r.includes('doğrulama kodu')) return 'wrong_2fa';
  if (r.includes('hesap kilitli') || r.includes('yönetici')) return 'account_disabled';
  if (r.includes('pin')) return 'wrong_pin';
  if (r.includes('mağaza kodu') || r.includes('tanınmıyor')) return 'invalid_store_code';
  if (r.includes('lima')) return 'tenant_affinity';
  if (r.includes('askıya')) return 'lifecycle_suspended';
  if (r.includes('deneme süresi')) return 'lifecycle_trial';
  if (r.includes('mağaza bulunamadı')) return 'store_missing';
  if (r.includes('bağlanılamadı') || r.includes('ağ')) return 'network_error';
  if (method === 'pin') return 'wrong_pin';
  return 'wrong_credentials';
}

export async function reportLoginAuditToServer(
  tenantId: string,
  payload: {
    username: string;
    failureKind: LoginAuditFailureKind;
    failureReason: string;
    method?: LoginMethod;
    displayName?: string;
    userId?: string;
  },
): Promise<void> {
  const tenant = (tenantId || loadTenantId() || 'main').trim() || 'main';
  const username = payload.username?.trim().toLowerCase();
  if (!username || !payload.failureReason?.trim()) return;

  try {
    const qs = tenant === 'main' ? '' : `?tenant=${encodeURIComponent(tenant)}`;
    await fetch(`/api/auth/login-audit${qs}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        username,
        failureKind: payload.failureKind,
        failureReason: payload.failureReason.slice(0, 240),
        method: payload.method ?? 'password',
        displayName: payload.displayName,
        userId: payload.userId,
      }),
    });
  } catch {
    /* operatör kaydı — sessiz */
  }
}
