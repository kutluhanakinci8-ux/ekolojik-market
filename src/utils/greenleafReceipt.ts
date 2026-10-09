import type { AppSettings } from '../types/business';
import { normalizeReceiptPrinterSettings } from '../types/receiptPrinter';
import { isPosLiteProfile } from './tenantProductProfile';

/** Yönetici / Greenleaf kasa: sunucu profili kapalı veya POS Lite tenant */
export function shouldUseGreenleafReceiptPath(settings: AppSettings): boolean {
  if (isPosLiteProfile(settings)) return true;
  const raw = settings.receiptPrinter;
  if (raw == null) return true;
  return !normalizeReceiptPrinterSettings(raw).enabled;
}
