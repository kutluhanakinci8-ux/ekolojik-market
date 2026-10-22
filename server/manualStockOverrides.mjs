/**
 * Fiziksel sayım / barkod düzeltmesi — istemci senkronu bu adetleri ezemez.
 * Güncelleme: scripts/fix-carich-cbf014-cbf015-stock.mjs ile uyumlu tutun.
 */
const MANUAL_STOCK_BY_PRODUCT_ID = {
  14: 22, // CBF015 6955470951588
  15: 28, // CBF014 6955470951571
};

export function applyManualStockOverrides(snapshot) {
  if (!snapshot?.products?.length) {
    return { snapshot, changed: false };
  }
  let changed = false;
  const products = snapshot.products.map((product) => {
    const target = MANUAL_STOCK_BY_PRODUCT_ID[product.id];
    if (target == null || product.stock === target) {
      return product;
    }
    changed = true;
    return { ...product, stock: target };
  });
  if (!changed) {
    return { snapshot, changed: false };
  }
  return {
    snapshot: {
      ...snapshot,
      products,
      updatedAt: new Date().toISOString(),
    },
    changed: true,
  };
}
