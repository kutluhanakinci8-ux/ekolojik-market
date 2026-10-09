import type { AppSettings } from '../types/business';
import type { AppPage } from '../components/AppShell';
import type { ReportsSubTab } from '../components/AccountingScreen';

export type TenantProductProfile = 'full' | 'pos-lite';

export const POS_LITE_ADMIN_TABS: AppPage[] = [
  'dashboard',
  'sales',
  'stock',
  'reports',
  'transactions',
  'settings',
];

/** Kasiyer: stok + satış + işlem listesi (müşteri/cari yok) */
export const POS_LITE_CASHIER_TABS: AppPage[] = ['sales', 'stock', 'transactions'];

/** Raporlar menüsü — müşteri/tedarikçi/ortak/döviz hariç */
export const POS_LITE_REPORT_SUBTABS: ReportsSubTab[] = [
  'gelir',
  'gider',
  'stok',
  'kasa',
  'islemler',
];

export function resolveProductProfile(settings: AppSettings | undefined | null): TenantProductProfile {
  const raw = (settings as AppSettings & { productProfile?: string })?.productProfile;
  return raw === 'pos-lite' ? 'pos-lite' : 'full';
}

export function isPosLiteProfile(settings: AppSettings | undefined | null): boolean {
  return resolveProductProfile(settings) === 'pos-lite';
}

export function filterTabsForProductProfile(
  tabs: AppPage[],
  settings: AppSettings | undefined | null,
): AppPage[] {
  if (!isPosLiteProfile(settings)) return tabs;
  const allowed = new Set<AppPage>([...POS_LITE_ADMIN_TABS, ...POS_LITE_CASHIER_TABS]);
  return tabs.filter((t) => allowed.has(t));
}

export function isReportSubTabAllowedForProfile(
  id: ReportsSubTab,
  settings: AppSettings | undefined | null,
  includeAdminReports: boolean,
): boolean {
  if (!isPosLiteProfile(settings)) {
    const item = id;
    if (item === 'kullanici' || item === 'guvenlik') return includeAdminReports;
    return true;
  }
  if (POS_LITE_REPORT_SUBTABS.includes(id)) return true;
  if (includeAdminReports && (id === 'kullanici' || id === 'guvenlik')) return true;
  return false;
}
