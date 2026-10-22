import type { Product, StockMovement } from '../types/product';
import type { PersistedStoreSnapshot } from '../types/persistedStore';

function movementKey(saleId: string, productId: number): string {
  return `${saleId}::p${productId}`;
}

function createSaleMovement(
  product: Product,
  saleId: string,
  quantity: number,
  previousStock: number,
  newStock: number,
): StockMovement {
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

export function reconcileSaleStockInSnapshot(
  snapshot: PersistedStoreSnapshot,
): { snapshot: PersistedStoreSnapshot; changed: boolean } {
  if (!snapshot.products?.length || !snapshot.sales?.length) {
    return { snapshot, changed: false };
  }

  const sales = [...snapshot.sales].sort(
    (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt),
  );
  const movements = [...(snapshot.stockMovements ?? [])];
  const indexed = new Set(
    movements
      .filter((m) => m.saleId && m.productId != null)
      .map((m) => movementKey(m.saleId!, Number(m.productId))),
  );

  const products = snapshot.products.map((p) => ({ ...p }));
  const byId = new Map(products.map((p) => [p.id, p]));

  let addedMovements = 0;

  for (const sale of sales) {
    if (sale.status && sale.status !== 'completed') continue;
    const qtyByProduct = new Map<number, number>();
    for (const item of sale.items ?? []) {
      if (item.priceType === 'sample') continue;
      const pid = item.productId;
      if (pid == null) continue;
      qtyByProduct.set(pid, (qtyByProduct.get(pid) ?? 0) + item.quantity);
    }
    for (const [productId, qty] of qtyByProduct) {
      if (qty <= 0) continue;
      const key = movementKey(sale.id, productId);
      if (indexed.has(key)) continue;
      const product = byId.get(productId);
      if (!product) continue;
      const prev = product.stock;
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
