import { useState } from 'react';
import type { Store } from '../store/useStore';
import { AsatInlineBillQuery } from './AsatInlineBillQuery';
import {
  ASAT_SCOPE_LABELS,
  type UtilityBillSubscription,
} from '../types/utilityBillSubscription';
import { formatCurrency } from '../utils/format';
import { todayKey } from '../utils/paymentReminderAnalytics';

const ODEME_ASAT_URL = 'https://odeme.com.tr/fatura/su/ANTALYASU';

interface OdemeSubscriptionCardProps {
  subscription: UtilityBillSubscription;
  store: Store;
  onMessage: (message: string) => void;
  onManual: () => void;
}

function formatSyncTime(value?: string) {
  if (!value) return 'Henüz güncellenmedi';
  return new Date(value).toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function OdemeSubscriptionCard({
  subscription,
  store,
  onMessage,
  onManual,
}: OdemeSubscriptionCardProps) {
  const [importBalance, setImportBalance] = useState(
    subscription.lastBalance != null ? String(subscription.lastBalance) : '',
  );
  const [importDueDate, setImportDueDate] = useState(subscription.lastDueDate || todayKey());
  const [copyHint, setCopyHint] = useState<string | null>(null);

  const copyAboneNo = async () => {
    try {
      await navigator.clipboard.writeText(subscription.contractNumber);
      setCopyHint('Abone numarası kopyalandı');
    } catch {
      setCopyHint(`Abone no: ${subscription.contractNumber}`);
    }
  };

  const openOdemeInNewTab = async () => {
    await copyAboneNo();
    window.open(ODEME_ASAT_URL, '_blank', 'noopener,noreferrer');
    setCopyHint('odeme.com.tr yeni sekmede açıldı — abone no kopyalandı, KVKK işaretleyip sorgulayın');
  };

  const importToCalendar = () => {
    const balance = parseFloat(importBalance.replace(',', '.'));
    if (Number.isNaN(balance) || balance < 0) {
      onMessage('Geçerli borç tutarı girin');
      return;
    }
    if (!importDueDate) {
      onMessage('Son ödeme tarihi seçin');
      return;
    }
    const result = store.manualSyncUtilityBillSubscription(subscription.id, {
      balance,
      dueDate: importDueDate,
      scope: subscription.scope,
    });
    onMessage(result.message || (result.ok ? 'Takvime aktarıldı' : 'Kayıt başarısız'));
    if (result.ok) {
      store.markUtilityBillAutoSyncRun();
    }
  };

  return (
    <li className={`asat-subscription-item ${subscription.lastSyncOk === false ? 'has-error' : ''}`}>
      <div className="asat-subscription-card-body">
        <div className="asat-subscription-top">
          <div className="asat-subscription-main">
            <strong>{subscription.label}</strong>
            <span className="module-hint">
              {ASAT_SCOPE_LABELS[subscription.scope]}
            </span>
            <span className="module-hint">
              Abone No: <strong>{subscription.contractNumber}</strong>
              {' · '}
              Son güncelleme: {formatSyncTime(subscription.lastSyncAt)}
              {subscription.lastBalance != null ? ` · Borç: ${formatCurrency(subscription.lastBalance)}` : ''}
              {subscription.lastDueDate
                ? ` · Vade: ${new Date(`${subscription.lastDueDate}T12:00:00`).toLocaleDateString('tr-TR')}`
                : ''}
            </span>
          </div>
          <div className="asat-subscription-top-actions">
            <button type="button" className="btn btn-sm btn-outline" onClick={() => { void copyAboneNo(); }}>
              Abone Kopyala
            </button>
            <button type="button" className="btn btn-sm btn-outline" onClick={onManual}>
              Manuel Gir
            </button>
          </div>
        </div>

        <AsatInlineBillQuery subscription={subscription} />

        <details className="asat-odeme-alt">
          <summary>Alternatif: odeme.com.tr (yeni sekme)</summary>
          <p className="module-hint">
            Resmi ASAT portalı önerilir. odeme.com.tr yedek seçenektir;
            KVKK işaretleyin, abone numarasını yapıştırın, Borç Sorgula&apos;ya basın.
          </p>
          <button type="button" className="btn btn-sm btn-outline" onClick={() => { void openOdemeInNewTab(); }}>
            odeme.com.tr&apos;de Aç
          </button>
          {copyHint && <p className="asat-query-status">{copyHint}</p>}
        </details>

        <div className="asat-odeme-import">
          <strong>Manuel takvime aktar</strong>
          <div className="settings-form-grid asat-odeme-import-grid">
            <label className="settings-field">
              Borç (₺)
              <input
                value={importBalance}
                onChange={(e) => setImportBalance(e.target.value)}
                placeholder="0,00"
              />
            </label>
            <label className="settings-field">
              Son ödeme tarihi
              <input
                type="date"
                value={importDueDate}
                onChange={(e) => setImportDueDate(e.target.value)}
              />
            </label>
          </div>
          <button type="button" className="btn btn-outline btn-sm" onClick={importToCalendar}>
            Takvime Aktar
          </button>
        </div>
      </div>
    </li>
  );
}
