import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import type { PaymentReminder } from '../types/paymentReminder';
import {
  PAYMENT_CATEGORY_ICONS,
  PAYMENT_CATEGORY_LABELS,
  PAYMENT_RECURRENCE_LABELS,
  PAYMENT_SCOPE_LABELS,
} from '../types/paymentReminder';
import { formatCurrency } from '../utils/format';

const REVEAL_WIDTH = 148;
const OPEN_THRESHOLD = 56;

const CATEGORY_ACCENTS: Record<PaymentReminder['category'], string> = {
  rent: '#7c3aed',
  electricity: '#f59e0b',
  water: '#0ea5e9',
  internet: '#6366f1',
  tax: '#e65100',
  phone: '#14b8a6',
  insurance: '#64748b',
  salary: '#ec4899',
  other: '#51b848',
};

interface PaymentReminderSwipeCardProps {
  item: PaymentReminder;
  showDate?: boolean;
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  onMarkPaid: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function formatReminderDate(dateKey: string) {
  return new Date(`${dateKey}T12:00:00`).toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function PaymentReminderSwipeCard({
  item,
  showDate = false,
  isOpen,
  onOpen,
  onClose,
  onMarkPaid,
  onEdit,
  onDelete,
}: PaymentReminderSwipeCardProps) {
  const [offset, setOffset] = useState(isOpen ? REVEAL_WIDTH : 0);
  const offsetRef = useRef(offset);
  const dragRef = useRef<{ startX: number; startOffset: number; dragging: boolean } | null>(null);
  const accent = CATEGORY_ACCENTS[item.category];

  useEffect(() => {
    const next = isOpen ? REVEAL_WIDTH : 0;
    setOffset(next);
    offsetRef.current = next;
  }, [isOpen]);

  useEffect(() => {
    offsetRef.current = offset;
  }, [offset]);

  const snapOffset = useCallback((value: number) => {
    if (value >= OPEN_THRESHOLD) {
      setOffset(REVEAL_WIDTH);
      onOpen();
      return;
    }
    setOffset(0);
    onClose();
  }, [onClose, onOpen]);

  const handlePointerDown = (clientX: number) => {
    dragRef.current = {
      startX: clientX,
      startOffset: offset,
      dragging: true,
    };
  };

  const handlePointerMove = useCallback((clientX: number) => {
    if (!dragRef.current?.dragging) return;
    const delta = dragRef.current.startX - clientX;
    const next = Math.max(0, Math.min(REVEAL_WIDTH, dragRef.current.startOffset + delta));
    setOffset(next);
  }, []);

  const handlePointerEnd = useCallback(() => {
    if (!dragRef.current?.dragging) return;
    snapOffset(offsetRef.current);
    dragRef.current = null;
  }, [snapOffset]);

  useEffect(() => {
    const onMouseMove = (event: MouseEvent) => handlePointerMove(event.clientX);
    const onMouseUp = () => handlePointerEnd();
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [handlePointerEnd, handlePointerMove]);

  const isOverdue = item.status === 'pending' && item.dueDate < new Date().toISOString().slice(0, 10);

  return (
    <li
      className={`payment-swipe-card ${item.status === 'paid' ? 'is-paid' : ''} ${isOverdue ? 'is-overdue' : ''}`}
      style={{ '--payment-accent': accent } as CSSProperties}
    >
      <div className="payment-swipe-actions" aria-hidden={offset < 8}>
        <button
          type="button"
          className="payment-swipe-action payment-swipe-action--edit"
          onClick={() => {
            onClose();
            setOffset(0);
            onEdit();
          }}
        >
          Düzenle
        </button>
        <button
          type="button"
          className="payment-swipe-action payment-swipe-action--delete"
          onClick={() => {
            onClose();
            setOffset(0);
            onDelete();
          }}
        >
          Sil
        </button>
      </div>

      <div
        className="payment-swipe-surface"
        style={{ transform: `translateX(-${offset}px)` }}
        onTouchStart={(e) => handlePointerDown(e.touches[0].clientX)}
        onTouchMove={(e) => handlePointerMove(e.touches[0].clientX)}
        onTouchEnd={handlePointerEnd}
        onMouseDown={(e) => {
          if ((e.target as HTMLElement).closest('button')) return;
          handlePointerDown(e.clientX);
        }}
      >
        <div className="payment-swipe-accent" aria-hidden />

        {showDate && (
          <div className="payment-swipe-date">
            <span className="payment-swipe-date-day">
              {new Date(`${item.dueDate}T12:00:00`).getDate()}
            </span>
            <span className="payment-swipe-date-meta">
              {new Date(`${item.dueDate}T12:00:00`).toLocaleDateString('tr-TR', { month: 'short' })}
            </span>
          </div>
        )}

        <div className="payment-swipe-main">
          <span className="payment-swipe-icon" aria-hidden>
            {PAYMENT_CATEGORY_ICONS[item.category]}
          </span>
          <div className="payment-swipe-copy">
            <strong>{item.title}</strong>
            <span className="payment-swipe-meta">
              {showDate
                ? formatReminderDate(item.dueDate)
                : `${PAYMENT_SCOPE_LABELS[item.scope]} · ${PAYMENT_CATEGORY_LABELS[item.category]}`}
              {item.recurrence !== 'once' ? ` · ${PAYMENT_RECURRENCE_LABELS[item.recurrence]}` : ''}
            </span>
          </div>
        </div>

        <div className="payment-swipe-side">
          <strong>{formatCurrency(item.amount)}</strong>
          {item.status === 'paid' ? (
            <span className="payment-swipe-status-btn is-paid" aria-label="Ödendi">
              Ödendi
            </span>
          ) : (
            <button
              type="button"
              className="payment-swipe-status-btn is-pending"
              onClick={onMarkPaid}
            >
              Ödenecek
            </button>
          )}
        </div>

        <span className="payment-swipe-hint" aria-hidden>‹</span>
      </div>
    </li>
  );
}
