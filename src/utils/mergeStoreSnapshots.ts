import type { Customer } from '../types/business';
import type { Product, Sale, StockMovement } from '../types/product';
import type { SaleReturn } from '../types/saleReturn';
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

export function mergeSalesById(local: Sale[], remote: Sale[]): Sale[] {
  const map = new Map<string, Sale>();
  for (const s of remote) map.set(s.id, s);
  for (const s of local) {
    const prev = map.get(s.id);
    if (!prev || ts(s.createdAt) >= ts(prev.createdAt)) map.set(s.id, s);
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

function mergeCustomersById(local: Customer[], remote: Customer[]): Customer[] {
  const map = new Map<string, Customer>();
  for (const c of remote) map.set(c.id, c);
  for (const c of local) {
    const prev = map.get(c.id);
    if (!prev || ts(c.updatedAt) >= ts(prev.updatedAt)) map.set(c.id, c);
  }
  return [...map.values()];
}

function mergeProductsById(local: Product[], remote: Product[]): Product[] {
  const map = new Map<number, Product>();
  for (const p of remote) map.set(p.id, p);
  for (const p of local) {
    const prev = map.get(p.id);
    if (!prev) {
      map.set(p.id, p);
      continue;
    }
    if (p.stock !== prev.stock) {
      map.set(p.id, p.stock < prev.stock ? p : prev);
    }
  }
  return [...map.values()];
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

  return {
    ...remoteClean,
    ...localClean,
    updatedAt,
    settings: {
      ...remoteClean.settings,
      ...localClean.settings,
      salesHistoryClearedAt: clearedAt ?? localClean.settings?.salesHistoryClearedAt,
    },
    sales: mergeSalesById(localClean.sales ?? [], remoteClean.sales ?? []),
    saleReturns: mergeSaleReturnsById(localClean.saleReturns ?? [], remoteClean.saleReturns ?? []),
    stockMovements: mergeStockMovementsById(localClean.stockMovements ?? [], remoteClean.stockMovements ?? []),
    customers: mergeCustomersById(localClean.customers ?? [], remoteClean.customers ?? []),
    products: mergeProductsById(localClean.products ?? [], remoteClean.products ?? []),
    productSets: remoteClean.productSets?.length ? remoteClean.productSets : localClean.productSets,
    priceType: local.priceType ?? remote.priceType,
    users: local.users?.length ? local.users : remote.users,
  };
}

export function countSalesOnlyInA(a: Sale[], b: Sale[]): number {
  const bIds = new Set(b.map((s) => s.id));
  return a.filter((s) => !bIds.has(s.id)).length;
}
