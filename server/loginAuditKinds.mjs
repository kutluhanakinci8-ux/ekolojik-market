/** Giriş denetim kaydı — operatör paneli için sabit hata sınıfları */

export const LOGIN_AUDIT_KINDS = {
  WRONG_CREDENTIALS: 'wrong_credentials',
  WRONG_PIN: 'wrong_pin',
  UNKNOWN_USER: 'unknown_user',
  ACCOUNT_DISABLED: 'account_disabled',
  WRONG_2FA: 'wrong_2fa',
  BROWSER_LOCKOUT: 'browser_lockout',
  INVALID_STORE_CODE: 'invalid_store_code',
  TENANT_AFFINITY: 'tenant_affinity',
  LIFECYCLE_SUSPENDED: 'lifecycle_suspended',
  LIFECYCLE_TRIAL: 'lifecycle_trial',
  STORE_MISSING: 'store_missing',
  NETWORK_ERROR: 'network_error',
  SERVER_REJECTED: 'server_rejected',
  PLATFORM_ONLY: 'platform_only',
  MISSING_CREDENTIALS: 'missing_credentials',
};

/** İstemci POST /api/auth/login-audit — yalnızca sunucuya gitmeyen olaylar */
export const CLIENT_REPORTABLE_KINDS = new Set([
  LOGIN_AUDIT_KINDS.WRONG_2FA,
  LOGIN_AUDIT_KINDS.BROWSER_LOCKOUT,
  LOGIN_AUDIT_KINDS.INVALID_STORE_CODE,
  LOGIN_AUDIT_KINDS.ACCOUNT_DISABLED,
  LOGIN_AUDIT_KINDS.NETWORK_ERROR,
  LOGIN_AUDIT_KINDS.SERVER_REJECTED,
]);

export const LOGIN_AUDIT_KIND_LABELS = {
  [LOGIN_AUDIT_KINDS.WRONG_CREDENTIALS]: 'Yanlış şifre',
  [LOGIN_AUDIT_KINDS.WRONG_PIN]: 'Yanlış PIN',
  [LOGIN_AUDIT_KINDS.UNKNOWN_USER]: 'Bilinmeyen kullanıcı',
  [LOGIN_AUDIT_KINDS.ACCOUNT_DISABLED]: 'Hesap kilitli',
  [LOGIN_AUDIT_KINDS.WRONG_2FA]: '2FA hatası',
  [LOGIN_AUDIT_KINDS.BROWSER_LOCKOUT]: 'Tarayıcı kilidi',
  [LOGIN_AUDIT_KINDS.INVALID_STORE_CODE]: 'Mağaza kodu',
  [LOGIN_AUDIT_KINDS.TENANT_AFFINITY]: 'Yanlış mağaza',
  [LOGIN_AUDIT_KINDS.LIFECYCLE_SUSPENDED]: 'Askıda',
  [LOGIN_AUDIT_KINDS.LIFECYCLE_TRIAL]: 'Deneme bitti',
  [LOGIN_AUDIT_KINDS.STORE_MISSING]: 'Mağaza yok',
  [LOGIN_AUDIT_KINDS.NETWORK_ERROR]: 'Bağlantı',
  [LOGIN_AUDIT_KINDS.SERVER_REJECTED]: 'Sunucu',
  [LOGIN_AUDIT_KINDS.PLATFORM_ONLY]: 'Platform hesabı',
  [LOGIN_AUDIT_KINDS.MISSING_CREDENTIALS]: 'Eksik bilgi',
};

export function lifecycleKindFromMessage(message) {
  const text = String(message ?? '');
  if (text.includes('askıya alındı')) return LOGIN_AUDIT_KINDS.LIFECYCLE_SUSPENDED;
  if (text.includes('Deneme süresi')) return LOGIN_AUDIT_KINDS.LIFECYCLE_TRIAL;
  return LOGIN_AUDIT_KINDS.SERVER_REJECTED;
}
