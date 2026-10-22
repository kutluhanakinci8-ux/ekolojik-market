import type { Customer } from '../types/business';
import type { CurrencySettings } from '../types/currency';
import { DEFAULT_CURRENCY_SETTINGS } from '../types/currency';
import type { Product, Sale, StockMovement } from '../types/product';
import type { SaleReturn } from '../types/saleReturn';
import type { PaymentReminder } from '../types/paymentReminder';
import type { PersistedStoreSnapshot } from '../types/persistedStore';
import {
  applySalesHistoryClearToSnapshot,
  resolveSalesHistoryClearedAt,
} from './salesHistoryClear';

function ts(iso: string | undefined): number {
  if (!iso) return 0;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
}

function mergeSaleRecord(local: Sale, remote: Sale): Sale {
  const localCorrected = ts(local.paymentCorrectedAt);
  const remoteCorrected = ts(remote.paymentCorrectedAt);
  let chosen: Sale;
  if (remoteCorrected > localCorrected) chosen = remote;
  else if (localCorrected > remoteCorrected) chosen = local;
  else chosen = ts(local.createdAt) >= ts(remote.createdAt) ? local : remote;

  const paymentSource = remoteCorrected >= localCorrected ? remote : local;
  if (localCorrected || remoteCorrected) {
    return {
      ...chosen,
      paymentMethod: paymentSource.paymentMethod,
      paymentSplits: paymentSource.paymentSplits,
      cashTendered: paymentSource.cashTendered,
      changeGiven: paymentSource.changeGiven,
      paymentCorrectedAt: paymentSource.paymentCorrectedAt,
      paymentCorrectionNote: paymentSource.paymentCorrectionNote,
    };
  }
  return chosen;
}

export function mergeSalesById(local: Sale[], remote: Sale[]): Sale[] {
  const map = new Map<string, Sale>();
  for (const s of remote) map.set(s.id, s);
  for (const s of local) {
    const prev = map.get(s.id);
    if (!prev) {
      map.set(s.id, s);
      continue;
    }
    map.set(s.id, mergeSaleRecord(s, prev));
  }
  return [...map.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function mergeSaleReturnsById(local: SaleReturn[], remote: SaleReturn[]): SaleReturn[] {
  const map = new Map<string, SaleReturn>();
  for (const s of remote) map.set(s.id, s);
  for (const s of local) {
    const prev = map.get(s.id);
    if (!prev || ts(s.createdAt) >= ts(prev.createdAt)) map.set(s.id, s);
  }
  return [...map.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function mergeStockMovementsById(local: StockMovement[], remote: StockMovement[]): StockMovement[] {
  const map = new Map<string, StockMovement>();
  for (const m of remote) map.set(m.id, m);
  for (const m of local) {
    const prev = map.get(m.id);
    if (!prev || ts(m.createdAt) >= ts(prev.createdAt)) map.set(m.id, m);
  }
  return [...map.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function mergeCurrencySettings(
  remote?: CurrencySettings,
  local?: CurrencySettings,
): CurrencySettings {
  const r = { ...DEFAULT_CURRENCY_SETTINGS, ...remote, rates: { ...DEFAULT_CURRENCY_SETTINGS.rates, ...remote?.rates } };
  const l = local ? { ...DEFAULT_CURRENCY_SETTINGS, ...local, rates: { ...DEFAULT_CURRENCY_SETTINGS.rates, ...local.rates } } : null;
  if (!l) return r;
  return {
    ...r,
    ...l,
    rates: {
      USD: { ...r.rates.USD, ...l.rates.USD },
      KZT: { ...r.rates.KZT, ...l.rates.KZT },
    },
    displayCurrency: l.displayCurrency ?? r.displayCurrency ?? 'TRY',
  };
}

function mergeCustomersById(local: Customer[], remote: Customer[]): Customer[] {
  const map = new Map<string, Customer>();
  for (const c of remote) map.set(c.id, c);
  for (const c of local) {
    const prev = map.get(c.id);
    if (!prev || ts(c.updatedAt) >= ts(prev.updatedAt)) map.set(c.id, c);
  }
  return [...map.values()];
}

/** Sunucu snapshot'ında imageUrl yok; yerelde data: yükleme var — birleştirmede düşmesin */
function mergeProductImageUrl(local: Product, chosen: Product): Product {
  const localUrl = local.imageUrl?.trim();
  if (!localUrl?.startsWith('data:image/')) return chosen;
  const chosenUrl = chosen.imageUrl?.trim();
  if (chosenUrl?.startsWith('data:image/')) return chosen;
  return { ...chosen, imageUrl: localUrl };
}

/** Sunucuda kaydedilen fiyat, eski tarayıcı önbelleğini ezer */
function mergeProductPricingFields(local: Product, remote: Product): Pick<
  Product,
  | 'purchasePrice'
  | 'partnerPrice'
  | 'couponPrice'
  | 'fullSalePrice'
  | 'ourPriceWithVat'
  | 'partnerPriceWithVat'
  | 'ourPercent'
  | 'wholesalePrices'
  | 'pricingUpdatedAt'
> {
  const localTs = ts(local.pricingUpdatedAt);
  const remoteTs = ts(remote.pricingUpdatedAt);
  const source = remoteTs >= localTs ? remote : local;
  return {
    purchasePrice: source.purchasePrice,
    partnerPrice: source.partnerPrice,
    couponPrice: source.couponPrice,
    fullSalePrice: source.fullSalePrice,
    ourPriceWithVat: source.ourPriceWithVat,
    partnerPriceWithVat: source.partnerPriceWithVat,
    ourPercent: source.ourPercent,
    wholesalePrices: source.wholesalePrices,
    pricingUpdatedAt: source.pricingUpdatedAt,
  };
}

function mergeProductsById(
  local: Product[],
  remote: Product[],
  options?: { preferLocalCatalog?: boolean },
): Product[] {
  const preferLocal = options?.preferLocalCatalog ?? false;
  const map = new Map<number, Product>();
  for (const p of remote) map.set(p.id, p);
  for (const p of local) {
    const remoteP = map.get(p.id);
    if (!remoteP) {
      map.set(p.id, p);
      continue;
    }
    const catalogBase = preferLocal ? p : remoteP;
    // Sunucu otoriteli eşitleme: stok sunucudan gelir (yerel 16 / sunucu 22 → 22).
    const stock = remoteP.stock;
    const pricing = mergeProductPricingFields(p, remoteP);
    map.set(p.id, mergeProductImageUrl(p, { ...catalogBase, ...pricing, stock }));
  }
  return [...map.values()];
}

/** Ödeme takvimi: yerel liste sunucuyu tamamen ezmesin (vergi seed / boş önbellek). */
export function mergePaymentRemindersById(
  local: PaymentReminder[],
  remote: PaymentReminder[],
): PaymentReminder[] {
  const map = new Map<string, PaymentReminder>();
  for (const item of remote) {
    if (item?.id) map.set(item.id, item);
  }
  for (const item of local) {
    if (!item?.id) continue;
    const prev = map.get(item.id);
    if (!prev || ts(item.updatedAt) >= ts(prev.updatedAt)) {
      map.set(item.id, item);
    }
  }
  return [...map.values()].sort((a, b) => {
    const byDate = a.dueDate.localeCompare(b.dueDate);
    if (byDate !== 0) return byDate;
    return a.title.localeCompare(b.title, 'tr');
  });
}

/** İki sekme / iki kasa: satışları birleştir; sunucuya yazmadan önce ve çekince kullan. */
export function mergeStoreSnapshots(
  local: PersistedStoreSnapshot,
  remote: PersistedStoreSnapshot,
): PersistedStoreSnapshot {
  const clearedAt = resolveSalesHistoryClearedAt(local, remote);
  const localClean = applySalesHistoryClearToSnapshot(local, clearedAt);
  const remoteClean = applySalesHistoryClearToSnapshot(remote, clearedAt);
  const updatedAt = new Date(
    Math.max(ts(local.updatedAt), ts(remote.updatedAt), Date.now()),
  ).toISOString();
  const preferLocalCatalog = ts(localClean.updatedAt) >= ts(remoteClean.updatedAt);

  return {
    ...remoteClean,
    ...localClean,
    updatedAt,
    settings: {
      ...remoteClean.settings,
      ...localClean.settings,
      salesHistoryClearedAt: clearedAt ?? localClean.settings?.salesHistoryClearedAt,
      currency: mergeCurrencySettings(
        remoteClean.settings?.currency,
        localClean.settings?.currency,
      ),
      paymentReminders: mergePaymentRemindersById(
        localClean.settings?.paymentReminders ?? [],
        remoteClean.settings?.paymentReminders ?? [],
      ),
    },
    sales: mergeSalesById(localClean.sales ?? [], remoteClean.sales ?? []),
    saleReturns: mergeSaleReturnsById(localClean.saleReturns ?? [], remoteClean.saleReturns ?? []),
    stockMovements: mergeStockMovementsById(localClean.stockMovements ?? [], remoteClean.stockMovements ?? []),
    customers: mergeCustomersById(localClean.customers ?? [], remoteClean.customers ?? []),
    products: mergeProductsById(localClean.products ?? [], remoteClean.products ?? [], {
      preferLocalCatalog,
    }),
    productSets: remoteClean.productSets?.length ? remoteClean.productSets : localClean.productSets,
    priceType: local.priceType ?? remote.priceType,
    users: local.users?.length ? local.users : remote.users,
  };
}

export function countSalesOnlyInA(a: Sale[], b: Sale[]): number {
  const bIds = new Set(b.map((s) => s.id));
  return a.filter((s) => !bIds.has(s.id)).length;
}
