import type { AppSettings } from '../types/business';
import {
  DEFAULT_RECEIPT_PRINTER,
  normalizeReceiptPrinterSettings,
  type ReceiptPrinterSettings,
} from '../types/receiptPrinter';
import { loadTenantId } from '../storage/tenantSession';
import { isPosLiteProfile } from './tenantProductProfile';

export const LIMA_MARKET_TENANT_ID = 'lima-market';

export function isLimaMarketTenant(tenantId = loadTenantId()): boolean {
  return tenantId === LIMA_MARKET_TENANT_ID;
}

/** Lima / POS Lite — tarayıcıdaki eski «gelişmiş yazıcı» ayarını sıfırla */
export function sanitizeReceiptPrinterSettings(
  settings: AppSettings,
  tenantId = loadTenantId(),
): ReceiptPrinterSettings {
  if (isLimaMarketTenant(tenantId) || isPosLiteProfile(settings)) {
    return { ...DEFAULT_RECEIPT_PRINTER, enabled: false };
  }
  return normalizeReceiptPrinterSettings(settings.receiptPrinter);
}

/** Yönetici / Greenleaf kasa: sunucu profili kapalı veya POS Lite tenant */
export function shouldUseGreenleafReceiptPath(settings: AppSettings): boolean {
  if (isLimaMarketTenant() || isPosLiteProfile(settings)) return true;
  const raw = settings.receiptPrinter;
  if (raw == null) return true;
  return !normalizeReceiptPrinterSettings(raw).enabled;
}
