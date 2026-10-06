import { useEffect, useState } from 'react';
import type { Store } from '../store/useStore';
import { createFaturaSession, queryFaturaDebt } from '../services/faturaService';
import type { UtilityBillSubscription } from '../types/utilityBillSubscription';
import { ASAT_SCOPE_LABELS } from '../types/utilityBillSubscription';

interface FaturaSyncModalProps {
  store: Store;
  subscriptions: UtilityBillSubscription[];
  targetId?: string | null;
  onClose: () => void;
  onComplete: (message: string) => void;
}

export function FaturaSyncModal({
  store,
  subscriptions,
  targetId,
  onClose,
  onComplete,
}: FaturaSyncModalProps) {
  const queue = targetId
    ? subscriptions.filter((item) => item.id === targetId)
    : subscriptions.filter((item) => item.enabled);
  const [index, setIndex] = useState(0);
  const current = queue[index];
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [captchaImage, setCaptchaImage] = useState<string | null>(null);
  const [captchaCode, setCaptchaCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSession = async () => {
    setBusy(true);
    setError(null);
    try {
      const session = await createFaturaSession();
      if (!session.ok || !session.sessionId || !session.captchaImage) {
        setError(session.message || 'Güvenlik resmi alınamadı');
        return;
      }
      setSessionId(session.sessionId);
      setCaptchaImage(session.captchaImage);
      setCaptchaCode('');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void loadSession();
  }, [current?.id]);

  const handleQuery = async () => {
    if (!current || !sessionId) return;
    setBusy(true);
    setError(null);
    try {
      const result = await queryFaturaDebt(sessionId, current.contractNumber, captchaCode);
      if (!result.ok) {
        setError(result.message || 'Sorgu başarısız');
        await loadSession();
        return;
      }
      if (!result.dueDate) {
        setError('Son ödeme tarihi alınamadı');
        await loadSession();
        return;
      }

      store.manualSyncUtilityBillSubscription(current.id, {
        balance: result.balance ?? 0,
        dueDate: result.dueDate,
        scope: current.scope,
      });

      if (index + 1 < queue.length) {
        setIndex((value) => value + 1);
        onComplete(`${current.label} güncellendi — sıradaki sözleşme`);
      } else {
        onComplete('Tüm ASAT sözleşmeleri güncellendi');
        store.markUtilityBillAutoSyncRun();
        onClose();
      }
    } finally {
      setBusy(false);
    }
  };

  if (!current) {
    return null;
  }

  return (
    <div className="security-modal-overlay" role="dialog" aria-modal="true">
      <div className="security-modal-card fatura-sync-modal">
        <h2>ASAT Borç Sorgusu</h2>
        <p className="security-modal-hint">
          Kaynak: faturaodemelisin.com · {current.label} · Sözleşme {current.contractNumber} · {ASAT_SCOPE_LABELS[current.scope]}
        </p>

        {captchaImage && (
          <div className="fatura-captcha-wrap">
            <img src={captchaImage} alt="Güvenlik kodu" className="fatura-captcha-image" />
          </div>
        )}

        <label className="settings-field">
          Güvenlik kodu
          <input
            value={captchaCode}
            onChange={(e) => setCaptchaCode(e.target.value)}
            placeholder="Resimdeki kodu yazın"
            autoComplete="off"
          />
        </label>

        {error && <p className="settings-flash settings-flash--error" role="status">{error}</p>}

        <div className="payment-calendar-form-actions">
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>
            İptal
          </button>
          <button type="button" className="btn btn-outline" onClick={() => { void loadSession(); }} disabled={busy}>
            Kodu Yenile
          </button>
          <button type="button" className="btn btn-primary" onClick={() => { void handleQuery(); }} disabled={busy || !captchaCode.trim()}>
            {busy ? 'Sorgulanıyor…' : 'Sorgula ve Takvime Aktar'}
          </button>
        </div>

        {queue.length > 1 && (
          <p className="module-hint">
            {index + 1}/{queue.length} sözleşme — her sorgu için yeni güvenlik kodu gerekir.
          </p>
        )}
      </div>
    </div>
  );
}
