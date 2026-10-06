import { useMemo } from 'react';
import type { Store } from '../../store/useStore';
import type { ReportPeriod } from '../../utils/analytics';
import { buildCurrencyReportDashboard } from '../../utils/currencyReportAnalytics';
import { formatDateTime } from '../../utils/format';

interface CurrencyReportsPanelProps {
  store: Store;
  period: ReportPeriod;
}

function maxTrend(values: number[]): number {
  return Math.max(...values, 0.000_1);
}

function formatPercent(value: number | null): string {
  if (value == null) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

function CurrencyTrendBars({
  title,
  points,
  maxRate,
}: {
  title: string;
  points: { dateLabel: string; rate: number }[];
  maxRate: number;
}) {
  if (points.length === 0) {
    return <p className="module-empty module-empty--compact">Veri yok</p>;
  }
  return (
    <div className="currency-reports-trend-block">
      <p className="currency-reports-trend-title">{title}</p>
      <div className="cash-reports-bar-chart currency-reports-mini-trend">
        {points.map((point) => (
          <div key={point.dateLabel} className="cash-reports-bar-group">
            <div className="cash-reports-bar-stack">
              <div
                className="cash-reports-bar cash-reports-bar--in"
                style={{ height: `${Math.max(6, (point.rate / maxRate) * 100)}%` }}
                title={point.rate.toFixed(4)}
              />
            </div>
            <span className="cash-reports-bar-label">{point.dateLabel}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CurrencyReportsPanel({ store }: CurrencyReportsPanelProps) {
  const dashboard = useMemo(
    () => buildCurrencyReportDashboard(store.settings.currency),
    [store.settings.currency],
  );

  const maxWeekUsd = maxTrend(dashboard.weekTrendByCurrency.USD.map((p) => p.rate));
  const maxWeekKzt = maxTrend(dashboard.weekTrendByCurrency.KZT.map((p) => p.rate));
  const maxMonthUsd = maxTrend(dashboard.monthTrendByCurrency.USD.map((p) => p.rate));
  const maxMonthKzt = maxTrend(dashboard.monthTrendByCurrency.KZT.map((p) => p.rate));

  return (
    <div className="accounting-reports-section currency-reports-premium">
      <p className="module-hint">
        Gösterim para birimi: <strong>{dashboard.displayCurrency}</strong> · Kaynak: {dashboard.autoSource} ·
        İşlemde kullanılan: <strong>{dashboard.rateSide}</strong> kuru
        {dashboard.lastAutoFetchAt ? ` · Son çekim: ${formatDateTime(dashboard.lastAutoFetchAt)}` : ''}.
        Kur geçmişi TCMB çekimi ve manuel güncellemelerle birikir.
      </p>

      <div className="accounting-partner-profit-kpis currency-reports-kpis">
        {dashboard.rates.map((row) => (
          <div key={row.code} className="accounting-partner-profit-kpi">
            <span className="accounting-partner-profit-kpi-label">{row.label}</span>
            <strong>{row.rateToTry.toFixed(4)} ₺</strong>
            <em>Alış {row.buyRate?.toFixed(4) ?? '—'} · Satış {row.sellRate?.toFixed(4) ?? '—'}</em>
          </div>
        ))}
      </div>

      <div className="module-grid-2 currency-reports-charts">
        <section className="module-card currency-reports-chart-card">
          <h2>Son 7 gün değişim</h2>
          <p className="cash-reports-chart-sub">Bugünkü kur ile 7 gün önceki kur karşılaştırması</p>
          <div className="reports-brand-chart">
            {dashboard.weekChange.map((row) => (
              <div key={row.currency} className="reports-brand-chart-row">
                <div className="reports-brand-chart-head">
                  <span>{row.label}</span>
                  <strong className={
                    row.changePercent != null && row.changePercent < 0
                      ? 'accounting-partner-profit-warn'
                      : ''
                  }>
                    {formatPercent(row.changePercent)}
                    {row.changeAbsolute != null ? ` · ${row.changeAbsolute >= 0 ? '+' : ''}${row.changeAbsolute.toFixed(4)} ₺` : ''}
                  </strong>
                </div>
                <div className="reports-brand-chart-track">
                  <span
                    className="reports-brand-chart-fill currency-reports-fill--change"
                    style={{
                      width: row.changePercent != null
                        ? `${Math.min(100, Math.max(8, Math.abs(row.changePercent) * 8))}%`
                        : '8%',
                    }}
                  />
                </div>
                <small>
                  {row.pastRate != null
                    ? `7 gün önce: ${row.pastRate.toFixed(4)} → Şimdi: ${row.currentRate.toFixed(4)}`
                    : '7 gün önce için kayıt yok'}
                </small>
              </div>
            ))}
          </div>
          <CurrencyTrendBars title="USD — son 7 gün" points={dashboard.weekTrendByCurrency.USD} maxRate={maxWeekUsd} />
          <CurrencyTrendBars title="KZT — son 7 gün" points={dashboard.weekTrendByCurrency.KZT} maxRate={maxWeekKzt} />
        </section>

        <section className="module-card currency-reports-chart-card">
          <h2>Son 30 gün değişim</h2>
          <p className="cash-reports-chart-sub">Bugünkü kur ile 30 gün önceki kur karşılaştırması</p>
          <div className="reports-brand-chart">
            {dashboard.monthChange.map((row) => (
              <div key={row.currency} className="reports-brand-chart-row">
                <div className="reports-brand-chart-head">
                  <span>{row.label}</span>
                  <strong className={
                    row.changePercent != null && row.changePercent < 0
                      ? 'accounting-partner-profit-warn'
                      : ''
                  }>
                    {formatPercent(row.changePercent)}
                    {row.changeAbsolute != null ? ` · ${row.changeAbsolute >= 0 ? '+' : ''}${row.changeAbsolute.toFixed(4)} ₺` : ''}
                  </strong>
                </div>
                <div className="reports-brand-chart-track">
                  <span
                    className="reports-brand-chart-fill currency-reports-fill--change-month"
                    style={{
                      width: row.changePercent != null
                        ? `${Math.min(100, Math.max(8, Math.abs(row.changePercent) * 3))}%`
                        : '8%',
                    }}
                  />
                </div>
                <small>
                  {row.pastRate != null
                    ? `30 gün önce: ${row.pastRate.toFixed(4)} → Şimdi: ${row.currentRate.toFixed(4)}`
                    : '30 gün önce için kayıt yok'}
                </small>
              </div>
            ))}
          </div>
          <CurrencyTrendBars title="USD — son 30 gün" points={dashboard.monthTrendByCurrency.USD} maxRate={maxMonthUsd} />
          <CurrencyTrendBars title="KZT — son 30 gün" points={dashboard.monthTrendByCurrency.KZT} maxRate={maxMonthKzt} />
        </section>
      </div>

      <section className="module-card currency-reports-table-card">
        <div className="currency-reports-table-head">
          <h2>Güncel kurlar</h2>
        </div>
        <table className="module-table module-table--wide currency-reports-table">
          <thead>
            <tr>
              <th>Para birimi</th>
              <th className="customer-list-col-num">1 birim = TL</th>
              <th className="customer-list-col-num">Alış</th>
              <th className="customer-list-col-num">Satış</th>
              <th>Kaynak</th>
              <th>Güncelleme</th>
            </tr>
          </thead>
          <tbody>
            {dashboard.rates.map((row) => (
              <tr key={row.code}>
                <td><strong>{row.label}</strong></td>
                <td className="customer-list-col-num">{row.rateToTry.toFixed(4)}</td>
                <td className="customer-list-col-num">{row.buyRate?.toFixed(4) ?? '—'}</td>
                <td className="customer-list-col-num">{row.sellRate?.toFixed(4) ?? '—'}</td>
                <td>{row.source}{row.isManualOverride ? ' · manuel' : ''}</td>
                <td>{formatDateTime(row.updatedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
