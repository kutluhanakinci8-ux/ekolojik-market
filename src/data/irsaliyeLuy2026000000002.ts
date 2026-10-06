/**
 * e-İrsaliye LUY2026000000002 (29.09.2026) — Lü Ye Kozmetik
 * Birim fiyat = alış (TL), stok kodu = barkod / productCode
 */
export const IRSALIYE_LUY2026000000002_ID = 'LUY2026000000002';

/** localStorage: bu irsaliye stok girişi bir kez uygulandı mı */
export const IRSALIYE_STOCK_MIGRATION_KEY = `market-pos-irsaliye-stock-${IRSALIYE_LUY2026000000002_ID}`;

/** Stok kodu → birim alış fiyatı (TL) — irsaliye satırları 1–34 (ilk birim fiyat geçerli) */
export const IRSALIYE_PURCHASE_BY_CODE: Record<string, number> = {
  ASF066: 51.25,
  CAA039: 287.5,
  FPA151: 363.33,
  DAB089: 82.5,
  LGI019: 206.67,
  YBA045: 199.25,
  EAA022: 71.25,
  CAB040: 204.75,
  CAA038: 204.75,
  KLA128: 266.33,
  CEA069: 130.08,
  SAA069: 89.92,
  ASA086: 199.25,
  ASA017: 152.92,
  SBJ064: 223.33,
  SBC053: 339.17,
  EBB018: 261.67,
  CCA016: 154.17,
  CBA052: 175.83,
  DAA109: 152.17,
  CBF015: 51.25,
  CBF014: 51.25,
  DAC056: 141.17,
  DAB087: 179.17,
  DAA108: 166.75,
  DAA062: 100.33,
  CBE034: 117.58,
  ASF055: 127.33,
  ASF054: 301.58,
  ASF053: 152.92,
  ASB047: 166.75,
  ASB046: 100.33,
  ASB045: 90.67,
  ASB044: 179.17,
};

/**
 * Stok kodu → toplam adet (39 satır; tekrarlayan kodlar toplandı)
 * Kaynak: LUY2026000000002 PDF
 */
export const IRSALIYE_STOCK_BY_CODE: Record<string, number> = {
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
