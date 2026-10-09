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
}

/** Greenleaf kasada kullanılan Zywell 80mm termal varsayılanı */
export const DEFAULT_ZYWELL_RECEIPT_PRINTER: ReceiptPrinterSettings = {
  enabled: true,
  brand: 'zywell',
  windowsPrinterName: 'Zywell',
  paperWidthMm: 80,
  autoPrintOnSale: true,
  copies: 1,
  printMode: 'plain',
};

export const DEFAULT_RECEIPT_PRINTER: ReceiptPrinterSettings = {
  enabled: false,
  brand: 'none',
  windowsPrinterName: '',
  paperWidthMm: 80,
  autoPrintOnSale: true,
  copies: 1,
  printMode: 'html',
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
    windowsPrinterName: String(base.windowsPrinterName ?? '').trim(),
    paperWidthMm: paper,
    autoPrintOnSale: base.autoPrintOnSale !== false,
    copies,
    printMode: base.printMode === 'html' ? 'html' : 'plain',
  };
}
