/**
 * Çoklu sekme / kasa — PUT öncesi satış kayıtlarını birleştir (son yazan eski satışları silmesin).
 */

function ts(iso) {
  if (!iso) return 0;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
}

function mergeSalesById(local, remote) {
  const map = new Map();
  for (const s of remote ?? []) map.set(s.id, s);
  for (const s of local ?? []) {
    const prev = map.get(s.id);
    if (!prev || ts(s.createdAt) >= ts(prev.createdAt)) map.set(s.id, s);
  }
  return [...map.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function mergeByCreatedAtId(local, remote) {
  const map = new Map();
  for (const s of remote ?? []) map.set(s.id, s);
  for (const s of local ?? []) {
    const prev = map.get(s.id);
    if (!prev || ts(s.createdAt) >= ts(prev.createdAt)) map.set(s.id, s);
  }
  return [...map.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function mergeStockMovements(local, remote) {
  const map = new Map();
  for (const m of remote ?? []) map.set(m.id, m);
  for (const m of local ?? []) {
    const prev = map.get(m.id);
    if (!prev || ts(m.createdAt) >= ts(prev.createdAt)) map.set(m.id, m);
  }
  return [...map.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function mergeIncomingStoreWithExisting(incoming, existing) {
  if (!existing || typeof existing !== 'object') return incoming;
  const out = { ...incoming };
  if (Array.isArray(incoming.sales) && Array.isArray(existing.sales)) {
    out.sales = mergeSalesById(incoming.sales, existing.sales);
  }
  if (Array.isArray(incoming.saleReturns) && Array.isArray(existing.saleReturns)) {
    out.saleReturns = mergeByCreatedAtId(incoming.saleReturns, existing.saleReturns);
  }
  if (Array.isArray(incoming.stockMovements) && Array.isArray(existing.stockMovements)) {
    out.stockMovements = mergeStockMovements(incoming.stockMovements, existing.stockMovements);
  }
  out.updatedAt = new Date(Math.max(ts(incoming.updatedAt), ts(existing.updatedAt), Date.now())).toISOString();
  return out;
}
