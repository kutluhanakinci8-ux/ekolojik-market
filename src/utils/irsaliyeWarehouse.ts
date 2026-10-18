import {
  IRSALIYE_LUY2026000000002_ID,
  IRSALIYE_STOCK_BY_CODE,
} from '../data/irsaliyeLuy2026000000002';
import { PRICE_CATALOG_BY_CODE } from '../data/priceCatalogBatch1';
import type { Product } from '../types/product';
import type { AppSettings } from '../types/business';
import { resolveProductStockCode } from './applyIrsaliyeStock';
import { isTenantCatalogIsolated } from './tenantCatalogIsolation';

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

/** Stok ekranı / depo: yalnızca irsaliyede stok kodu olan kartlar */
export function getIrsaliyeWarehouseProducts(products: Product[]): Product[] {
  return products.filter(isIrsaliyeWarehouseProduct);
}

/** POS Lite / Lima — tüm tenant ürünleri; main — irsaliye depo listesi */
export function getStockCatalogProducts(
  products: Product[],
  settings?: AppSettings | null,
): Product[] {
  if (isTenantCatalogIsolated(undefined, settings)) {
    return products;
  }
  return getIrsaliyeWarehouseProducts(products);
}

export function getStockCatalogMetrics(
  products: Product[],
  lowStockThreshold: number,
  settings?: AppSettings | null,
): {
  products: Product[];
  totalStockUnits: number;
  lowStockCount: number;
  outOfStockCount: number;
  inStockCount: number;
  healthPercent: number;
} {
  const catalogProducts = getStockCatalogProducts(products, settings);
  const totalStockUnits = catalogProducts.reduce((sum, p) => sum + p.stock, 0);
  const lowStockCount = catalogProducts.filter(
    (p) => p.stock > 0 && p.stock <= lowStockThreshold,
  ).length;
  const outOfStockCount = catalogProducts.filter((p) => p.stock <= 0).length;
  const inStockCount = catalogProducts.length - outOfStockCount;
  const healthPercent =
    catalogProducts.length === 0
      ? 0
      : Math.round((inStockCount / catalogProducts.length) * 100);

  return {
    products: catalogProducts,
    totalStockUnits,
    lowStockCount,
    outOfStockCount,
    inStockCount,
    healthPercent,
  };
}

export function getIrsaliyeWarehouseStockMetrics(
  products: Product[],
  lowStockThreshold: number,
): {
  products: Product[];
  totalStockUnits: number;
  lowStockCount: number;
  outOfStockCount: number;
  inStockCount: number;
  healthPercent: number;
} {
  const warehouseProducts = getIrsaliyeWarehouseProducts(products);
  const totalStockUnits = warehouseProducts.reduce((sum, p) => sum + p.stock, 0);
  const lowStockCount = warehouseProducts.filter(
    (p) => p.stock > 0 && p.stock <= lowStockThreshold,
  ).length;
  const outOfStockCount = warehouseProducts.filter((p) => p.stock <= 0).length;
  const inStockCount = warehouseProducts.length - outOfStockCount;
  const healthPercent =
    warehouseProducts.length === 0
      ? 0
      : Math.round((inStockCount / warehouseProducts.length) * 100);

  return {
    products: warehouseProducts,
    totalStockUnits,
    lowStockCount,
    outOfStockCount,
    inStockCount,
    healthPercent,
  };
}

export { IRSALIYE_LUY2026000000002_ID };
