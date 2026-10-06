import {
  IRSALIYE_LUY2026000000002_ID,
  IRSALIYE_STOCK_BY_CODE,
} from '../data/irsaliyeLuy2026000000002';
import { PRICE_CATALOG_BY_CODE } from '../data/priceCatalogBatch1';
import type { Product } from '../types/product';
import { resolveProductStockCode } from './applyIrsaliyeStock';

/** PDF’teki satır sayısı (aynı stok kodu birden fazla satırda gelebilir) */
export const IRSALIYE_PDF_LINE_COUNT = 39;

export const IRSALIYE_WAREHOUSE_CODE_COUNT = Object.keys(IRSALIYE_STOCK_BY_CODE).length;

export const IRSALIYE_WAREHOUSE_UNIT_TOTAL = Object.values(IRSALIYE_STOCK_BY_CODE).reduce(
  (sum, qty) => sum + qty,
  0,
);

/** İrsaliyede adet var ama POS katalog kartı henüz yok (ör. SBE089) */
export const IRSALIYE_CODES_WITHOUT_PRODUCT = Object.keys(IRSALIYE_STOCK_BY_CODE).filter(
  (code) => !PRICE_CATALOG_BY_CODE[code],
);

export function irsaliyeStockForProduct(product: Pick<Product, 'id' | 'productCode'>): number | undefined {
  const code = resolveProductStockCode(product.id, product.productCode);
  if (!code) return undefined;
  const qty = IRSALIYE_STOCK_BY_CODE[code];
  return qty == null ? undefined : qty;
}

export function isIrsaliyeWarehouseProduct(product: Pick<Product, 'id' | 'productCode'>): boolean {
  return irsaliyeStockForProduct(product) != null;
}

export function countIrsaliyeWarehouseProducts(products: Product[]): number {
  return products.filter(isIrsaliyeWarehouseProduct).length;
}

export { IRSALIYE_LUY2026000000002_ID };
