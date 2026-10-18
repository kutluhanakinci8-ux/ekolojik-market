import { useEffect, useMemo, useState } from 'react';
import type { Store } from '../store/useStore';
import type {
  PaymentRecurrence,
  PaymentReminder,
  PaymentReminderCategory,
  PaymentScope,
} from '../types/paymentReminder';
import {
  PAYMENT_CATEGORY_ICONS,
  PAYMENT_CATEGORY_LABELS,
  PAYMENT_RECURRENCE_LABELS,
  PAYMENT_SCOPE_LABELS,
} from '../types/paymentReminder';
import { formatCurrency } from '../utils/format';
import {
  MONTH_LABELS,
  WEEKDAY_LABELS,
  buildMonthCalendar,
  getRemindersForMonth,
  getRemindersOnDate,
  todayKey,
} from '../utils/paymentReminderAnalytics';
import { BillEmailIngestionSettingsModal } from './BillEmailIngestionSettingsModal';
import { PaymentReminderSwipeCard } from './PaymentReminderSwipeCard';

interface PaymentCalendarPanelProps {
  store: Store;
}

const CATEGORIES = Object.keys(PAYMENT_CATEGORY_LABELS) as PaymentReminderCategory[];

type CalendarViewMode = 'calendar' | 'list';

function formatReminderDate(dateKey: string) {
  return new Date(`${dateKey}T12:00:00`).toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

const EMPTY_FORM = {
  title: '',
  amount: '',
  dueDate: todayKey(),
  scope: 'company' as PaymentScope,
  category: 'rent' as PaymentReminderCategory,
  recurrence: 'monthly' as PaymentRecurrence,
  notes: '',
};

export function PaymentCalendarPanel({ store }: PaymentCalendarPanelProps) {
  const reminders = store.settings.paymentReminders;
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [message, setMessage] = useState<string | null>(null);
  const [emailSettingsOpen, setEmailSettingsOpen] = useState(false);
  const [viewMode, setViewMode] = useState<CalendarViewMode>('calendar');
  const [openSwipeId, setOpenSwipeId] = useState<string | null>(null);

  useEffect(() => {
    const result = store.ensureSoleProprietorshipTaxReminders();
    if (result.added > 0) {
      setMessage(result.message);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount seed
  }, []);

  const calendar = useMemo(
    () => buildMonthCalendar(reminders, viewYear, viewMonth),
    [reminders, viewYear, viewMonth],
  );

  const selectedReminders = useMemo(
    () => getRemindersOnDate(reminders, selectedDate),
    [reminders, selectedDate],
  );

  const pendingMonthTotal = useMemo(
    () => reminders
      .filter((item) => item.status === 'pending' && item.dueDate.startsWith(`${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`))
      .reduce((sum, item) => sum + item.amount, 0),
    [reminders, viewYear, viewMonth],
  );

  const monthReminders = useMemo(
    () => getRemindersForMonth(reminders, viewYear, viewMonth),
    [reminders, viewYear, viewMonth],
  );

  const renderReminderItem = (item: PaymentReminder, showDate = false) => (
    <PaymentReminderSwipeCard
      key={item.id}
      item={item}
      showDate={showDate}
      isOpen={openSwipeId === item.id}
      onOpen={() => setOpenSwipeId(item.id)}
      onClose={() => setOpenSwipeId((current) => (current === item.id ? null : current))}
      onMarkPaid={() => store.markPaymentReminderPaid(item.id)}
      onEdit={() => startEdit(item)}
      onDelete={() => store.removePaymentReminder(item.id)}
    />
  );

  const shiftMonth = (delta: number) => {
    const date = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(date.getFullYear());
    setViewMonth(date.getMonth());
  };

  const resetForm = () => {
    setForm({ ...EMPTY_FORM, dueDate: selectedDate });
    setEditingId(null);
    setShowForm(false);
  };

  const startEdit = (item: PaymentReminder) => {
    setEditingId(item.id);
    setForm({
      title: item.title,
      amount: String(item.amount),
      dueDate: item.dueDate,
      scope: item.scope,
      category: item.category,
      recurrence: item.recurrence,
      notes: item.notes ?? '',
    });
    setShowForm(true);
  };

  const handleSubmit = () => {
    const amount = parseFloat(form.amount.replace(',', '.'));
    if (!form.title.trim()) {
      setMessage('Başlık girin');
      return;
    }
    if (Number.isNaN(amount) || amount < 0) {
      setMessage('Geçerli tutar girin');
      return;
    }
    if (!form.dueDate) {
      setMessage('Vade tarihi seçin');
      return;
    }

    if (editingId) {
      store.updatePaymentReminder(editingId, {
        title: form.title.trim(),
        amount,
        dueDate: form.dueDate,
        scope: form.scope,
        category: form.category,
        recurrence: form.recurrence,
        notes: form.notes.trim() || undefined,
        status: 'pending',
      });
      setMessage('Ödeme kaydı güncellendi');
    } else {
      store.addPaymentReminder({
        title: form.title.trim(),
        amount,
        dueDate: form.dueDate,
        scope: form.scope,
        category: form.category,
        recurrence: form.recurrence,
        notes: form.notes.trim() || undefined,
      });
      setMessage('Ödeme hatırlatıcısı eklendi');
    }

    resetForm();
  };

  return (
    <section className="dashboard-card dashboard-card--wide payment-calendar-card payment-calendar-card--premium">
      <div className="dashboard-card-header">
        <div>
          <h2>Ödeme Takvimi</h2>
          <span className="dashboard-card-subtitle">
            Şirket ve şahsi ödemeler — kira, fatura, vergi · 1 gün önce panel uyarısı
          </span>
        </div>
        <div className="asat-subscriptions-header-actions">
          <button
            type="button"
            className={`btn btn-sm btn-outline ${viewMode === 'list' ? 'is-active' : ''}`}
            onClick={() => setViewMode((current) => (current === 'calendar' ? 'list' : 'calendar'))}
          >
            {viewMode === 'calendar' ? 'Liste' : 'Takvim'}
          </button>
          <button
            type="button"
            className="btn btn-sm btn-outline"
            onClick={() => setEmailSettingsOpen(true)}
          >
            Ayarlar
          </button>
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={() => {
              setShowForm((current) => !current);
              if (!showForm) {
                setEditingId(null);
                setForm({ ...EMPTY_FORM, dueDate: selectedDate });
              }
            }}
          >
            {showForm ? 'Formu Kapat' : '+ Yeni Ödeme'}
          </button>
        </div>
      </div>

      <BillEmailIngestionSettingsModal
        open={emailSettingsOpen}
        store={store}
        onClose={() => setEmailSettingsOpen(false)}
        onMessage={setMessage}
      />

      {message && <p className="settings-flash" role="status">{message}</p>}

      {showForm && (
        <div className="payment-calendar-form">
          <div className="settings-form-grid">
            <label className="settings-field">
              Başlık
              <input value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} placeholder="Örn. Ofis kirası" />
            </label>
            <label className="settings-field">
              Tutar (₺)
              <input value={form.amount} onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))} placeholder="0,00" />
            </label>
            <label className="settings-field">
              Vade tarihi
              <input type="date" value={form.dueDate} onChange={(e) => setForm((prev) => ({ ...prev, dueDate: e.target.value }))} />
            </label>
            <label className="settings-field">
              Tür
              <select value={form.scope} onChange={(e) => setForm((prev) => ({ ...prev, scope: e.target.value as PaymentScope }))}>
                {Object.entries(PAYMENT_SCOPE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </label>
            <label className="settings-field">
              Kategori
              <select value={form.category} onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value as PaymentReminderCategory }))}>
                {CATEGORIES.map((key) => (
                  <option key={key} value={key}>{PAYMENT_CATEGORY_ICONS[key]} {PAYMENT_CATEGORY_LABELS[key]}</option>
                ))}
              </select>
            </label>
            <label className="settings-field">
              Tekrar
              <select value={form.recurrence} onChange={(e) => setForm((prev) => ({ ...prev, recurrence: e.target.value as PaymentRecurrence }))}>
                {Object.entries(PAYMENT_RECURRENCE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="settings-field">
            Not
            <input value={form.notes} onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))} placeholder="Opsiyonel" />
          </label>
          <div className="payment-calendar-form-actions">
            <button type="button" className="btn btn-outline" onClick={resetForm}>İptal</button>
            <button type="button" className="btn btn-primary" onClick={handleSubmit}>
              {editingId ? 'Güncelle' : 'Kaydet'}
            </button>
          </div>
        </div>
      )}

      <div className="payment-calendar-toolbar payment-calendar-toolbar--premium">
        <div className="payment-calendar-month-nav">
          <button type="button" className="payment-calendar-nav-btn" onClick={() => shiftMonth(-1)} aria-label="Önceki ay">‹</button>
          <strong>{MONTH_LABELS[viewMonth]} {viewYear}</strong>
          <button type="button" className="payment-calendar-nav-btn" onClick={() => shiftMonth(1)} aria-label="Sonraki ay">›</button>
        </div>
        <span className="payment-calendar-month-total">
          Bekleyen <strong>{formatCurrency(pendingMonthTotal)}</strong>
        </span>
      </div>

      {viewMode === 'calendar' ? (
        <>
          <div className="payment-calendar-grid-wrap">
            <div className="payment-calendar-weekdays">
              {WEEKDAY_LABELS.map((label) => <span key={label}>{label}</span>)}
            </div>
            <div className="payment-calendar-grid">
              {calendar.map((cell) => {
                const pendingCount = cell.reminders.filter((item) => item.status === 'pending').length;
                const isSelected = cell.dateKey === selectedDate;
                const isToday = cell.dateKey === todayKey();
                const hasOverdue = cell.reminders.some((item) => item.status === 'pending' && item.dueDate < todayKey());

                return (
                  <button
                    key={cell.dateKey}
                    type="button"
                    className={[
                      'payment-calendar-day',
                      !cell.inMonth ? 'is-outside' : '',
                      isSelected ? 'is-selected' : '',
                      isToday ? 'is-today' : '',
                      pendingCount > 0 ? 'has-pending' : '',
                      hasOverdue ? 'has-overdue' : '',
                    ].filter(Boolean).join(' ')}
                    onClick={() => setSelectedDate(cell.dateKey)}
                  >
                    <span className="payment-calendar-day-num">{cell.day}</span>
                    {pendingCount > 0 && (
                      <span className="payment-calendar-day-dots" aria-label={`${pendingCount} ödeme`}>
                        {pendingCount > 3 ? '•••' : '•'.repeat(pendingCount)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="payment-calendar-day-list">
            <h3>{formatReminderDate(selectedDate)}</h3>
            {selectedReminders.length === 0 ? (
              <p className="module-empty">Bu tarihte kayıtlı ödeme yok</p>
            ) : (
              <>
                <p className="payment-calendar-swipe-hint">Kartı sola kaydırın — Düzenle ve Sil</p>
                <ul className="payment-calendar-items payment-calendar-items--premium">
                  {selectedReminders.map((item) => renderReminderItem(item))}
                </ul>
              </>
            )}
          </div>
        </>
      ) : (
        <div className="payment-calendar-month-list payment-calendar-month-list--premium">
          <div className="payment-calendar-month-list-head">
            <h3>{MONTH_LABELS[viewMonth]} {viewYear}</h3>
            <span className="payment-calendar-month-count">{monthReminders.length} ödeme</span>
          </div>
          <p className="payment-calendar-swipe-hint">Kartı sola kaydırın — Düzenle ve Sil</p>
          {monthReminders.length === 0 ? (
            <p className="module-empty">Bu ay için kayıtlı ödeme yok</p>
          ) : (
            <ul className="payment-calendar-items payment-calendar-items--premium">
              {monthReminders.map((item) => renderReminderItem(item, true))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
