import knownTenants from '../../config/known-tenants.json';

export const DEFAULT_TENANT_ID = 'main';

export const KNOWN_TENANT_ALLOWLIST: string[] = Array.isArray(knownTenants.allowlist)
  ? knownTenants.allowlist.map((s) => String(s).trim().toLowerCase())
  : ['main', 'lima-market'];

export const KNOWN_STORES = knownTenants.stores ?? [];

/** Giriş formu — boş veya greenleaf → main */
export function normalizeStoreCodeInput(raw: string): string {
  const t = raw.trim().toLowerCase();
  if (!t || t === 'default' || t === 'greenleaf') return DEFAULT_TENANT_ID;
  return t;
}

export function storeCodePlaceholder(): string {
  return 'Kayıt e-postanızdaki mağaza kodu';
}

/**
 * Üretimde yalnızca bilinen kodlar + kayıt sonrası slug uyarısı.
 * null = geçerli.
 */
export function validateStoreCodeForLogin(tenantId: string): string | null {
  const id = normalizeStoreCodeInput(tenantId);
  if (id === DEFAULT_TENANT_ID || KNOWN_TENANT_ALLOWLIST.includes(id)) {
    return null;
  }
  if (import.meta.env.DEV) {
    return null;
  }
  if (!/^[a-z0-9][a-z0-9._-]{1,38}[a-z0-9]$/.test(id) && id.length < 40) {
    return 'Mağaza kodu geçersiz. Varsayılan mağaza için boş bırakın.';
  }
  return 'Bu mağaza kodu tanınmıyor. Kayıt e-postanızdaki mağaza kodunu kullanın veya destek ile iletişime geçin.';
}
