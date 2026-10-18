export type DashboardWidgetId =
  | 'payment'
  | 'topProducts'
  | 'stockAlerts'
  | 'recentSales'
  | 'userActivity'
  | 'paymentCalendar'
  | 'crmSummary';

export interface DashboardWidgetsConfig {
  payment: boolean;
  topProducts: boolean;
  stockAlerts: boolean;
  recentSales: boolean;
  userActivity: boolean;
  paymentCalendar: boolean;
  crmSummary: boolean;
}

export const DEFAULT_DASHBOARD_WIDGETS: DashboardWidgetsConfig = {
  payment: true,
  topProducts: true,
  stockAlerts: true,
  recentSales: true,
  userActivity: false,
  paymentCalendar: true,
  crmSummary: true,
};

export const DASHBOARD_WIDGET_OPTIONS: Array<{
  id: DashboardWidgetId;
  label: string;
  shortLabel: string;
  adminOnly?: boolean;
}> = [
  { id: 'payment', label: 'Ödeme Dağılımı (Bugün)', shortLabel: 'Ödeme' },
  { id: 'topProducts', label: 'En Çok Satanlar (Bugün)', shortLabel: 'Satanlar' },
  { id: 'stockAlerts', label: 'Stok Uyarıları', shortLabel: 'Stok' },
  { id: 'recentSales', label: 'Son Satışlar', shortLabel: 'Satışlar' },
  { id: 'userActivity', label: 'Kullanıcı Aktivitesi', shortLabel: 'Aktivite', adminOnly: true },
  { id: 'paymentCalendar', label: 'Ödeme Takvimi', shortLabel: 'Takvim', adminOnly: true },
  { id: 'crmSummary', label: 'CRM Özeti', shortLabel: 'CRM', adminOnly: true },
];

export function normalizeDashboardWidgets(
  raw?: Partial<DashboardWidgetsConfig>,
): DashboardWidgetsConfig {
  return {
    payment: raw?.payment ?? DEFAULT_DASHBOARD_WIDGETS.payment,
    topProducts: raw?.topProducts ?? DEFAULT_DASHBOARD_WIDGETS.topProducts,
    stockAlerts: raw?.stockAlerts ?? DEFAULT_DASHBOARD_WIDGETS.stockAlerts,
    recentSales: raw?.recentSales ?? DEFAULT_DASHBOARD_WIDGETS.recentSales,
    userActivity: raw?.userActivity ?? DEFAULT_DASHBOARD_WIDGETS.userActivity,
    paymentCalendar: raw?.paymentCalendar ?? DEFAULT_DASHBOARD_WIDGETS.paymentCalendar,
    crmSummary: raw?.crmSummary ?? DEFAULT_DASHBOARD_WIDGETS.crmSummary,
  };
}
