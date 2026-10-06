import type { AppPage } from '../components/AppShell';
import type { PosUser } from '../types/user';
import type { ActivityAction, ActivityAuditEntry } from './activityAudit';
import { getPageLabel } from './activityAudit';

export type SystemActivityModule =
  | 'sales'
  | 'stock'
  | 'accounting'
  | 'cash'
  | 'customers'
  | 'purchases'
  | 'security'
  | 'settings'
  | 'other';

export const SYSTEM_ACTIVITY_MODULE_LABELS: Record<SystemActivityModule, string> = {
  sales: 'Satış & iade',
  stock: 'Stok',
  accounting: 'Muhasebe & fiş',
  cash: 'Kasa',
  customers: 'Müşteri & cari',
  purchases: 'Alış faturası',
  security: 'Kullanıcı & güvenlik',
  settings: 'Ayarlar & yedek',
  other: 'Diğer',
};

const MODULE_BY_ACTION: Partial<Record<ActivityAction, SystemActivityModule>> = {
  sale_complete: 'sales',
  sale_return: 'sales',
  cart_clear: 'sales',
  stock_adjust: 'stock',
  stock_set: 'stock',
  stock_bulk: 'stock',
  stock_adjustment: 'stock',
  product_image_update: 'stock',
  product_image_remove: 'stock',
  journal_voucher: 'accounting',
  expense_add: 'accounting',
  expense_remove: 'accounting',
  bank_transaction: 'accounting',
  check_note_add: 'accounting',
  period_close: 'accounting',
  customer_payment: 'accounting',
  supplier_payment: 'accounting',
  purchase_invoice_add: 'purchases',
  purchase_invoice_remove: 'purchases',
  cash_handover_add: 'cash',
  cash_handover_remove: 'cash',
  cash_day_close: 'cash',
  customer_add: 'customers',
  customer_update: 'customers',
  customer_remove: 'customers',
  user_create: 'security',
  user_update: 'security',
  user_delete: 'security',
  user_lock: 'security',
  user_unlock: 'security',
  password_change: 'security',
  totp_enable: 'security',
  totp_disable: 'security',
  unlock_login: 'security',
  settings_update: 'settings',
  backup_export: 'settings',
  backup_import: 'settings',
  backup_push: 'settings',
};

const NAVIGATION_ACTIONS: ActivityAction[] = ['page_view', 'login', 'logout'];

export type PageUsageBucket = 'panel' | 'reports' | 'sales' | 'stock' | 'accounting' | 'other';

export const PAGE_USAGE_BUCKET_LABELS: Record<PageUsageBucket, string> = {
  panel: 'Panel',
  reports: 'Raporlar',
  sales: 'Satış',
  stock: 'Stok',
  accounting: 'Muhasebe alanı',
  other: 'Diğer sekmeler',
};

function pageToUsageBucket(page: AppPage): PageUsageBucket {
  if (page === 'dashboard') return 'panel';
  if (page === 'reports') return 'reports';
  if (page === 'sales') return 'sales';
  if (page === 'stock') return 'stock';
  if (page === 'accounting' || page === 'transactions' || page === 'cashier' || page === 'customers') {
    return 'accounting';
  }
  return 'other';
}

export interface SystemActivityOverview {
  periodOperationCount: number;
  moduleCounts: Array<{ id: SystemActivityModule; label: string; count: number; share: number }>;
  topModule: SystemActivityModule | null;
  pageViewCounts: Array<{ id: PageUsageBucket; label: string; count: number; share: number }>;
  panelVsReports: { panelViews: number; reportsViews: number };
  pageDetail: Array<{ page: AppPage; label: string; count: number; share: number }>;
  byUser: UserActivityBreakdown[];
}

export interface UserActivityBreakdown {
  userId: string;
  displayName: string;
  username: string;
  operationCount: number;
  pageViewCount: number;
  moduleCounts: Array<{ id: SystemActivityModule; label: string; count: number; share: number }>;
  pageViewCounts: Array<{ id: PageUsageBucket; label: string; count: number; share: number }>;
}

function moduleForAction(action: ActivityAction): SystemActivityModule {
  return MODULE_BY_ACTION[action] ?? 'other';
}

function emptyModuleTotals(): Record<SystemActivityModule, number> {
  return {
    sales: 0,
    stock: 0,
    accounting: 0,
    cash: 0,
    customers: 0,
    purchases: 0,
    security: 0,
    settings: 0,
    other: 0,
  };
}

function emptyBucketTotals(): Record<PageUsageBucket, number> {
  return {
    panel: 0,
    reports: 0,
    sales: 0,
    stock: 0,
    accounting: 0,
    other: 0,
  };
}

function toModuleCounts(moduleTotals: Record<SystemActivityModule, number>) {
  const moduleSum = Object.values(moduleTotals).reduce((a, b) => a + b, 0) || 1;
  return (Object.keys(moduleTotals) as SystemActivityModule[])
    .map((id) => ({
      id,
      label: SYSTEM_ACTIVITY_MODULE_LABELS[id],
      count: moduleTotals[id],
      share: moduleTotals[id] / moduleSum,
    }))
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count);
}

function toPageViewCounts(bucketTotals: Record<PageUsageBucket, number>) {
  const pageViewSum = Object.values(bucketTotals).reduce((a, b) => a + b, 0) || 1;
  return (Object.keys(bucketTotals) as PageUsageBucket[])
    .map((id) => ({
      id,
      label: PAGE_USAGE_BUCKET_LABELS[id],
      count: bucketTotals[id],
      share: bucketTotals[id] / pageViewSum,
    }))
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count);
}

type ActivityAccumulator = {
  moduleTotals: Record<SystemActivityModule, number>;
  bucketTotals: Record<PageUsageBucket, number>;
  pageTotals: Map<AppPage, number>;
  operationCount: number;
};

function createAccumulator(): ActivityAccumulator {
  return {
    moduleTotals: emptyModuleTotals(),
    bucketTotals: emptyBucketTotals(),
    pageTotals: new Map(),
    operationCount: 0,
  };
}

function ingestEntry(acc: ActivityAccumulator, entry: ActivityAuditEntry): void {
  if (entry.action === 'page_view') {
    const page = entry.meta?.page as AppPage | undefined;
    if (page) {
      acc.pageTotals.set(page, (acc.pageTotals.get(page) ?? 0) + 1);
      acc.bucketTotals[pageToUsageBucket(page)] += 1;
    }
    return;
  }
  if (NAVIGATION_ACTIONS.includes(entry.action)) return;

  acc.operationCount += 1;
  const mod = moduleForAction(entry.action);
  acc.moduleTotals[mod] += 1;
}

export function buildSystemActivityOverview(
  entries: ActivityAuditEntry[],
  knownUsers: PosUser[] = [],
): SystemActivityOverview {
  const global = createAccumulator();
  const perUser = new Map<string, ActivityAccumulator & {
    displayName: string;
    username: string;
  }>();

  for (const entry of entries) {
    ingestEntry(global, entry);

    const userKey = entry.userId || entry.username || 'unknown';
    let userAcc = perUser.get(userKey);
    if (!userAcc) {
      userAcc = {
        ...createAccumulator(),
        displayName: entry.displayName || entry.username || 'Bilinmeyen',
        username: entry.username || '—',
      };
      perUser.set(userKey, userAcc);
    }
    ingestEntry(userAcc, entry);
  }

  for (const user of knownUsers) {
    if (perUser.has(user.id)) continue;
    perUser.set(user.id, {
      ...createAccumulator(),
      displayName: user.displayName,
      username: user.username,
    });
  }

  const moduleCounts = toModuleCounts(global.moduleTotals);
  const topModule = moduleCounts[0]?.id ?? null;
  const pageViewCounts = toPageViewCounts(global.bucketTotals);

  const pageDetailSum = [...global.pageTotals.values()].reduce((a, b) => a + b, 0) || 1;
  const pageDetail = [...global.pageTotals.entries()]
    .map(([page, count]) => ({
      page,
      label: getPageLabel(page),
      count,
      share: count / pageDetailSum,
    }))
    .sort((a, b) => b.count - a.count);

  const byUser: UserActivityBreakdown[] = [...perUser.entries()]
    .map(([userId, acc]) => {
      const pageViewCount = Object.values(acc.bucketTotals).reduce((a, b) => a + b, 0);
      return {
        userId,
        displayName: acc.displayName,
        username: acc.username,
        operationCount: acc.operationCount,
        pageViewCount,
        moduleCounts: toModuleCounts(acc.moduleTotals),
        pageViewCounts: toPageViewCounts(acc.bucketTotals),
      };
    })
    .sort((a, b) => (b.operationCount + b.pageViewCount) - (a.operationCount + a.pageViewCount));

  return {
    periodOperationCount: global.operationCount,
    moduleCounts,
    topModule,
    pageViewCounts,
    panelVsReports: {
      panelViews: global.bucketTotals.panel,
      reportsViews: global.bucketTotals.reports,
    },
    pageDetail,
    byUser,
  };
}
