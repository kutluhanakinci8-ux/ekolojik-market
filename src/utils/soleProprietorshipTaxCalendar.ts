import type { PaymentRecurrence, PaymentReminder } from '../types/paymentReminder';
import { todayKey } from './paymentReminderAnalytics';

export const TAX_AUTO_ID_PREFIX = 'tax-sp-';
export const TAX_AUTO_NOTE_TAG = 'tax-auto:sole-proprietorship';

export interface SoleProprietorshipTaxTemplate {
  slug: string;
  title: string;
  recurrence: PaymentRecurrence;
  /** Aylık vergiler için ayın günü (1–31) veya 'last' (ayın son günü) */
  monthlyDay?: number | 'last';
  /** Yıllık vergiler için ay (1–12) ve gün */
  yearlyMonth?: number;
  yearlyDay?: number;
  notes: string;
  /** Varsayılan kapalı — ayarlardan açılır */
  optional?: boolean;
}

export interface SoleProprietorshipTaxCalendarOptions {
  includeMuhtasar?: boolean;
  includeBaBs?: boolean;
  includeSgk?: boolean;
  asOf?: Date;
}

export const SOLE_PROPRIETORSHIP_TAX_TEMPLATES: SoleProprietorshipTaxTemplate[] = [
  {
    slug: 'kdv',
    title: 'KDV Beyanname ve Ödeme',
    recurrence: 'monthly',
    monthlyDay: 26,
    notes: 'Aylık KDV beyanı ve ödemesi — ilgili ayı takip eden ayın 26\'sı',
  },
  {
    slug: 'muhtasar',
    title: 'Muhtasar Beyanname ve Stopaj Ödemesi',
    recurrence: 'monthly',
    monthlyDay: 26,
    notes: 'Personel / serbest meslek stopajı — ayın 26\'sı',
    optional: true,
  },
  {
    slug: 'damga',
    title: 'Damga Vergisi Beyanname',
    recurrence: 'monthly',
    monthlyDay: 26,
    notes: 'Aylık damga vergisi beyanı — ayın 26\'sı',
  },
  {
    slug: 'babs',
    title: 'Ba-Bs Formları',
    recurrence: 'monthly',
    monthlyDay: 'last',
    notes: 'Aylık alış/satış bildirimi — ilgili ayı takip eden ayın son günü',
    optional: true,
  },
  {
    slug: 'sgk-prim',
    title: 'SGK Prim Ödemesi',
    recurrence: 'monthly',
    monthlyDay: 26,
    notes: 'Personel SGK prim ödemesi — ayın 26\'sı',
    optional: true,
  },
  {
    slug: 'gecici-1',
    title: 'Geçici Vergi 1. Dönem',
    recurrence: 'yearly',
    yearlyMonth: 5,
    yearlyDay: 17,
    notes: 'Ocak–Mart dönemi geçici vergi — 17 Mayıs',
  },
  {
    slug: 'gecici-2',
    title: 'Geçici Vergi 2. Dönem',
    recurrence: 'yearly',
    yearlyMonth: 8,
    yearlyDay: 17,
    notes: 'Nisan–Haziran dönemi geçici vergi — 17 Ağustos',
  },
  {
    slug: 'gecici-3',
    title: 'Geçici Vergi 3. Dönem',
    recurrence: 'yearly',
    yearlyMonth: 11,
    yearlyDay: 17,
    notes: 'Temmuz–Eylül dönemi geçici vergi — 17 Kasım',
  },
  {
    slug: 'gelir-vergisi',
    title: 'Yıllık Gelir Vergisi Beyanı ve Ödeme',
    recurrence: 'yearly',
    yearlyMonth: 3,
    yearlyDay: 31,
    notes: 'Yıllık gelir vergisi beyanı ve 4. dönem geçici vergi — Mart ayı sonu',
  },
];

/** Hafta sonu ise ilk iş gününe kaydır (Cumartesi/Pazar → Pazartesi) */
export function adjustToBusinessDay(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const day = date.getDay();
  if (day === 6) date.setDate(date.getDate() + 2);
  else if (day === 0) date.setDate(date.getDate() + 1);
  return todayKey(date);
}

function lastDayOfMonth(year: number, month: number): string {
  return todayKey(new Date(year, month, 0));
}

function buildDateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function monthlyDueDate(year: number, month: number, day: number | 'last'): string {
  if (day === 'last') {
    return adjustToBusinessDay(lastDayOfMonth(year, month));
  }
  const lastDay = new Date(year, month, 0).getDate();
  const safeDay = Math.min(day, lastDay);
  return adjustToBusinessDay(buildDateKey(year, month, safeDay));
}

function yearlyDueDate(year: number, month: number, day: number): string {
  const lastDay = new Date(year, month, 0).getDate();
  const safeDay = Math.min(day, lastDay);
  return adjustToBusinessDay(buildDateKey(year, month, safeDay));
}

/** Bugünden itibaren ilk vade tarihini hesaplar */
export function computeNextTaxDueDate(
  template: SoleProprietorshipTaxTemplate,
  asOf = new Date(),
): string {
  const today = todayKey(asOf);
  const year = asOf.getFullYear();

  if (template.recurrence === 'monthly' && template.monthlyDay != null) {
    for (let offset = 0; offset < 14; offset += 1) {
      const probe = new Date(asOf.getFullYear(), asOf.getMonth() + offset, 1);
      const due = monthlyDueDate(
        probe.getFullYear(),
        probe.getMonth() + 1,
        template.monthlyDay,
      );
      if (due >= today) return due;
    }
    const next = new Date(asOf.getFullYear(), asOf.getMonth() + 1, 1);
    return monthlyDueDate(next.getFullYear(), next.getMonth() + 1, template.monthlyDay);
  }

  if (template.recurrence === 'yearly' && template.yearlyMonth && template.yearlyDay) {
    const thisYearDue = yearlyDueDate(year, template.yearlyMonth, template.yearlyDay);
    if (thisYearDue >= today) return thisYearDue;
    return yearlyDueDate(year + 1, template.yearlyMonth, template.yearlyDay);
  }

  return today;
}

export function buildSoleProprietorshipTaxReminder(
  template: SoleProprietorshipTaxTemplate,
  asOf = new Date(),
): Omit<PaymentReminder, 'createdAt' | 'updatedAt'> {
  return {
    id: `${TAX_AUTO_ID_PREFIX}${template.slug}`,
    title: template.title,
    amount: 0,
    dueDate: computeNextTaxDueDate(template, asOf),
    scope: 'company',
    category: 'tax',
    recurrence: template.recurrence,
    status: 'pending',
    notes: `${TAX_AUTO_NOTE_TAG} · ${template.notes}`,
    paidAt: undefined,
  };
}

export function getActiveTaxTemplates(
  options: SoleProprietorshipTaxCalendarOptions = {},
): SoleProprietorshipTaxTemplate[] {
  const {
    includeMuhtasar = true,
    includeBaBs = true,
    includeSgk = true,
  } = options;

  return SOLE_PROPRIETORSHIP_TAX_TEMPLATES.filter((template) => {
    if (!template.optional) return true;
    if (template.slug === 'muhtasar') return includeMuhtasar;
    if (template.slug === 'babs') return includeBaBs;
    if (template.slug === 'sgk-prim') return includeSgk;
    return true;
  });
}

export function buildSoleProprietorshipTaxReminders(
  options: SoleProprietorshipTaxCalendarOptions = {},
): PaymentReminder[] {
  const asOf = options.asOf ?? new Date();
  const now = asOf.toISOString();
  return getActiveTaxTemplates(options).map((template) => {
    const base = buildSoleProprietorshipTaxReminder(template, asOf);
    return { ...base, createdAt: now, updatedAt: now };
  });
}

export function isAutoTaxReminder(reminder: PaymentReminder): boolean {
  return reminder.id.startsWith(TAX_AUTO_ID_PREFIX)
    || (reminder.notes?.includes(TAX_AUTO_NOTE_TAG) ?? false);
}
