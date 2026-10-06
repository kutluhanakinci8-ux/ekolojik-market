import type { AppPage } from '../components/AppShell';

export interface NavItem {
  id: AppPage;
  label: string;
  icon: string;
  badge?: (store: { outOfStockCount: number; cartItemCount: number }) => number | undefined;
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Panel', icon: '📊' },
  { id: 'sales', label: 'Satış', icon: '🛒', badge: (s) => s.cartItemCount || undefined },
  { id: 'stock', label: 'Stok', icon: '📦', badge: (s) => s.outOfStockCount || undefined },
  { id: 'reports', label: 'Raporlar', icon: '📈' },
  { id: 'accounting', label: 'Muhasebe', icon: '📒' },
  { id: 'settings', label: 'Ayarlar', icon: '⚙️' },
];

/** Üst menüde görünmez; Muhasebe alt sekmesi ve yetki seçimi için */
export const HIDDEN_NAV_ITEMS: Array<{ id: AppPage; label: string }> = [
  { id: 'transactions', label: 'İşlemler' },
  { id: 'cashier', label: 'Kasa' },
  { id: 'customers', label: 'Müşteriler' },
];

export const USER_PERMISSION_TABS: Array<{ id: AppPage; label: string }> = [
  ...NAV_ITEMS.map(({ id, label }) => ({ id, label })),
  ...HIDDEN_NAV_ITEMS,
];

export const ALL_APP_PAGES: AppPage[] = USER_PERMISSION_TABS.map((item) => item.id);

/** Kasiyerin iade, müşteri ve kasa için erişmesi gereken minimum sekmeler */
export const DEFAULT_CASHIER_TABS: AppPage[] = ['sales', 'transactions', 'customers', 'cashier'];

/** Üst menü — yetkiye göre (İşlemler-only kullanıcıda Raporlar yerine İşlemler) */
export function buildVisibleNavItems(allowedTabs: AppPage[]): NavItem[] {
  const items: NavItem[] = [];
  for (const item of NAV_ITEMS) {
    if (item.id === 'reports') {
      if (allowedTabs.includes('reports')) {
        items.push(item);
      } else if (allowedTabs.includes('transactions')) {
        items.push({ ...item, id: 'transactions', label: 'İşlemler', icon: '🧾' });
      }
      continue;
    }
    if (allowedTabs.includes(item.id)) {
      items.push(item);
    }
  }
  return items;
}

export function resolveTopNavHighlight(page: AppPage, allowedTabs: AppPage[]): AppPage {
  if (page === 'cashier' || page === 'customers') return 'accounting';
  if (page === 'transactions') {
    return allowedTabs.includes('reports') ? 'reports' : 'transactions';
  }
  return page;
}
