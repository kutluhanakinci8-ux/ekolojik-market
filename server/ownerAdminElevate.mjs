/** Sunucu store.json — mağaza sahibi yükseltmesi (platform operatörleri store içinde değil) */
const OWNER_USERNAMES = new Set([]);

const ALL_APP_PAGES = [
  'dashboard',
  'sales',
  'stock',
  'reports',
  'accounting',
  'transactions',
  'customers',
  'cashier',
  'posta',
  'settings',
];

export function elevateOwnerAdminsInStore(store) {
  if (!store?.users?.length) return { store, changed: false };
  const now = new Date().toISOString();
  let changed = false;
  const users = store.users.map((raw) => {
    const username = String(raw.username ?? '').trim().toLowerCase();
    if (!OWNER_USERNAMES.has(username)) return raw;
    changed = true;
    return {
      ...raw,
      role: 'admin',
      allowedTabs: ALL_APP_PAGES,
      isActive: raw.isActive !== false,
      updatedAt: now,
    };
  });
  if (!changed) return { store, changed: false };
  return { store: { ...store, users, updatedAt: now }, changed: true };
}
