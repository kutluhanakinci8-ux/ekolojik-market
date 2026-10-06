/**
 * Depo stok kaynağı.
 * - `empty`: Tüm ürün stokları 0 (irsaliye girişi öncesi).
 * - `irsaliye-luy2026000000002`: LUY irsaliye adetleri otomatik uygulanır.
 */
export type WarehouseStockPolicy = 'empty' | 'irsaliye-luy2026000000002';

/** İrsaliye ile tek tek giriş yapılacaksa önce `empty` bırakın */
export const WAREHOUSE_STOCK_POLICY: WarehouseStockPolicy = 'empty';
