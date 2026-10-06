import { useEffect, useState } from 'react';
import type { Store } from '../store/useStore';
import type { ExchangeRateQuote, ExchangeRateSide } from '../types/currency';
import { CURRENCY_LABELS } from '../types/currency';
import { getRateToTry } from '../utils/currencyConversion';

const FOREIGN: ExchangeRateQuote['currency'][] = ['USD', 'KZT'];

const TCMB_ALERT_TEXT =
  'Şu an TCMB resmi kurları sunucu üzerinden otomatik çekiliyor; yönetici istediğinde manuel kur girebilir.';

export function CurrencyRatesSettings({ store }: { store: Store }) {
  const currency = store.settings.currency;
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [manualUsd, setManualUsd] = useState(String(currency.rates.USD.rateToTry));
  const [manualKzt, setManualKzt] = useState(String(currency.rates.KZT.rateToTry));

  useEffect(() => {
    setManualUsd(String(currency.rates.USD.rateToTry));
    setManualKzt(String(currency.rates.KZT.rateToTry));
  }, [currency.rates.USD.rateToTry, currency.rates.KZT.rateToTry]);

  const handleTcmbRefresh = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const next = await store.refreshExchangeRatesFromTcmb();
      setMessage(`TCMB kurları güncellendi (${new Date(next.lastAutoFetchAt ?? '').toLocaleString('tr-TR')})`);
    } catch {
      setMessage('TCMB kurları alınamadı. Sunucu erişimini veya manuel kur girişini kullanın.');
    } finally {
      setLoading(false);
    }
  };

  const saveManual = (code: ExchangeRateQuote['currency'], value: string) => {
    const rate = parseFloat(value.replace(',', '.'));
    if (Number.isNaN(rate) || rate <= 0) {
      setMessage('Geçerli bir kur girin');
      return;
    }
    store.setManualExchangeRate(code, rate);
    setMessage(`${code} manuel kur kaydedildi`);
  };

  const lastFetchLabel = currency.lastAutoFetchAt
    ? new Date(currency.lastAutoFetchAt).toLocaleString('tr-TR')
    : 'Henüz çekilmedi';

  return (
    <section className="settings-panel settings-panel--currency">
      <div className="settings-panel-head currency-rate-head">
        <h2>Döviz Kurları</h2>
      </div>

      <div className="currency-rate-toolbar">
        <label className="currency-rate-field currency-rate-field--side">
          <span className="currency-rate-field-label">İşlemde kullanılan kur</span>
          <select
            className="currency-rate-select"
            value={currency.rateSide}
            onChange={(e) => store.updateCurrencySettings({ rateSide: e.target.value as ExchangeRateSide })}
          >
            <option value="sell">Satış (bankanın size sattığı)</option>
            <option value="buy">Alış (bankanın sizden aldığı)</option>
            <option value="mid">Orta (alış+satış ortalaması)</option>
          </select>
        </label>

        <label
          className="currency-rate-field currency-rate-field--display"
          title="Üst menüdeki Görünüm seçici ile de değiştirilebilir"
        >
          <span className="currency-rate-field-label">Tüm ekranlarda gösterim</span>
          <select
            className="currency-rate-select"
            value={currency.displayCurrency}
            onChange={(e) => store.updateCurrencySettings({
              displayCurrency: e.target.value as typeof currency.displayCurrency,
            })}
          >
            <option value="TRY">TL (₺)</option>
            <option value="USD">Dolar ($)</option>
            <option value="KZT">Tenge (₸)</option>
          </select>
        </label>

        <button
          type="button"
          className="btn btn-primary currency-rate-refresh-btn"
          onClick={handleTcmbRefresh}
          disabled={loading}
        >
          {loading ? 'Güncelleniyor…' : 'TCMB\'den Güncelle'}
        </button>

        <span className="currency-last-fetch">
          Son otomatik: <strong>{lastFetchLabel}</strong>
        </span>
      </div>

      <div className="currency-rate-alert" role="status" aria-live="polite">
        <span className="currency-rate-alert-icon" aria-hidden>ℹ</span>
        <span className="currency-rate-alert-text">{TCMB_ALERT_TEXT}</span>
      </div>

      <table className="module-table currency-rate-table">
        <thead>
          <tr>
            <th>Para Birimi</th>
            <th>Kaynak</th>
            <th>Alış (₺)</th>
            <th>Satış (₺)</th>
            <th>İşlem Kuru (₺)</th>
            <th>Manuel Kur (₺)</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {FOREIGN.map((code) => {
            const quote = currency.rates[code];
            const effective = getRateToTry(code, currency);
            const manualValue = code === 'USD' ? manualUsd : manualKzt;
            const setManual = code === 'USD' ? setManualUsd : setManualKzt;
            return (
              <tr key={code}>
                <td>
                  <strong>{code}</strong>
                  <div className="module-hint">{CURRENCY_LABELS[code]}</div>
                </td>
                <td>
                  {quote.isManualOverride ? 'Manuel' : quote.source.toUpperCase()}
                </td>
                <td>{quote.buyRate ? quote.buyRate.toFixed(4) : '—'}</td>
                <td>{quote.sellRate ? quote.sellRate.toFixed(4) : '—'}</td>
                <td><strong>{effective.toFixed(4)}</strong></td>
                <td>
                  <input
                    className="currency-manual-input"
                    value={manualValue}
                    onChange={(e) => setManual(e.target.value)}
                    placeholder="1 birim = ? TL"
                  />
                </td>
                <td>
                  <button type="button" className="btn btn-sm btn-outline" onClick={() => saveManual(code, manualValue)}>
                    Kaydet
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {message && <p className="currency-rate-message" role="status">{message}</p>}
    </section>
  );
}
