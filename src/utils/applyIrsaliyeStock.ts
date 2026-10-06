import {
  IRSALIYE_LUY2026000000002_ID,
  IRSALIYE_STOCK_BY_CODE,
} from '../data/irsaliyeLuy2026000000002';
import { PRICE_BATCH_1_BY_PRODUCT_ID } from '../data/priceCatalogBatch1';
import type { Product, StockMovement, StockMovementType } from '../types/product';

const NOTE = `e-İrsaliye ${IRSALIYE_LUY2026000000002_ID} stok girişi`;

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

/** Batch-1 ürünlerinde irsaliye adetlerini uygular; eşleşmeyen ürünlere dokunmaz */
export function applyIrsaliyeStockToProducts(products: Product[]): {
  products: Product[];
  movements: StockMovement[];
} {
  const movements: StockMovement[] = [];
  const next = products.map((product) => {
    const catalogEntry = PRICE_BATCH_1_BY_PRODUCT_ID[product.id];
    if (!catalogEntry) return product;

    const target = IRSALIYE_STOCK_BY_CODE[catalogEntry.code];
    if (target == null) return product;

    const safeTarget = Math.max(0, Math.floor(target));
    if (product.stock === safeTarget) return product;

    movements.push(movementFor(product, product.stock, safeTarget));
    return { ...product, stock: safeTarget };
  });

  return { products: next, movements };
}
