export type ReceiptPrinterBrand = 'none' | 'zywell' | 'generic';
/** `plain`: sade metin (Zywell/ESC-POS sürücüde güvenli); `html`: tablo fiş */
export type ReceiptPrintMode = 'plain' | 'html';

export interface ReceiptPrinterSettings {
  /** Fiş yazdırma aktif */
  enabled: boolean;
  brand: ReceiptPrinterBrand;
  /** Windows’ta görünen yazıcı adı (Chrome yazdır → hedef) */
  windowsPrinterName: string;
  paperWidthMm: 58 | 80;
  /** Her satış sonrası termal fiş */
  autoPrintOnSale: boolean;
  copies: number;
  printMode: ReceiptPrintMode;
  /** @page kenar boşluğu (mm) — termalde 0 */
  pageMarginMm: number;
}

/** Standart Windows kuyruk adı — Zywell POS-80 */
export const STANDARD_WINDOWS_ZYWELL_PRINTER_NAME = 'Ekolojik POS-80 (Zywell)';

const LEGACY_WINDOWS_PRINTER_ALIASES = new Set(
  ['pos-80c', 'printer pos-80c', 'printer_pos_80c', 'pos80c'].map((s) => s.replace(/\s/g, '')),
);

/** Eski ayarlardaki POS-80C → kurulum betiğinin oluşturduğu kuyruk adı */
export function normalizeWindowsPrinterName(raw: string): string {
  const t = raw.trim();
  if (!t) return '';
  const key = t.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (LEGACY_WINDOWS_PRINTER_ALIASES.has(key)) {
    return STANDARD_WINDOWS_ZYWELL_PRINTER_NAME;
  }
  return t;
}

/** Greenleaf kasa — Zywell; «gelişmiş profil» kapalı (çalışan yönetici yolu) */
export const GREENLEAF_KASA_RECEIPT_PRESET: ReceiptPrinterSettings = {
  enabled: false,
  brand: 'zywell',
  windowsPrinterName: STANDARD_WINDOWS_ZYWELL_PRINTER_NAME,
  paperWidthMm: 80,
  autoPrintOnSale: true,
  copies: 1,
  printMode: 'html',
  pageMarginMm: 0,
};

/** Ayarlar → «POS-80C varsayılanı» butonu */
export const DEFAULT_ZYWELL_RECEIPT_PRINTER: ReceiptPrinterSettings = {
  ...GREENLEAF_KASA_RECEIPT_PRESET,
};

export const DEFAULT_RECEIPT_PRINTER: ReceiptPrinterSettings = {
  enabled: false,
  brand: 'none',
  windowsPrinterName: '',
  paperWidthMm: 80,
  autoPrintOnSale: true,
  copies: 1,
  printMode: 'html',
  pageMarginMm: 0,
};

export function normalizeReceiptPrinterSettings(
  raw?: Partial<ReceiptPrinterSettings> | null,
): ReceiptPrinterSettings {
  const base = { ...DEFAULT_RECEIPT_PRINTER, ...(raw ?? {}) };
  const paper = base.paperWidthMm === 58 ? 58 : 80;
  const copies = Math.min(3, Math.max(1, Math.floor(Number(base.copies) || 1)));
  const brand =
    base.brand === 'zywell' || base.brand === 'generic' || base.brand === 'none'
      ? base.brand
      : 'none';
  return {
    enabled: Boolean(base.enabled),
    brand,
    windowsPrinterName: normalizeWindowsPrinterName(String(base.windowsPrinterName ?? '').trim()),
    paperWidthMm: paper,
    autoPrintOnSale: base.autoPrintOnSale !== false,
    copies,
    printMode: base.printMode === 'html' ? 'html' : 'plain',
    pageMarginMm: Math.min(8, Math.max(0, Number(base.pageMarginMm) || 0)),
  };
}

export type ThermalReceiptPrintOptions = Pick<
  ReceiptPrinterSettings,
  'paperWidthMm' | 'copies' | 'printMode' | 'pageMarginMm' | 'brand'
>;
