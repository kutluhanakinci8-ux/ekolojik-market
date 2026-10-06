import manifest from './productImageManifest.json';

export const PRODUCT_IMAGE_PATHS: Record<number, string> = manifest;

export function getCatalogImagePath(productId: number): string | undefined {
  return PRODUCT_IMAGE_PATHS[productId];
}
