export type PaymentScope = 'company' | 'personal';

export type PaymentReminderCategory =
  | 'rent'
  | 'electricity'
  | 'water'
  | 'internet'
  | 'tax'
  | 'phone'
  | 'insurance'
  | 'salary'
  | 'other';

export type PaymentRecurrence = 'once' | 'monthly' | 'yearly';

export type PaymentReminderStatus = 'pending' | 'paid';

export interface PaymentReminder {
  id: string;
  title: string;
  amount: number;
  /** YYYY-MM-DD */
  dueDate: string;
  scope: PaymentScope;
  category: PaymentReminderCategory;
  recurrence: PaymentRecurrence;
  status: PaymentReminderStatus;
  notes?: string;
  paidAt?: string;
  createdAt: string;
  updatedAt: string;
}

export const PAYMENT_SCOPE_LABELS: Record<PaymentScope, string> = {
  company: 'Şirket',
  personal: 'Şahsi',
};

export const PAYMENT_CATEGORY_LABELS: Record<PaymentReminderCategory, string> = {
  rent: 'Kira',
  electricity: 'Elektrik',
  water: 'Su',
  internet: 'İnternet',
  tax: 'Vergi',
  phone: 'Telefon',
  insurance: 'Sigorta',
  salary: 'Personel',
  other: 'Diğer',
};

export const PAYMENT_CATEGORY_ICONS: Record<PaymentReminderCategory, string> = {
  rent: '🏠',
  electricity: '⚡',
  water: '💧',
  internet: '🌐',
  tax: '📋',
  phone: '📱',
  insurance: '🛡️',
  salary: '👥',
  other: '📌',
};

export const PAYMENT_RECURRENCE_LABELS: Record<PaymentRecurrence, string> = {
  once: 'Tek sefer',
  monthly: 'Aylık',
  yearly: 'Yıllık',
};

export function normalizePaymentReminders(raw?: PaymentReminder[]): PaymentReminder[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((item) => item && typeof item.id === 'string' && typeof item.dueDate === 'string');
}
