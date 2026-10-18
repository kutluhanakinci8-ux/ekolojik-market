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

function filterAfterClear(items, clearedAt) {
  const t0 = ts(clearedAt);
  if (!t0 || !Array.isArray(items)) return items ?? [];
  return items.filter((row) => ts(row.createdAt) > t0);
}

function mergeStoreProducts(incomingProducts, existingProducts, incomingTs, existingTs) {
  const map = new Map();
  for (const p of existingProducts ?? []) {
    map.set(Number(p.id), p);
  }
  for (const p of incomingProducts ?? []) {
    const id = Number(p.id);
    const prev = map.get(id);
    if (!prev) {
      map.set(id, p);
      continue;
    }
    const nextPriceTs = ts(p.pricingUpdatedAt);
    const prevPriceTs = ts(prev.pricingUpdatedAt);
    if (nextPriceTs > prevPriceTs) map.set(id, p);
    else if (prevPriceTs > nextPriceTs) map.set(id, prev);
    else map.set(id, incomingTs >= existingTs ? p : prev);
  }
  return [...map.values()];
}

function mergePaymentRemindersById(incoming, existing) {
  const map = new Map();
  for (const item of existing ?? []) {
    if (item?.id) map.set(item.id, item);
  }
  for (const item of incoming ?? []) {
    if (!item?.id) continue;
    const prev = map.get(item.id);
    if (!prev || ts(item.updatedAt) >= ts(prev.updatedAt)) {
      map.set(item.id, item);
    }
  }
  return [...map.values()].sort((a, b) => {
    const byDate = String(a.dueDate ?? '').localeCompare(String(b.dueDate ?? ''));
    if (byDate !== 0) return byDate;
    return String(a.title ?? '').localeCompare(String(b.title ?? ''), 'tr');
  });
}

export function mergeIncomingStoreWithExisting(incoming, existing) {
  if (!existing || typeof existing !== 'object') return incoming;
  const clearedAt = existing.settings?.salesHistoryClearedAt ?? incoming.settings?.salesHistoryClearedAt;
  const out = { ...incoming };
  if (clearedAt) {
    out.sales = filterAfterClear(incoming.sales, clearedAt);
    out.saleReturns = filterAfterClear(incoming.saleReturns, clearedAt);
    out.stockMovements = filterAfterClear(incoming.stockMovements, clearedAt);
    if (ts(clearedAt)) out.customerLedger = [];
  }
  if (Array.isArray(out.sales) && Array.isArray(existing.sales)) {
    out.sales = mergeSalesById(out.sales, filterAfterClear(existing.sales, clearedAt));
  }
  if (Array.isArray(out.saleReturns) && Array.isArray(existing.saleReturns)) {
    out.saleReturns = mergeByCreatedAtId(
      out.saleReturns,
      filterAfterClear(existing.saleReturns, clearedAt),
    );
  }
  if (Array.isArray(out.stockMovements) && Array.isArray(existing.stockMovements)) {
    out.stockMovements = mergeStockMovements(
      out.stockMovements,
      filterAfterClear(existing.stockMovements, clearedAt),
    );
  }
  const incomingReminders = incoming.settings?.paymentReminders;
  const existingReminders = existing.settings?.paymentReminders;
  if (Array.isArray(incomingReminders) || Array.isArray(existingReminders)) {
    out.settings = {
      ...(existing.settings ?? {}),
      ...(incoming.settings ?? {}),
      paymentReminders: mergePaymentRemindersById(
        incomingReminders ?? [],
        existingReminders ?? [],
      ),
    };
  }
  if (Array.isArray(incoming.products) && Array.isArray(existing.products)) {
    out.products = mergeStoreProducts(
      incoming.products,
      existing.products,
      ts(incoming.updatedAt),
      ts(existing.updatedAt),
    );
  }
  out.updatedAt = new Date(Math.max(ts(incoming.updatedAt), ts(existing.updatedAt), Date.now())).toISOString();
  return out;
}
