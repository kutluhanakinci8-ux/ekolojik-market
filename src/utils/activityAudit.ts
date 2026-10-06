import type { AppPage } from '../components/AppShell';
import { NAV_ITEMS } from '../data/navigation';

export type ActivityAction =
  | 'login'
  | 'logout'
  | 'page_view'
  | 'sale_complete'
  | 'sale_return'
  | 'cart_clear'
  | 'customer_add'
  | 'customer_update'
  | 'customer_remove'
  | 'user_create'
  | 'user_update'
  | 'user_delete'
  | 'user_lock'
  | 'user_unlock'
  | 'expense_add'
  | 'expense_remove'
  | 'cash_handover_add'
  | 'cash_handover_remove'
  | 'cash_day_close'
  | 'stock_adjust'
  | 'stock_set'
  | 'stock_bulk'
  | 'settings_update'
  | 'backup_export'
  | 'backup_import'
  | 'backup_push'
  | 'warehouse_reset'
  | 'password_change'
  | 'totp_enable'
  | 'totp_disable'
  | 'unlock_login'
  | 'product_image_update'
  | 'product_image_remove'
  | 'purchase_invoice_add'
  | 'purchase_invoice_remove'
  | 'customer_payment'
  | 'supplier_payment'
  | 'period_close'
  | 'bank_transaction'
  | 'check_note_add'
  | 'stock_adjustment'
  | 'journal_voucher';

export interface ActivityAuditEntry {
  id: string;
  sessionId: string;
  userId: string;
  username: string;
  displayName: string;
  action: ActivityAction;
  summary: string;
  meta?: Record<string, string | number | boolean | null | undefined>;
  createdAt: string;
}

export const MAX_ACTIVITY_AUDIT_ENTRIES = 1000;

const PAGE_LABELS = Object.fromEntries(NAV_ITEMS.map((item) => [item.id, item.label])) as Record<AppPage, string>;

const ACTION_LABELS: Record<ActivityAction, string> = {
  login: 'Giriş',
  logout: 'Çıkış',
  page_view: 'Sekme',
  sale_complete: 'Satış',
  sale_return: 'İade',
  cart_clear: 'Sepet',
  customer_add: 'Müşteri',
  customer_update: 'Müşteri',
  customer_remove: 'Müşteri',
  user_create: 'Kullanıcı',
  user_update: 'Kullanıcı',
  user_delete: 'Kullanıcı',
  user_lock: 'Güvenlik',
  user_unlock: 'Güvenlik',
  expense_add: 'Gider',
  expense_remove: 'Gider',
  cash_handover_add: 'Kasa Devir',
  cash_handover_remove: 'Kasa Devir',
  cash_day_close: 'Kasa Kapanış',
  stock_adjust: 'Stok',
  stock_set: 'Stok',
  stock_bulk: 'Stok',
  settings_update: 'Ayarlar',
  backup_export: 'Yedek',
  backup_import: 'Yedek',
  backup_push: 'Yedek',
  warehouse_reset: 'İrsaliye depo',
  password_change: 'Güvenlik',
  totp_enable: '2FA',
  totp_disable: '2FA',
  unlock_login: 'Güvenlik',
  product_image_update: 'Ürün',
  product_image_remove: 'Ürün',
  purchase_invoice_add: 'Alış',
  purchase_invoice_remove: 'Alış',
  customer_payment: 'Tahsilat',
  supplier_payment: 'Ödeme',
  period_close: 'Dönem',
  bank_transaction: 'Banka',
  check_note_add: 'Çek/Senet',
  stock_adjustment: 'Stok Düzeltme',
  journal_voucher: 'Muhasebe Fişi',
};

export function getActivityCategoryLabel(action: ActivityAction): string {
  return ACTION_LABELS[action] ?? 'İşlem';
}

export function getPageLabel(page: AppPage): string {
  return PAGE_LABELS[page] ?? page;
}

const META_LABELS: Record<string, string> = {
  page: 'Sekme',
  method: 'Yöntem',
  odeme: 'Ödeme',
  urun: 'Ürün',
  miktar: 'Miktar',
  tip: 'Tip',
  musteri: 'Müşteri',
  aciklama: 'Açıklama',
  dosya: 'Dosya',
  kullanici: 'Kullanıcı',
  rol: 'Rol',
  alanlar: 'Alanlar',
  reason: 'Neden',
  satisId: 'Satış No',
  fatura: 'Fatura',
  tedarikci: 'Tedarikçi',
  tutar: 'Tutar',
};

export function formatActivityMeta(meta?: ActivityAuditEntry['meta']): string | null {
  if (!meta) return null;
  const parts: string[] = [];
  for (const [key, value] of Object.entries(meta)) {
    if (value === undefined || value === null || value === '') continue;
    const label = META_LABELS[key] ?? key;
    const display = key === 'page' ? getPageLabel(value as AppPage) : String(value);
    parts.push(`${label}: ${display}`);
  }
  return parts.length > 0 ? parts.join(' · ') : null;
}

export function summarizeActivities(activities: ActivityAuditEntry[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const activity of activities) {
    const label = getActivityCategoryLabel(activity.action);
    counts[label] = (counts[label] ?? 0) + 1;
  }
  return counts;
}

export interface ActivityCategoryChartRow {
  label: string;
  count: number;
  share: number;
}

export function buildActivityCategoryChart(activities: ActivityAuditEntry[]): ActivityCategoryChartRow[] {
  const counts = summarizeActivities(activities);
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0) || 1;
  return Object.entries(counts)
    .map(([label, count]) => ({ label, count, share: count / total }))
    .sort((a, b) => b.count - a.count);
}
