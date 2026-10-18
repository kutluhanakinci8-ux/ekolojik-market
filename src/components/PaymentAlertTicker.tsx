import { useEffect, useMemo, useState } from 'react';
import type { PaymentReminder } from '../types/paymentReminder';
import { PAYMENT_CATEGORY_ICONS } from '../types/paymentReminder';
import { formatCurrency } from '../utils/format';
import type { PaymentReminderAlerts } from '../utils/paymentReminderAnalytics';

const TICKER_CYCLE_MS = 5000;

interface TickerItem {
  id: string;
  prefix: string;
  text: string;
  tone: 'danger' | 'warn' | 'info';
}

function buildTickerItem(
  prefix: string,
  tone: TickerItem['tone'],
  reminder: PaymentReminder,
): TickerItem {
  return {
    id: `${tone}-${reminder.id}`,
    prefix,
    text: `${PAYMENT_CATEGORY_ICONS[reminder.category]} ${reminder.title} · ${formatCurrency(reminder.amount)}`,
    tone,
  };
}

function buildTickerItems(alerts: PaymentReminderAlerts): TickerItem[] {
  const items: TickerItem[] = [];
  alerts.overdue.forEach((item) => {
    items.push(buildTickerItem('Gecikmiş ödeme', 'danger', item));
  });
  alerts.dueToday.forEach((item) => {
    items.push(buildTickerItem('Bugün ödenecek', 'warn', item));
  });
  alerts.dueTomorrow.forEach((item) => {
    items.push(buildTickerItem('Yarın ödenecek — 1 gün kaldı', 'info', item));
  });
  return items;
}

interface PaymentAlertTickerProps {
  alerts: PaymentReminderAlerts;
}

export function PaymentAlertTicker({ alerts }: PaymentAlertTickerProps) {
  const items = useMemo(() => buildTickerItems(alerts), [alerts]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [items]);

  useEffect(() => {
    if (items.length <= 1) return undefined;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % items.length);
    }, TICKER_CYCLE_MS);
    return () => window.clearInterval(timer);
  }, [items]);

  if (items.length === 0) return null;

  const current = items[index] ?? items[0];

  return (
    <div
      className={`payment-alert-ticker payment-alert-ticker--${current.tone}`}
      role="status"
      aria-live="polite"
      aria-label={`Ödeme uyarısı: ${current.prefix} — ${current.text}`}
    >
      <div className="payment-alert-ticker-badge-wrap" title={`${items.length} aktif uyarı`}>
        <span className="payment-alert-ticker-icon" aria-hidden>🔔</span>
        <span className="payment-alert-ticker-count">{items.length}</span>
      </div>

      <div className="payment-alert-ticker-viewport">
        <div className="payment-alert-ticker-line" key={current.id}>
          <span className="payment-alert-ticker-prefix">{current.prefix}</span>
          <span className="payment-alert-ticker-marquee">
            <span className="payment-alert-ticker-marquee-track">
              <span className="payment-alert-ticker-text">{current.text}</span>
              <span className="payment-alert-ticker-text payment-alert-ticker-text--clone" aria-hidden>
                {current.text}
              </span>
            </span>
          </span>
        </div>
      </div>

      {items.length > 1 && (
        <div className="payment-alert-ticker-dots" aria-hidden>
          {items.map((item, dotIndex) => (
            <span
              key={item.id}
              className={`payment-alert-ticker-dot ${dotIndex === index ? 'is-active' : ''}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
