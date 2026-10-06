import { useCallback, useEffect, useRef, useState } from 'react';
import type { Store } from '../store/useStore';
import type { UtilityBillSubscription } from '../types/utilityBillSubscription';
import { formatCurrency } from '../utils/format';
import {
  ASAT_PROXY_DEBTS_URL,
  ASAT_PROXY_LOGIN_URL,
  buildAsatSyncAllMessage,
  isAsatAssistantCompleteMessage,
  parseAsatAssistantResult,
} from '../utils/asatAssistant';

interface AsatPortalPanelProps {
  subscriptions: UtilityBillSubscription[];
  store: Store;
  onMessage: (message: string) => void;
}

type PortalStatus =
  | { kind: 'waiting-login'; message: string }
  | { kind: 'scanning'; message: string }
  | { kind: 'done'; message: string }
  | { kind: 'error'; message: string };

export function AsatPortalPanel({ subscriptions, store, onMessage }: AsatPortalPanelProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const autoSyncedRef = useRef(false);
  const [status, setStatus] = useState<PortalStatus>({
    kind: 'waiting-login',
    message: 'ASAT portalında Kullanıcı Giriş yapın — girişten sonra borçlar otomatik taranır ve takvime işlenir',
  });

  const contractPayload = useCallback(() => (
    subscriptions.map((item) => ({
      contract: item.contractNumber,
      subscriptionId: item.id,
      scope: item.scope,
      label: item.label,
    }))
  ), [subscriptions]);

  const pingBridge = useCallback(() => {
    const frame = iframeRef.current?.contentWindow;
    if (!frame) return;
    try {
      frame.postMessage({
        type: 'market-pos-asat-ping',
        contracts: contractPayload(),
      }, '*');
    } catch {
      // ignore
    }
  }, [contractPayload]);

  const syncAll = useCallback(() => {
    const frame = iframeRef.current?.contentWindow;
    if (!frame) return;
    setStatus({ kind: 'scanning', message: 'Ödenmemiş borçlar okunuyor ve takvime işleniyor…' });
    frame.postMessage(buildAsatSyncAllMessage(subscriptions), '*');
  }, [subscriptions]);

  const applySyncResult = useCallback((data: Parameters<typeof parseAsatAssistantResult>[0]) => {
    const subscription = subscriptions.find((item) => item.id === data.subscriptionId);
    if (!subscription) return;

    const parsed = parseAsatAssistantResult(data);
    if (!parsed.ok) {
      onMessage(parsed.message || `${subscription.label}: senkron başarısız`);
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    const balance = parsed.noDebt ? 0 : (parsed.balance ?? 0);
    const dueDate = parsed.dueDate || today;
    store.manualSyncUtilityBillSubscription(subscription.id, {
      balance,
      dueDate,
      scope: subscription.scope,
    });

    if (parsed.noDebt || balance <= 0) {
      onMessage(`${subscription.label}: ödenmemiş borç yok`);
    } else {
      const dueLabel = new Date(`${dueDate}T12:00:00`).toLocaleDateString('tr-TR');
      onMessage(`${subscription.label}: ${formatCurrency(balance)} · Vade ${dueLabel}`);
    }
    store.markUtilityBillAutoSyncRun();
  }, [onMessage, store, subscriptions]);

  useEffect(() => {
    let completed = 0;

    const handleFrameMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data) return;

      if (data.type === 'market-pos-asat-ready') {
        pingBridge();
        return;
      }

      if (
        (data.type === 'market-pos-asat-logged-in' || data.type === 'market-pos-asat-login-detected')
        && !autoSyncedRef.current
      ) {
        autoSyncedRef.current = true;
        setStatus({ kind: 'scanning', message: 'Giriş algılandı — borçlar otomatik taranıyor…' });
        syncAll();
        return;
      }

      if (data.type === 'market-pos-asat-sync-started') {
        setStatus({
          kind: 'scanning',
          message: `Ödenmemiş borçlar okunuyor (${data.count ?? subscriptions.length} sözleşme)…`,
        });
        completed = 0;
        return;
      }

      if (!isAsatAssistantCompleteMessage(data)) return;

      completed += 1;
      applySyncResult(data);

      if (completed >= subscriptions.length) {
        const anyDebt = subscriptions.some((item) => (item.lastBalance ?? 0) > 0);
        setStatus({
          kind: 'done',
          message: anyDebt
            ? 'Borçlar takvime işlendi'
            : 'Kayıt bulunamadı — ödenmemiş borç yok, takvim güncellendi',
        });
      }
    };

    window.addEventListener('message', handleFrameMessage);
    return () => window.removeEventListener('message', handleFrameMessage);
  }, [applySyncResult, pingBridge, subscriptions, syncAll]);

  useEffect(() => {
    autoSyncedRef.current = false;
  }, [subscriptions]);

  useEffect(() => {
    const timer = window.setInterval(pingBridge, 2500);
    return () => window.clearInterval(timer);
  }, [pingBridge]);

  useEffect(() => {
    const handleSubscriptionFocus = (event: Event) => {
      const subscription = (event as CustomEvent<UtilityBillSubscription>).detail;
      if (!subscription) return;
      const frame = iframeRef.current?.contentWindow;
      if (!frame) return;
      frame.postMessage({
        type: 'market-pos-asat-sync',
        contract: subscription.contractNumber,
        subscriptionId: subscription.id,
        scope: subscription.scope,
      }, '*');
    };

    window.addEventListener('asat-sync-subscription', handleSubscriptionFocus);
    return () => window.removeEventListener('asat-sync-subscription', handleSubscriptionFocus);
  }, []);

  return (
    <div className="asat-portal-panel">
      <div className="asat-inline-query-header">
        <strong>ASAT Online Portal</strong>
        <span className="module-hint">otomatik borç aktarımı</span>
      </div>

      <p className="module-hint asat-inline-query-note">
        <strong>Kullanıcı Giriş</strong> yapın (TC, şifre, reCAPTCHA).
        Sistem girişi algılayıp <strong>Ödenmemiş Borçlar</strong> tablosunu okur;
        &quot;Kayıt bulunamadı&quot; veya fatura satırlarını otomatik takvime işler.
        Ev: <strong>385092</strong> · İşyeri: <strong>1002109637</strong>
      </p>

      <div
        className={`asat-portal-status asat-portal-status--${status.kind === 'error' ? 'needs-bridge' : status.kind}`}
        role="status"
      >
        {status.message}
      </div>

      <div className="asat-fatura-frame-wrap asat-portal-frame-wrap">
        <iframe
          ref={iframeRef}
          title="ASAT online portal"
          src={ASAT_PROXY_LOGIN_URL}
          className="asat-fatura-frame asat-portal-frame"
          onLoad={pingBridge}
        />
      </div>

      <div className="asat-query-actions">
        <button
          type="button"
          className="btn btn-outline"
          onClick={() => {
            if (iframeRef.current) iframeRef.current.src = ASAT_PROXY_DEBTS_URL;
            syncAll();
          }}
        >
          Yeniden Tara
        </button>
        <button
          type="button"
          className="btn btn-outline"
          onClick={() => {
            if (iframeRef.current) iframeRef.current.src = ASAT_PROXY_LOGIN_URL;
            autoSyncedRef.current = false;
            setStatus({
              kind: 'waiting-login',
              message: 'Giriş ekranı açıldı — girişten sonra otomatik tarama devam eder',
            });
          }}
        >
          Giriş Ekranı
        </button>
      </div>
    </div>
  );
}

export function requestAsatSubscriptionSync(subscription: UtilityBillSubscription) {
  window.dispatchEvent(new CustomEvent('asat-sync-subscription', { detail: subscription }));
}
