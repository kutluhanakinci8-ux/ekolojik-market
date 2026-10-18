import type { PaymentReminder } from '../types/paymentReminder';

export function todayKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDaysToKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return todayKey(date);
}

export function advanceDueDate(dateKey: string, recurrence: PaymentReminder['recurrence']): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  if (recurrence === 'monthly') {
    date.setMonth(date.getMonth() + 1);
  } else if (recurrence === 'yearly') {
    date.setFullYear(date.getFullYear() + 1);
  }
  return todayKey(date);
}

export interface PaymentReminderAlerts {
  overdue: PaymentReminder[];
  dueToday: PaymentReminder[];
  dueTomorrow: PaymentReminder[];
}

export function getPaymentReminderAlerts(
  reminders: PaymentReminder[],
  asOf = todayKey(),
): PaymentReminderAlerts {
  const pending = reminders.filter((item) => item.status === 'pending');
  const tomorrow = addDaysToKey(asOf, 1);

  return {
    overdue: pending.filter((item) => item.dueDate < asOf),
    dueToday: pending.filter((item) => item.dueDate === asOf),
    dueTomorrow: pending.filter((item) => item.dueDate === tomorrow),
  };
}

export function getPendingRemindersForMonth(
  reminders: PaymentReminder[],
  year: number,
  month: number,
): PaymentReminder[] {
  const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
  return reminders
    .filter((item) => item.status === 'pending' && item.dueDate.startsWith(prefix))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

export function getRemindersForMonth(
  reminders: PaymentReminder[],
  year: number,
  month: number,
): PaymentReminder[] {
  const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
  return reminders
    .filter((item) => item.dueDate.startsWith(prefix))
    .sort((a, b) => {
      const dateCmp = a.dueDate.localeCompare(b.dueDate);
      if (dateCmp !== 0) return dateCmp;
      if (a.status === b.status) return a.title.localeCompare(b.title, 'tr');
      return a.status === 'pending' ? -1 : 1;
    });
}

export function getRemindersOnDate(
  reminders: PaymentReminder[],
  dateKey: string,
): PaymentReminder[] {
  return reminders
    .filter((item) => item.dueDate === dateKey)
    .sort((a, b) => (a.status === b.status ? a.title.localeCompare(b.title, 'tr') : a.status === 'pending' ? -1 : 1));
}

export interface CalendarDayCell {
  dateKey: string;
  day: number;
  inMonth: boolean;
  reminders: PaymentReminder[];
}

export function buildMonthCalendar(
  reminders: PaymentReminder[],
  year: number,
  month: number,
): CalendarDayCell[] {
  const first = new Date(year, month, 1);
  const startWeekday = (first.getDay() + 6) % 7; // Pazartesi = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: CalendarDayCell[] = [];

  for (let i = 0; i < startWeekday; i += 1) {
    const date = new Date(year, month, -startWeekday + i + 1);
    const dateKey = todayKey(date);
    cells.push({
      dateKey,
      day: date.getDate(),
      inMonth: false,
      reminders: getRemindersOnDate(reminders, dateKey),
    });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    cells.push({
      dateKey,
      day,
      inMonth: true,
      reminders: getRemindersOnDate(reminders, dateKey),
    });
  }

  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1];
    const [y, m, d] = last.dateKey.split('-').map(Number);
    const date = new Date(y, m - 1, d + 1);
    const dateKey = todayKey(date);
    cells.push({
      dateKey,
      day: date.getDate(),
      inMonth: false,
      reminders: getRemindersOnDate(reminders, dateKey),
    });
  }

  return cells;
}

export const WEEKDAY_LABELS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

export const MONTH_LABELS = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];
