import type { PaymentReminder } from '../types/paymentReminder';
import { PAYMENT_CATEGORY_ICONS } from '../types/paymentReminder';
import { formatCurrency } from '../utils/format';
import type { PaymentReminderAlerts } from '../utils/paymentReminderAnalytics';

interface PaymentReminderAlertsProps {
  alerts: PaymentReminderAlerts;
  compact?: boolean;
}

function AlertGroup({
  title,
  tone,
  items,
  compact,
}: {
  title: string;
  tone: 'warn' | 'danger' | 'info';
  items: PaymentReminder[];
  compact?: boolean;
}) {
  if (items.length === 0) return null;

  return (
    <div className={`payment-alert-group payment-alert-group--${tone} ${compact ? 'is-compact' : ''}`}>
      <strong>{title}</strong>
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            <span>{PAYMENT_CATEGORY_ICONS[item.category]} {item.title}</span>
            <span>{formatCurrency(item.amount)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PaymentReminderAlerts({ alerts, compact = false }: PaymentReminderAlertsProps) {
  const hasAlerts = alerts.overdue.length > 0
    || alerts.dueToday.length > 0
    || alerts.dueTomorrow.length > 0;

  if (!hasAlerts) return null;

  return (
    <div className={`payment-reminder-alerts ${compact ? 'payment-reminder-alerts--compact' : ''}`}>
      <AlertGroup title="Gecikmiş ödemeler" tone="danger" items={alerts.overdue} compact={compact} />
      <AlertGroup title="Bugün ödenecek" tone="warn" items={alerts.dueToday} compact={compact} />
      <AlertGroup title="Yarın ödenecek — 1 gün kaldı" tone="info" items={alerts.dueTomorrow} compact={compact} />
    </div>
  );
}
