import type { Product } from '../types/product';
import type { ProductSet } from '../types/productSet';
import { foldTurkish } from './productSearch';

export type BarcodeScanFailureReason =
  | 'empty'
  | 'not_found'
  | 'out_of_stock'
  | 'ambiguous'
  | 'inactive_set';

export type BarcodeScanResolveResult =
  | { kind: 'product'; productId: number; label: string }
  | { kind: 'set'; setId: string; label: string }
  | { kind: 'failure'; reason: BarcodeScanFailureReason; message: string };

export type BarcodeScanApplyResult =
  | { ok: true; kind: 'product' | 'set'; label: string; productId?: number; setId?: string }
  | { ok: false; reason: BarcodeScanFailureReason; message: string };

/** Okuyucudan gelen ham metni normalize eder (boşluk, kontrol karakterleri, yaygın önekler). */
export function normalizeBarcodeScanInput(raw: string): string {
  let value = raw.replace(/[\x00-\x1F\x7F]/g, '').trim();
  value = value.replace(/\s+/g, '');
  // Bazı okuyucular GS1 / AIM önek gönderir
  value = value.replace(/^]C1/i, '').replace(/^]E0/i, '').replace(/^]d2/i, '');
  return value;
}

function foldCode(code: string): string {
  return foldTurkish(code).replace(/\s/g, '');
}

function codeVariants(code: string): string[] {
  const base = code.trim();
  if (!base) return [];
  const variants = new Set<string>([base, foldCode(base)]);
  if (/^\d+$/.test(base)) {
    variants.add(base.replace(/^0+/, '') || '0');
    if (base.length === 12) variants.add(`0${base}`);
    if (base.length === 13 && base.startsWith('0')) variants.add(base.slice(1));
    if (base.length === 8) variants.add(base.padStart(13, '0'));
  }
  return [...variants].filter(Boolean);
}

function productCodes(product: Product): string[] {
  const list: string[] = [];
  if (product.barcode?.trim()) list.push(product.barcode.trim());
  if (product.productCode?.trim()) list.push(product.productCode.trim());
  list.push(String(product.id));
  return list;
}

function setCodes(set: ProductSet): string[] {
  const list: string[] = [];
  if (set.stockCode?.trim()) list.push(set.stockCode.trim());
  list.push(set.id);
  return list;
}

function matchesScan(scanVariants: string[], entityVariants: string[]): boolean {
  const foldedScan = new Set(scanVariants.flatMap((v) => [v, foldCode(v)]));
  for (const entity of entityVariants) {
    const ev = [entity, foldCode(entity)];
    for (const s of foldedScan) {
      for (const e of ev) {
        if (s.length > 0 && s === e) return true;
      }
    }
  }
  return false;
}

export function resolveBarcodeScan(
  raw: string,
  products: Product[],
  sets: ProductSet[],
): BarcodeScanResolveResult {
  const normalized = normalizeBarcodeScanInput(raw);
  if (!normalized) {
    return { kind: 'failure', reason: 'empty', message: 'Barkod boş' };
  }

  const scanVariants = codeVariants(normalized);

  const productHits: Product[] = [];
  for (const product of products) {
    if (product.isSample) continue;
    if (matchesScan(scanVariants, productCodes(product))) {
      productHits.push(product);
    }
  }

  const setHits: ProductSet[] = [];
  for (const set of sets) {
    if (!set.isActive) continue;
    if (matchesScan(scanVariants, setCodes(set))) {
      setHits.push(set);
    }
  }

  const totalHits = productHits.length + setHits.length;
  if (totalHits === 0) {
    return {
      kind: 'failure',
      reason: 'not_found',
      message: `Barkod bulunamadı: ${normalized}`,
    };
  }

  if (totalHits > 1) {
    return {
      kind: 'failure',
      reason: 'ambiguous',
      message: 'Birden fazla ürün/set eşleşti — stok kodlarını benzersiz yapın',
    };
  }

  if (productHits.length === 1) {
    const product = productHits[0];
    if (product.stock <= 0) {
      return {
        kind: 'failure',
        reason: 'out_of_stock',
        message: `${product.name} — stok yok`,
      };
    }
    return { kind: 'product', productId: product.id, label: product.name };
  }

  const set = setHits[0];
  if (set.stock <= 0) {
    return {
      kind: 'failure',
      reason: 'out_of_stock',
      message: `${set.name} — set stok yok`,
    };
  }
  return { kind: 'set', setId: set.id, label: set.name };
}

/** Hızlı okuyucu (klavye emülasyonu) — karakterler arası süre eşiği (ms). */
export const BARCODE_WEDGE_MAX_GAP_MS = 90;
export const BARCODE_WEDGE_MIN_LENGTH = 3;
