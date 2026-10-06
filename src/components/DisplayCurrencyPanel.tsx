import { useState } from 'react';
import type { Store } from '../store/useStore';
import type { SupportedCurrency } from '../types/currency';
import { CURRENCY_SYMBOLS } from '../types/currency';
import { getRateToTry } from '../utils/currencyConversion';

const OPTIONS: SupportedCurrency[] = ['TRY', 'USD', 'KZT'];

interface DisplayCurrencyPanelProps {
  store: Store;
  layout?: 'default' | 'toolbar';
}

function useTcmbRefresh(store: Store) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleRefresh = async () => {
    setLoading(true);
    setMessage(null);
    try {
      await store.refreshExchangeRatesFromTcmb();
      setMessage('Güncellendi');
    } catch {
      setMessage('Hata');
    } finally {
      setLoading(false);
    }
  };

  return { loading, message, handleRefresh };
}

export function DisplayCurrencyPanel({ store, layout = 'default' }: DisplayCurrencyPanelProps) {
  const currency = store.settings.currency;
  const toolbarLayout = layout === 'toolbar';
  const { loading, message, handleRefresh } = useTcmbRefresh(store);

  const activeRate = currency.displayCurrency !== 'TRY'
    ? `1 ${currency.displayCurrency} = ${getRateToTry(currency.displayCurrency, currency).toFixed(2)} ₺`
    : null;

  return (
    <div
      className={`dashboard-currency-bar ${toolbarLayout ? 'dashboard-currency-bar--toolbar' : ''}`}
      aria-label="Para birimi görünümü"
    >
      <span className="dashboard-currency-bar-label">Görünüm</span>

      <div className="dashboard-currency-pills" role="radiogroup" aria-label="Görünüm para birimi">
        {OPTIONS.map((code) => {
          const active = currency.displayCurrency === code;
          return (
            <button
              key={code}
              type="button"
              role="radio"
              aria-checked={active}
              className={`dashboard-currency-pill ${active ? 'is-active' : ''}`}
              onClick={() => store.updateCurrencySettings({ displayCurrency: code })}
              title={code === 'TRY' ? 'Türk Lirası' : code === 'USD' ? 'Amerikan Doları' : 'Kazak Tengesi'}
            >
              <span aria-hidden>{CURRENCY_SYMBOLS[code]}</span>
              {code}
            </button>
          );
        })}
      </div>

      {!toolbarLayout && activeRate && (
        <span className="dashboard-currency-rate">{activeRate}</span>
      )}

      {!toolbarLayout && (
        <button
          type="button"
          className="dashboard-currency-refresh"
          onClick={handleRefresh}
          disabled={loading}
          title="TCMB kurlarını güncelle"
        >
          {loading ? '…' : '↻ TCMB'}
        </button>
      )}

      {!toolbarLayout && message && (
        <span className={`dashboard-currency-toast ${message === 'Hata' ? 'is-error' : ''}`} role="status">
          {message}
        </span>
      )}
    </div>
  );
}

export function DisplayCurrencyToolbarTail({ store }: { store: Store }) {
  const currency = store.settings.currency;
  const { loading, message, handleRefresh } = useTcmbRefresh(store);
  const activeRate = currency.displayCurrency !== 'TRY'
    ? `1 ${currency.displayCurrency} = ${getRateToTry(currency.displayCurrency, currency).toFixed(2)} ₺`
    : null;

  return (
    <div className="dashboard-hero-toolbar-tail">
      {activeRate && (
        <span className="dashboard-currency-rate">{activeRate}</span>
      )}
      <button
        type="button"
        className="dashboard-currency-refresh"
        onClick={handleRefresh}
        disabled={loading}
        title="TCMB kurlarını güncelle"
      >
        {loading ? '…' : '↻ TCMB'}
      </button>
      {message && (
        <span className={`dashboard-currency-toast ${message === 'Hata' ? 'is-error' : ''}`} role="status">
          {message}
        </span>
      )}
    </div>
  );
}
