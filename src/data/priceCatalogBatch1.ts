import type { PriceCatalogEntry } from '../utils/productPricing';
import { entryFromPurchasePrice } from '../utils/productPricing';
import { IRSALIYE_PURCHASE_BY_CODE } from './irsaliyeLuy2026000000002';

/** Greenleaf Price First BATCH-1 + LUY2026000000002 irsaliye alış fiyatları */
export const PRICE_CATALOG_BATCH_ID = 'Price_First_BATCH-1_LUY2026000000002';

function priced(
  code: string,
  name: string,
  pv: number,
  legacy?: Omit<PriceCatalogEntry, 'code' | 'name' | 'pv'>,
): PriceCatalogEntry {
  const irsaliye = IRSALIYE_PURCHASE_BY_CODE[code];
  if (irsaliye != null) {
    return entryFromPurchasePrice(code, name, pv, irsaliye);
  }
  if (legacy) {
    return { code, name, pv, ...legacy };
  }
  throw new Error(`Fiyat tanımı eksik: ${code}`);
}

const batch1: PriceCatalogEntry[] = [
  priced('DAA062', 'iLiFE doğal deniz yosunu diş macunu', 0.5),
  priced('EAA022', 'YIBEILE çocuk diş macunu (80g)', 0.2),
  priced('CCC001', 'CARICH Diş Fırçası (Çiftli)', 0.2, {
    purchasePrice: 69.8,
    partnerPrice: 84,
    couponPrice: 84,
    retailPrice: 168,
  }),
  priced('CCC029', 'CARICH Diş Fırçası', 0.5, {
    purchasePrice: 197.6,
    partnerPrice: 238,
    couponPrice: 238,
    retailPrice: 476,
  }),
  priced('CBB017', 'CARICH el yapımı kömürlü esansiyel yağ sabunu', 0.2, {
    purchasePrice: 80.6,
    partnerPrice: 97,
    couponPrice: 97,
    retailPrice: 194,
  }),
  priced('ASF055', 'iLiFE deterjan', 0.5),
  priced('ASA086', 'iLiFE Bambu Özlü Bulaşık Sıvısı', 0.5),
  priced('DAC056', 'iLiFE Mutfak Yağ Temizleyici', 0.2),
  priced('ASF053', 'iLiFE çamaşır deterjanı (1KG)', 0.5),
  priced('ASA017', 'iLiFE Çamaşır Deterjanı', 0.5),
  priced('ASF054', 'iLiFE Çamaşır Deterjanı (2KG)', 1),
  priced('ASF066', 'iLiFE Bakteriyostatik Çamaşır Sabunu', 0.2),
  priced('KLA128', 'CARICH Bambu Yüz Mendili', 0.2),
  priced('CEA069', 'CARICH Bambu Cep Mendili', 0.2),
  priced('CAA038', 'CARICH Zencefil Hacim Şampuanı', 0.5),
  priced('CAB040', 'CARICH Zencefil Hacim Saç Kremi', 0.5),
  priced('DAA109', 'iLiFE Canlandırıcı Nemlendirici Duş Jeli', 0.5),
  priced('YBA045', "YIBEILE Çocuk 2'si 1 Arada Yıkama & Şampuan", 0.5),
  priced('DAB087', 'iLiFE Pembe Aloe Vera Jeli', 0.7),
  priced('ASB044', 'iLiFE Nemlendirici Aloe Vera Jeli', 0.7),
  priced('ASB045', 'iLiFE Aloe Vera Jeli', 0.5),
  priced('CBE034', 'CARICH vitamin E Emülsiyonu', 0.5),
  priced('ASB046', 'iLiFE SOD ipek losyonu', 0.7),
  priced('SAA069', 'SEALUXE Yeşil Çay Nemlendirici Peeling', 0.2),
  priced('CBF015', 'CARICH Shea Yağı Nemlendirici El Kremi', 0.2),
  priced('CBF014', 'CARICH Aloe Nemlendirici El Kremi', 0.2),
  priced('ASB047', 'iLiFE Papatya Köpüren El Yıkama', 0.5),
  priced('DAA108', 'iLiFE Aloe Vera Köpüren El Yıkama', 0.5),
  priced('CCA016', 'CARICH soğuk alg alüminyum içermeyen diş macunu', 1),
  priced('CAA039', 'CARICH çiçek kokulu şampuan', 1),
  priced('CBA052', 'CARICH Aroma Duş Jeli', 0.5),
  priced('DAB089', 'Cilt bakım gliserini', 0.5),
  priced('SBJ064', 'SEALUXE Aydınlatıcı Temizleme Jeli', 2),
  priced('EBB018', 'YIBEILE çocuk yulaf özlü vücut sütü', 2),
  priced('FPA151', 'PINK POINT inci nude ton-up krem', 3),
  priced('SBC053', 'SEALUXE Aloe Nemlendirici Maske', 2),
  priced('LGI019', 'Greenleaf 1,25kg Zencefilli Deterjan', 1),
];

export const PRICE_BATCH_1_BY_PRODUCT_ID: Record<number, PriceCatalogEntry> = {
  1: batch1.find((e) => e.code === 'ASF066')!,
  2: batch1.find((e) => e.code === 'CCC001')!,
  3: batch1.find((e) => e.code === 'CCC029')!,
  4: batch1.find((e) => e.code === 'YBA045')!,
  5: batch1.find((e) => e.code === 'EAA022')!,
  6: batch1.find((e) => e.code === 'CAB040')!,
  7: batch1.find((e) => e.code === 'CAA038')!,
  8: batch1.find((e) => e.code === 'KLA128')!,
  9: batch1.find((e) => e.code === 'CEA069')!,
  10: batch1.find((e) => e.code === 'SAA069')!,
  11: batch1.find((e) => e.code === 'ASA086')!,
  12: batch1.find((e) => e.code === 'ASF053')!,
  13: batch1.find((e) => e.code === 'DAA109')!,
  14: batch1.find((e) => e.code === 'CBF015')!,
  15: batch1.find((e) => e.code === 'CBF014')!,
  16: batch1.find((e) => e.code === 'DAB087')!,
  17: batch1.find((e) => e.code === 'DAA108')!,
  18: batch1.find((e) => e.code === 'DAC056')!,
  19: batch1.find((e) => e.code === 'DAA062')!,
  20: batch1.find((e) => e.code === 'CBE034')!,
  21: batch1.find((e) => e.code === 'ASF055')!,
  22: batch1.find((e) => e.code === 'ASF054')!,
  23: batch1.find((e) => e.code === 'ASA017')!,
  24: batch1.find((e) => e.code === 'ASB047')!,
  25: batch1.find((e) => e.code === 'ASB045')!,
  26: batch1.find((e) => e.code === 'ASB044')!,
  27: batch1.find((e) => e.code === 'ASB046')!,
  28: batch1.find((e) => e.code === 'CAA039')!,
  29: batch1.find((e) => e.code === 'FPA151')!,
  30: batch1.find((e) => e.code === 'DAB089')!,
  31: batch1.find((e) => e.code === 'LGI019')!,
  32: batch1.find((e) => e.code === 'SBJ064')!,
  33: batch1.find((e) => e.code === 'SBC053')!,
  34: batch1.find((e) => e.code === 'EBB018')!,
  35: batch1.find((e) => e.code === 'CCA016')!,
  36: batch1.find((e) => e.code === 'CBA052')!,
};

/** Sistem ürün ID → stok kodu (barkod) */
export const PRICE_BATCH_1_CODE_BY_PRODUCT_ID: Record<number, string> = Object.fromEntries(
  Object.entries(PRICE_BATCH_1_BY_PRODUCT_ID).map(([id, entry]) => [Number(id), entry.code]),
) as Record<number, string>;

export const PRICE_CATALOG_BATCH_1 = batch1;

export const PRICE_CATALOG_BY_CODE = Object.fromEntries(
  batch1.map((entry) => [entry.code, entry]),
) as Record<string, PriceCatalogEntry>;

/** İrsaliyede olup katalogda olmayan kodlar (ör. set) — ileride ürün eklenince kullanılır */
export const IRSALIYE_CODES_WITHOUT_PRODUCT = Object.keys(IRSALIYE_PURCHASE_BY_CODE).filter(
  (code) => !PRICE_CATALOG_BY_CODE[code],
);
