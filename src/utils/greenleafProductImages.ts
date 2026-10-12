import { isGreenleafCatalogImageUrl } from './limaProductImages';

/** Greenleaf (main): kullanıcının yüklediği veya özelleştirdiği görsel — sunucuya yazılır */
export function isGreenleafPersistedImageUrl(url?: string | null): boolean {
  if (!url?.trim()) return false;
  if (url.startsWith('data:image/')) return true;
  if (isGreenleafCatalogImageUrl(url)) return false;
  if (/^\/product-images\/p-\d+/i.test(url.trim())) return false;
  if (/\/product-images\/lima-/i.test(url)) return false;
  return true;
}
