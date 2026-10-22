/**
 * Tamamlanmış satışlar için eksik stok düşümü + hareket fişi (idempotent).
 * Sunucu okuma / kayıt ve istemci PUT öncesi birleştirmede kullanılır.
 */

function movementKey(saleId, productId) {
  return `${saleId}::p${productId}`;
}

function createSaleMovement(product, saleId, quantity, previousStock, newStock) {
  return {
    id: `M-reconcile-${saleId}-${product.id}-${Math.random().toString(36).slice(2, 7)}`,
    productId: product.id,
    productName: product.name,
    type: 'sale',
    quantity,
    previousStock,
    newStock,
    note: `Satış (otomatik düzeltme) — ${saleId}`,
    saleId,
    createdAt: new Date().toISOString(),
  };
}

/**
 * @param {object} snapshot store snapshot (products, sales, stockMovements, productSets?)
 * @returns {{ snapshot: object, changed: boolean }}
 */
export function reconcileSaleStockInSnapshot(snapshot) {
  if (!snapshot?.products?.length || !snapshot?.sales?.length) {
    return { snapshot, changed: false };
  }

  const sales = [...snapshot.sales].sort(
    (a, b) => Date.parse(a.createdAt ?? 0) - Date.parse(b.createdAt ?? 0),
  );
  const movements = [...(snapshot.stockMovements ?? [])];
  const indexed = new Set(
    movements
      .filter((m) => m.saleId && m.productId != null)
      .map((m) => movementKey(m.saleId, m.productId)),
  );

  const products = snapshot.products.map((p) => ({ ...p }));
  const byId = new Map(products.map((p) => [Number(p.id), p]));

  let addedMovements = 0;

  for (const sale of sales) {
    if (sale.status && sale.status !== 'completed') continue;
    const qtyByProduct = new Map();
    for (const item of sale.items ?? []) {
      if (item.priceType === 'sample') continue;
      const pid = Number(item.productId);
      if (!pid) continue;
      qtyByProduct.set(pid, (qtyByProduct.get(pid) ?? 0) + (Number(item.quantity) || 0));
    }
    for (const [productId, qty] of qtyByProduct) {
      if (qty <= 0) continue;
      const key = movementKey(sale.id, productId);
      if (indexed.has(key)) continue;
      const product = byId.get(productId);
      if (!product) continue;
      const prev = Number(product.stock) || 0;
      const next = Math.max(0, prev - qty);
      movements.unshift(createSaleMovement(product, sale.id, qty, prev, next));
      product.stock = next;
      indexed.add(key);
      addedMovements += 1;
    }
  }

  if (addedMovements === 0) {
    return { snapshot, changed: false };
  }

  return {
    snapshot: {
      ...snapshot,
      products,
      stockMovements: movements,
      updatedAt: new Date().toISOString(),
    },
    changed: true,
  };
}
