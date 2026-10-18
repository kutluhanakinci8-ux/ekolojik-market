/**
 * Depo stok kaynağı.
 * - `empty`: Tüm ürün stokları 0 (irsaliye girişi öncesi).
 * - `irsaliye-luy2026000000002`: LUY irsaliye adetleri otomatik uygulanır.
 */
export type WarehouseStockPolicy = 'empty' | 'irsaliye-luy2026000000002';

/** İrsaliye LUY2026000000002 adetleri otomatik uygulanır (barkod = stok kodu) */
export const WAREHOUSE_STOCK_POLICY: WarehouseStockPolicy = 'irsaliye-luy2026000000002';
