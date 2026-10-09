import type { AppSettings } from '../types/business';
import {
  normalizeReceiptPrinterSettings,
  type ThermalReceiptPrintOptions,
} from '../types/receiptPrinter';
import { isPosLiteProfile } from './tenantProductProfile';

/** Yönetici / Greenleaf kasa: sunucu profili kapalı veya POS Lite tenant */
export function shouldUseGreenleafReceiptPath(settings: AppSettings): boolean {
  if (isPosLiteProfile(settings)) return true;
  const raw = settings.receiptPrinter;
  if (raw == null) return true;
  return !normalizeReceiptPrinterSettings(raw).enabled;
}

/** Chrome → POS-80C: düz metin 80mm (ham/PDF akışının termalde çöp basılmasını önler) */
export const GREENLEAF_THERMAL_PRINT: ThermalReceiptPrintOptions & { copies: number } = {
  brand: 'none',
  paperWidthMm: 80,
  printMode: 'plain',
  pageMarginMm: 0,
  copies: 1,
};
