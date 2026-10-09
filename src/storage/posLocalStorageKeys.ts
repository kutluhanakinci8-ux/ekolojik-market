import { DEFAULT_TENANT_ID, loadTenantId } from './tenantSession';

const BASE_STORAGE_KEYS = {
  products: 'market-pos-products',
  sales: 'market-pos-sales',
  saleReturns: 'market-pos-sale-returns',
  cart: 'market-pos-cart',
  priceType: 'market-pos-price-type',
  stockMovements: 'market-pos-stock-movements',
  stockInitialized: 'market-pos-stock-initialized',
  customers: 'market-pos-customers',
  expenses: 'market-pos-expenses',
  cashHandovers: 'market-pos-cash-handovers',
  cashSessions: 'market-pos-cash-sessions',
  purchaseInvoices: 'market-pos-purchase-invoices',
  demoVatSeeded: 'market-pos-demo-vat-seeded',
  demoSupplierSeeded: 'market-pos-demo-supplier-seeded',
  settings: 'market-pos-settings',
  users: 'market-pos-users',
  loginAuditLog: 'market-pos-login-audit',
  activityAuditLog: 'market-pos-activity-audit',
  productSets: 'market-pos-product-sets',
} as const;

export type PosLocalStorageKeyId = keyof typeof BASE_STORAGE_KEYS;

export type PosLocalStorageKeys = Record<PosLocalStorageKeyId, string>;

function buildKeys(tenantId: string): PosLocalStorageKeys {
  const suffix = tenantId === DEFAULT_TENANT_ID ? '' : `::${tenantId}`;
  const out = {} as PosLocalStorageKeys;
  for (const [id, base] of Object.entries(BASE_STORAGE_KEYS)) {
    out[id as PosLocalStorageKeyId] = `${base}${suffix}`;
  }
  return out;
}

let activeKeys = buildKeys(loadTenantId());

/** Tarayıcı localStorage anahtarlarını aktif mağaza koduna göre ayır (main vs lima-market). */
export function syncPosLocalStorageKeys(tenantId?: string): void {
  activeKeys = buildKeys(tenantId ?? loadTenantId());
}

export function posLocalStorageKeys(): PosLocalStorageKeys {
  return activeKeys;
}
