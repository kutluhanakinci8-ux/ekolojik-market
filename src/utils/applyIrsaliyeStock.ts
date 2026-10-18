import {
  IRSALIYE_LUY2026000000002_ID,
  IRSALIYE_STOCK_BY_CODE,
  IRSALIYE_STOCK_MIGRATION_KEY,
  irsaliyeEanForCode,
} from '../data/irsaliyeLuy2026000000002';
import { WAREHOUSE_STOCK_POLICY } from '../data/warehouseStockPolicy';
import { PRICE_BATCH_1_CODE_BY_PRODUCT_ID } from '../data/priceCatalogBatch1';
import type { Product, StockMovement, StockMovementType } from '../types/product';

export { IRSALIYE_STOCK_MIGRATION_KEY };

const NOTE =
  WAREHOUSE_STOCK_POLICY === 'empty'
    ? 'Depo stok sıfırlama'
    : `e-İrsaliye ${IRSALIYE_LUY2026000000002_ID} depo stoku`;

/**
 * Aktif depo politikasına göre hedef stok adedi.
 * `empty` → her zaman 0; irsaliye modunda kod eşleşmesi gerekir.
 */
export function resolveWarehouseStockForProduct(input: {
  id: number;
  productCode?: string;
  barcode?: string;
}): number {
  if (WAREHOUSE_STOCK_POLICY === 'empty') {
    return 0;
  }
  const code = resolveProductStockCode(input.id, input.productCode);
  if (!code) return 0;
  const qty = IRSALIYE_STOCK_BY_CODE[code];
  if (qty == null) return 0;
  return Math.max(0, Math.floor(qty));
}

export function normalizeStockCode(raw?: string | null): string | undefined {
  const code = raw?.trim().toUpperCase();
  return code || undefined;
}

/** Ürün kartından irsaliye stok kodunu çöz (EAN barkod alanı stok kodu sayılmaz) */
export function resolveProductStockCode(
  productId: number,
  productCode?: string,
): string | undefined {
  return (
    normalizeStockCode(PRICE_BATCH_1_CODE_BY_PRODUCT_ID[productId])
    ?? normalizeStockCode(productCode)
  );
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
    const code = resolveProductStockCode(product.id, product.productCode);
    const ean = code ? irsaliyeEanForCode(code) : undefined;
    const safeTarget = resolveWarehouseStockForProduct({
      id: product.id,
      productCode: code,
      barcode: code,
    });

    const updated: Product = {
      ...product,
      productCode: code ?? product.productCode,
      barcode: ean ?? product.barcode ?? code,
      stock: safeTarget,
    };

    if (updated.stock !== product.stock) {
      movements.push(movementFor(product, product.stock, updated.stock));
    }

    return updated;
  });

  return { products: next, movements };
}

/** Sunucu store.json — stok + EAN barkod eşlemesi */
export function syncIrsaliyeProductFields(products: Product[]): Product[] {
  return applyIrsaliyeStockToProducts(products).products;
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
  const prevById = new Map(snapshot.products.map((p) => [p.id, p]));
  const fieldsChanged = products.some((p) => {
    const prev = prevById.get(p.id);
    if (!prev) return true;
    return prev.stock !== p.stock || prev.barcode !== p.barcode || prev.productCode !== p.productCode;
  });
  if (movements.length === 0 && !fieldsChanged) {
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
