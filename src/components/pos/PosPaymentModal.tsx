import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { SalePaymentSplit, SplitPaymentMethod } from '../../types/pos';
import { computeChange, quickCashTenderAmounts, validatePaymentSplits } from '../../utils/posCheckout';
import { formatCurrency } from '../../utils/format';

interface PosPaymentModalProps {
  open: boolean;
  mode: 'cash' | 'split' | null;
  total: number;
  onClose: () => void;
  onConfirmCash: (cashTendered: number) => void;
  onConfirmSplit: (splits: SalePaymentSplit[]) => void;
}

export function PosPaymentModal({
  open,
  mode,
  total,
  onClose,
  onConfirmCash,
  onConfirmSplit,
}: PosPaymentModalProps) {
  const [tender, setTender] = useState('');
  const [cashPart, setCashPart] = useState('');
  const [cardPart, setCardPart] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setTender('');
    setCashPart('');
    setCardPart(total > 0 ? String(Math.round(total * 100) / 100) : '');
  }, [open, total, mode]);

  const tenderNum = parseFloat(tender.replace(',', '.'));
  const change = useMemo(() => {
    if (Number.isNaN(tenderNum) || tenderNum < total) return null;
    return computeChange(total, tenderNum);
  }, [tenderNum, total]);

  const quickAmounts = useMemo(() => quickCashTenderAmounts(total), [total]);

  if (!open || !mode) return null;

  const submitCash = () => {
    if (Number.isNaN(tenderNum) || tenderNum < total) {
      setError('Alınan tutar satış toplamından az olamaz.');
      return;
    }
    onConfirmCash(tenderNum);
  };

  const submitSplit = () => {
    const cash = parseFloat(cashPart.replace(',', '.'));
    const card = parseFloat(cardPart.replace(',', '.'));
    if (Number.isNaN(cash) || Number.isNaN(card)) {
      setError('Nakit ve kart tutarlarını girin.');
      return;
    }
    const splits: SalePaymentSplit[] = [
      { method: 'cash', amount: cash },
      { method: 'card', amount: card },
    ];
    const err = validatePaymentSplits(total, splits);
    if (err) {
      setError(err);
      return;
    }
    onConfirmSplit(splits);
  };

  const fillRemainder = (method: SplitPaymentMethod) => {
    const cash = parseFloat(cashPart.replace(',', '.')) || 0;
    const card = parseFloat(cardPart.replace(',', '.')) || 0;
    const rest = Math.round((total - (method === 'cash' ? card : cash)) * 100) / 100;
    if (method === 'cash') setCashPart(String(rest));
    else setCardPart(String(rest));
  };

  return createPortal(
    <div className="pos-payment-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="pos-payment-modal" onClick={(e) => e.stopPropagation()}>
        <header className="pos-payment-modal__head">
          <h2>{mode === 'cash' ? 'Nakit ödeme' : 'Bölünmüş ödeme'}</h2>
          <button type="button" className="pos-payment-modal__close" onClick={onClose} aria-label="Kapat">✕</button>
        </header>

        <p className="pos-payment-modal__total">
          Toplam <strong>{formatCurrency(total)}</strong>
        </p>

        {mode === 'cash' && (
          <>
            <label className="pos-payment-field">
              <span>Müşteriden alınan</span>
              <input
                type="text"
                inputMode="decimal"
                autoFocus
                value={tender}
                onChange={(e) => setTender(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') submitCash(); }}
              />
            </label>
            <div className="pos-payment-quick">
              {quickAmounts.map((amount) => (
                <button key={amount} type="button" className="btn btn-sm btn-outline" onClick={() => setTender(String(amount))}>
                  {formatCurrency(amount)}
                </button>
              ))}
            </div>
            {change != null && (
              <p className="pos-payment-change">Para üstü: <strong>{formatCurrency(change)}</strong></p>
            )}
            <button type="button" className="btn btn-primary btn-block" onClick={submitCash}>
              Satışı tamamla (F1)
            </button>
          </>
        )}

        {mode === 'split' && (
          <>
            <div className="pos-payment-split-grid">
              <label className="pos-payment-field">
                <span>Nakit</span>
                <input type="text" inputMode="decimal" value={cashPart} onChange={(e) => setCashPart(e.target.value)} />
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => fillRemainder('cash')}>Kalanı nakit</button>
              </label>
              <label className="pos-payment-field">
                <span>Kart</span>
                <input type="text" inputMode="decimal" value={cardPart} onChange={(e) => setCardPart(e.target.value)} />
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => fillRemainder('card')}>Kalanı kart</button>
              </label>
            </div>
            <button type="button" className="btn btn-primary btn-block" onClick={submitSplit}>
              Bölünmüş ödemeyi kaydet
            </button>
          </>
        )}

        {error && <p className="pos-payment-error" role="alert">{error}</p>}
        <p className="pos-payment-hint">Esc — iptal · F2 kart · F3 havale</p>
      </div>
    </div>,
    document.body,
  );
}
