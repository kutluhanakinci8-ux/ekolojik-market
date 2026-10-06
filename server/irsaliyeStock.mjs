/**
 * LUY2026000000002 irsaliye stok kodu → adet (Node sunucu migrasyonu ile paylaşılır)
 * Kaynak: src/data/irsaliyeLuy2026000000002.ts — güncellerken senkron tutun
 *
 * `empty` = tüm stoklar 0; irsaliye girişi için `irsaliye-luy2026000000002` yapın
 * (src/data/warehouseStockPolicy.ts ile aynı mantık).
 */
export const WAREHOUSE_STOCK_POLICY = 'irsaliye-luy2026000000002';

export const IRSALIYE_STOCK_BY_CODE = {
  ASF066: 96,
  CAA039: 20,
  FPA151: 40,
  DAB089: 75,
  LGI019: 12,
  YBA045: 20,
  EAA022: 24,
  CAB040: 20,
  CAA038: 20,
  KLA128: 27,
  CEA069: 30,
  SAA069: 24,
  ASA086: 20,
  ASA017: 20,
  SBJ064: 48,
  SBC053: 30,
  EBB018: 20,
  CCA016: 96,
  CBA052: 20,
  DAA109: 20,
  CBF015: 36,
  CBF014: 36,
  DAC056: 16,
  DAB087: 60,
  DAA108: 40,
  DAA062: 61,
  CBE034: 48,
  ASF055: 47,
  ASF054: 8,
  ASF053: 27,
  ASB047: 40,
  ASB046: 75,
  ASB045: 120,
  ASB044: 30,
  SBE089: 6,
};

/** Batch-1 ürün ID → stok kodu */
export const PRICE_BATCH_1_CODE_BY_PRODUCT_ID = {
  1: 'ASF066',
  2: 'CCC001',
  3: 'CCC029',
  4: 'YBA045',
  5: 'EAA022',
  6: 'CAB040',
  7: 'CAA038',
  8: 'KLA128',
  9: 'CEA069',
  10: 'SAA069',
  11: 'ASA086',
  12: 'ASF053',
  13: 'DAA109',
  14: 'CBF015',
  15: 'CBF014',
  16: 'DAB087',
  17: 'DAA108',
  18: 'DAC056',
  19: 'DAA062',
  20: 'CBE034',
  21: 'ASF055',
  22: 'ASF054',
  23: 'ASA017',
  24: 'ASB047',
  25: 'ASB045',
  26: 'ASB044',
  27: 'ASB046',
  28: 'CAA039',
  29: 'FPA151',
  30: 'DAB089',
  31: 'LGI019',
  32: 'SBJ064',
  33: 'SBC053',
  34: 'EBB018',
  35: 'CCA016',
  36: 'CBA052',
};

function normalizeCode(raw) {
  const code = String(raw ?? '').trim().toUpperCase();
  return code || undefined;
}

export function resolveProductStockCode(productId, productCode, barcode) {
  return (
    normalizeCode(PRICE_BATCH_1_CODE_BY_PRODUCT_ID[productId])
    ?? normalizeCode(productCode)
    ?? normalizeCode(barcode)
  );
}

export function resolveWarehouseStock(productId, productCode, barcode) {
  if (WAREHOUSE_STOCK_POLICY === 'empty') {
    return 0;
  }
  const code = resolveProductStockCode(productId, productCode, barcode);
  if (!code) return 0;
  const qty = IRSALIYE_STOCK_BY_CODE[code];
  if (qty == null) return 0;
  return Math.max(0, Math.floor(qty));
}

export function applyIrsaliyeStockToStoreSnapshot(snapshot) {
  if (!snapshot?.products?.length) {
    return { snapshot, changed: false };
  }

  let changed = false;
  const products = snapshot.products.map((product) => {
    const code = resolveProductStockCode(product.id, product.productCode, product.barcode);
    const stock = resolveWarehouseStock(product.id, code, code);
    const next = {
      ...product,
      stock,
      productCode: product.productCode || code,
      barcode: product.barcode || code,
    };
    if (next.stock !== product.stock || next.productCode !== product.productCode || next.barcode !== product.barcode) {
      changed = true;
    }
    return next;
  });

  if (!changed) {
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
