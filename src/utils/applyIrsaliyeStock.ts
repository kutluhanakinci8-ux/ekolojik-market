import {
  IRSALIYE_LUY2026000000002_ID,
  IRSALIYE_STOCK_BY_CODE,
  IRSALIYE_STOCK_MIGRATION_KEY,
} from '../data/irsaliyeLuy2026000000002';
import { PRICE_BATCH_1_CODE_BY_PRODUCT_ID } from '../data/priceCatalogBatch1';
import type { Product, StockMovement, StockMovementType } from '../types/product';

export { IRSALIYE_STOCK_MIGRATION_KEY };

const NOTE = `e-İrsaliye ${IRSALIYE_LUY2026000000002_ID} depo stoku`;

export function normalizeStockCode(raw?: string | null): string | undefined {
  const code = raw?.trim().toUpperCase();
  return code || undefined;
}

/** Ürün kartından irsaliye stok kodunu çöz (önce batch-1 ID eşlemesi, sonra kayıtlı barkod) */
export function resolveProductStockCode(
  productId: number,
  productCode?: string,
  barcode?: string,
): string | undefined {
  return (
    normalizeStockCode(PRICE_BATCH_1_CODE_BY_PRODUCT_ID[productId])
    ?? normalizeStockCode(productCode)
    ?? normalizeStockCode(barcode)
  );
}

/**
 * Depo gerçeği: irsaliyede olan kod → irsaliye adedi; irsaliyede yok → 0.
 * Eski localStorage / sunucu stokları her yüklemede override edilir.
 */
export function resolveWarehouseStockForProduct(input: {
  id: number;
  productCode?: string;
  barcode?: string;
}): number {
  const code = resolveProductStockCode(input.id, input.productCode, input.barcode);
  if (!code) return 0;
  const qty = IRSALIYE_STOCK_BY_CODE[code];
  if (qty == null) return 0;
  return Math.max(0, Math.floor(qty));
}

function movementFor(
  product: Product,
  previousStock: number,
  newStock: number,
): StockMovement {
  const delta = newStock - previousStock;
  const type: StockMovementType = delta >= 0 ? 'in' : 'out';
  return {
    id: `M${Date.now()}-${product.id}-${Math.random().toString(36).slice(2, 7)}`,
    productId: product.id,
    productName: product.name,
    type,
    quantity: Math.abs(delta),
    previousStock,
    newStock,
    note: NOTE,
    createdAt: new Date().toISOString(),
  };
}

export function applyIrsaliyeStockToProducts(products: Product[]): {
  products: Product[];
  movements: StockMovement[];
} {
  const movements: StockMovement[] = [];
  const next = products.map((product) => {
    const code = resolveProductStockCode(product.id, product.productCode, product.barcode);
    const safeTarget = resolveWarehouseStockForProduct({
      id: product.id,
      productCode: code,
      barcode: code,
    });

    const withCodes =
      code && !product.productCode
        ? { ...product, productCode: code, barcode: product.barcode || code }
        : product;

    if (withCodes.stock === safeTarget) return withCodes;

    movements.push(movementFor(withCodes, withCodes.stock, safeTarget));
    return { ...withCodes, stock: safeTarget };
  });

  return { products: next, movements };
}

/** Sunucu store.json — products dizisini irsaliyeye göre düzeltir */
export function applyIrsaliyeStockToStoreSnapshot(snapshot: {
  products?: Product[];
  updatedAt?: string;
}): { snapshot: typeof snapshot; changed: boolean } {
  if (!snapshot?.products?.length) {
    return { snapshot, changed: false };
  }
  const { products, movements } = applyIrsaliyeStockToProducts(snapshot.products);
  if (movements.length === 0) {
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

export function totalIrsaliyeWarehouseUnits(): number {
  return Object.values(IRSALIYE_STOCK_BY_CODE).reduce((sum, qty) => sum + qty, 0);
}
