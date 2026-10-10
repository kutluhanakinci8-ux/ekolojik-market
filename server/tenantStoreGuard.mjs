/** POS Lite / ayrı tenant — main (Greenleaf) seed verisinin yazılmasını engelle */
const MAIN_DEMO_USERNAMES = new Set(['yonetici', 'kasiyer']);
const MAIN_GREENLEAF_CATALOG_MIN = 30;

function isPosLiteStore(store) {
  return store?.settings?.productProfile === 'pos-lite';
}

function isIsolatedTenant(tenantId) {
  return Boolean(tenantId && tenantId !== 'main');
}

/** main demo kataloğu (id 1–200) — Lima vb. tenant’lara karışmamalı */
function looksLikeGreenleafBulk(products) {
  if (!Array.isArray(products) || products.length < MAIN_GREENLEAF_CATALOG_MIN) return false;
  let seedish = 0;
  for (const p of products) {
    const id = Number(p?.id);
    if (id >= 1 && id <= 200) seedish += 1;
  }
  if (products.length >= 80 && seedish / products.length >= 0.75) return true;
  if (products.length >= MAIN_GREENLEAF_CATALOG_MIN && seedish === products.length) return true;
  return false;
}

/**
 * GET /api/data — istemciye Greenleaf demo listesi gönderilmez.
 * @param {string} tenantId
 * @param {object|null} store
 */
/** Set kalemleri tenant kataloğunda yoksa (Greenleaf setleri) gösterilmez */
export function filterProductSetsForCatalog(products, productSets) {
  if (!Array.isArray(productSets) || productSets.length === 0) return [];
  const ids = new Set((products ?? []).map((p) => Number(p?.id)));
  if (ids.size === 0) return [];
  return productSets.filter((set) => {
    const items = set?.items ?? [];
    if (!items.length) return false;
    return items.every((line) => ids.has(Number(line?.productId)));
  });
}

export function sanitizeIsolatedTenantStoreRead(tenantId, store) {
  if (!isIsolatedTenant(tenantId) || !store || typeof store !== 'object') return store;
  let next = store;
  const products = store.products;
  if (looksLikeGreenleafBulk(products)) {
    next = { ...next, products: [] };
  }
  const sets = filterProductSetsForCatalog(next.products, next.productSets);
  if (sets.length !== (next.productSets?.length ?? 0)) {
    next = { ...next, productSets: sets };
  }
  return next;
}

/**
 * @param {string} tenantId
 * @param {object|null} existing
 * @param {object} incoming
 */
export function guardIsolatedTenantStoreWrite(tenantId, existing, incoming) {
  if (!isIsolatedTenant(tenantId)) return incoming;

  const out = { ...incoming };
  const existingUsernames = new Set((existing?.users ?? []).map((u) => String(u.username)));

  if (Array.isArray(out.users)) {
    out.users = out.users.filter((u) => {
      const name = String(u.username ?? '');
      if (existingUsernames.has(name)) return true;
      if (MAIN_DEMO_USERNAMES.has(name)) return false;
      return true;
    });
  }

  if (Array.isArray(out.products) && looksLikeGreenleafBulk(out.products)) {
    const hadClean = (existing?.products?.length ?? 0) > 0
      && !looksLikeGreenleafBulk(existing.products);
    out.products = hadClean ? existing.products : [];
  }

  return out;
}

export function shouldSkipIrsaliyeStockMigration(tenantId, store) {
  if (tenantId && tenantId !== 'main') return true;
  if (isPosLiteStore(store)) return true;
  return false;
}
