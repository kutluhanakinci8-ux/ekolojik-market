import { mergePosLiteProductMediaOnWrite } from './posLiteProductMedia.mjs';

/** POS Lite / ayrı tenant — main (Greenleaf) seed verisinin yazılmasını engelle */
const MAIN_DEMO_USERNAMES = new Set(['yonetici', 'kasiyer']);

export function isPosLiteStore(store) {
  return store?.settings?.productProfile === 'pos-lite';
}

/**
 * @param {string} tenantId
 * @param {object|null} existing
 * @param {object} incoming
 */
export function guardIsolatedTenantStoreWrite(tenantId, existing, incoming) {
  if (!tenantId || tenantId === 'main') return incoming;
  const profile = incoming?.settings?.productProfile ?? existing?.settings?.productProfile;
  if (profile !== 'pos-lite') return incoming;

  const out = { ...incoming };
  const existingUsernames = new Set((existing?.users ?? []).map((u) => String(u.username)));

  if (Array.isArray(out.users)) {
    out.users = out.users.filter((u) => {
      const name = String(u.username ?? '');
      if (existingUsernames.has(name)) return true;
      if (MAIN_DEMO_USERNAMES.has(name)) return false;
      return true;
    });
  }

  const hadProducts = (existing?.products?.length ?? 0) > 0;
  const incomingCount = out.products?.length ?? 0;
  if (!hadProducts && incomingCount >= 30) {
    out.products = [];
  }

  const merged = mergePosLiteProductMediaOnWrite(existing, out);
  return mergeReceiptPrinterSettingsOnWrite(existing, merged);
}

function mergeReceiptPrinterSettingsOnWrite(existing, incoming) {
  if (!incoming?.settings) return incoming;
  const prev = existing?.settings?.receiptPrinter;
  const next = incoming.settings.receiptPrinter;
  if (prev && !next) {
    return {
      ...incoming,
      settings: { ...incoming.settings, receiptPrinter: prev },
    };
  }
  if (prev && next) {
    return {
      ...incoming,
      settings: {
        ...incoming.settings,
        receiptPrinter: {
          ...prev,
          ...next,
          windowsPrinterName: next.windowsPrinterName || prev.windowsPrinterName,
        },
      },
    };
  }
  return incoming;
}

export function shouldSkipIrsaliyeStockMigration(tenantId, store) {
  if (tenantId && tenantId !== 'main') return isPosLiteStore(store);
  return false;
}
