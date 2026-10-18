import type { Product } from '../types/product';

export function isSampleProduct(product: Product): boolean {
  return Boolean(product.isSample);
}

export function getSampleStock(product: Product): number {
  return product.sampleStock ?? 0;
}

/** Örnek numune ürün varsayılanları (demo) */
export const SAMPLE_PRODUCT_DEFAULTS: Record<number, { sampleStock: number }> = {
  2: { sampleStock: 10 },
};
