import { irsaliyeEanForCode } from '../data/irsaliyeLuy2026000000002';
import type { Product } from '../types/product';

/** Satış / barkod: kayıtlı barkod veya irsaliye EAN-13 */
export function resolveSaleBarcode(
  product: Pick<Product, 'barcode' | 'productCode'>,
): string | undefined {
  const explicit = product.barcode?.trim();
  if (explicit) return explicit;
  const fromCode = irsaliyeEanForCode(product.productCode);
  if (fromCode) return fromCode;
  return product.productCode?.trim() || undefined;
}

export function isLikelyBarcodeInput(raw: string): boolean {
  const normalized = raw.replace(/\s/g, '');
  return /^\d{8,14}$/.test(normalized);
}
