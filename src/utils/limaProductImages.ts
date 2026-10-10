import type { Product } from '../types/product';

/** Lima tenant ürün görselleri — yalnızca bu sunucudaki lima-* dosyaları veya data: URL */
export function resolveLimaProductImagePath(
  product: Pick<Product, 'id' | 'productCode'>,
): string | undefined {
  if (product.productCode?.startsWith('LIMA-') || (product.id >= 1001 && product.id < 2000)) {
    return `/product-images/lima-${product.id}.svg`;
  }
  return undefined;
}

export function isLimaOwnedImageUrl(url?: string | null): boolean {
  if (!url?.trim()) return false;
  if (url.startsWith('data:image/')) return true;
  if (url.includes('/product-images/lima-')) return true;
  return false;
}

/** Greenleaf katalog görseli — Lima snapshot’a yazılmaz */
export function isGreenleafCatalogImageUrl(url?: string | null): boolean {
  if (!url?.trim()) return false;
  if (url.includes('greenleaf')) return true;
  return /\/product-images\/p-\d+/i.test(url);
}
