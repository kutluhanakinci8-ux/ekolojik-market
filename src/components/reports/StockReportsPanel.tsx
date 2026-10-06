import { useMemo } from 'react';
import type { Store } from '../../store/useStore';
import type { ReportPeriod } from '../../utils/analytics';
import { buildStockReportDashboard } from '../../utils/stockReportAnalytics';
import { formatCurrency } from '../../utils/format';
import { trialBalancePeriodLabel } from '../../utils/trialBalance';

interface StockReportsPanelProps {
  store: Store;
  period: ReportPeriod;
}

function maxChartValue(rows: { value: number }[]): number {
  return Math.max(...rows.map((row) => row.value), 1);
}

function maxTrendValue(points: { total: number }[]): number {
  return Math.max(...points.map((point) => point.total), 1);
}

export function StockReportsPanel({ store, period }: StockReportsPanelProps) {
  const periodLabel = trialBalancePeriodLabel(period);

  const dashboard = useMemo(
    () => buildStockReportDashboard(store.products, store.stockAdjustments, period),
    [store.products, store.stockAdjustments, period],
  );

  const maxValue = maxChartValue(dashboard.valueChart);
  const maxCategory = maxChartValue(dashboard.categoryChart);
  const maxAdjType = maxChartValue(dashboard.adjustmentTypeChart);
  const maxTrend = maxTrendValue(dashboard.dailyAdjustmentTrend);

  return (
    <div className="accounting-reports-section stock-reports-premium">
      <p className="module-hint">
        Dönem: <strong>{periodLabel}</strong>. Stok değeri güncel alış fiyatı × adet ile hesaplanır;
        düzeltme grafikleri seçili döneme göre filtrelenir.
      </p>

      <div className="accounting-partner-profit-kpis stock-reports-kpis">
        <div className="accounting-partner-profit-kpi">
          <span className="accounting-partner-profit-kpi-label">Stok değeri</span>
          <strong>{formatCurrency(dashboard.valuation.totalValue)}</strong>
          <em>{dashboard.valuation.totalUnits} adet</em>
        </div>
        <div className="accounting-partner-profit-kpi">
          <span className="accounting-partner-profit-kpi-label">Stoklu ürün</span>
          <strong>{dashboard.inStockProductCount}</strong>
        </div>
        <div className="accounting-partner-profit-kpi">
          <span className="accounting-partner-profit-kpi-label">Tükenen ürün</span>
          <strong className={dashboard.outOfStockCount > 0 ? 'accounting-partner-profit-warn' : ''}>
            {dashboard.outOfStockCount}
          </strong>
        </div>
        <div className="accounting-partner-profit-kpi">
          <span className="accounting-partner-profit-kpi-label">Dönem düzeltme</span>
          <strong>{dashboard.periodAdjustmentCount}</strong>
          <em>{formatCurrency(dashboard.periodMovementValue)} hareket</em>
        </div>
      </div>

      <div className="module-grid-2 stock-reports-charts">
        <section className="module-card stock-reports-chart-card">
          <h2>En yüksek stok değeri</h2>
          <p className="cash-reports-chart-sub">Ürün bazında envanter değeri</p>
          {dashboard.valueChart.length === 0 ? (
            <p className="module-empty">Stokta ürün yok</p>
          ) : (
            <div className="reports-brand-chart stock-reports-chart-scroll">
              {dashboard.valueChart.map((row) => (
                <div key={row.key} className="reports-brand-chart-row">
                  <div className="reports-brand-chart-head">
                    <span>{row.label}</span>
                    <strong>{row.displayValue} · {(row.share * 100).toFixed(0)}%</strong>
                  </div>
                  <div className="reports-brand-chart-track">
                    <span
                      className="reports-brand-chart-fill stock-reports-fill--value"
                      style={{ width: `${Math.max(4, (row.value / maxValue) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="module-card stock-reports-chart-card">
          <h2>Kategori stok değeri</h2>
          <p className="cash-reports-chart-sub">Kategorilere göre toplam envanter</p>
          {dashboard.categoryChart.length === 0 ? (
            <p className="module-empty">Kategori verisi yok</p>
          ) : (
            <div className="reports-brand-chart stock-reports-chart-scroll">
              {dashboard.categoryChart.map((row) => (
                <div key={row.key} className="reports-brand-chart-row">
                  <div className="reports-brand-chart-head">
                    <span>{row.label}</span>
                    <strong>{row.displayValue} · {(row.share * 100).toFixed(0)}%</strong>
                  </div>
                  <div className="reports-brand-chart-track">
                    <span
                      className="reports-brand-chart-fill stock-reports-fill--category"
                      style={{ width: `${Math.max(4, (row.value / maxCategory) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="module-card stock-reports-chart-card">
          <h2>Dönem stok düzeltmeleri</h2>
          <p className="cash-reports-chart-sub">Düzeltme türüne göre hareket değeri</p>
          {dashboard.adjustmentTypeChart.length === 0 ? (
            <p className="module-empty">Bu dönemde düzeltme yok</p>
          ) : (
            <div className="reports-brand-chart stock-reports-chart-scroll">
              {dashboard.adjustmentTypeChart.map((row) => (
                <div key={row.key} className="reports-brand-chart-row">
                  <div className="reports-brand-chart-head">
                    <span>{row.label}</span>
                    <strong>{row.displayValue} · {(row.share * 100).toFixed(0)}%</strong>
                  </div>
                  <div className="reports-brand-chart-track">
                    <span
                      className="reports-brand-chart-fill stock-reports-fill--adjust"
                      style={{ width: `${Math.max(4, (row.value / maxAdjType) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="module-card stock-reports-chart-card">
          <h2>Günlük düzeltme trendi</h2>
          <p className="cash-reports-chart-sub">Mutlak hareket değeri (adet × birim maliyet)</p>
          {dashboard.dailyAdjustmentTrend.length === 0 ? (
            <p className="module-empty">Trend verisi yok</p>
          ) : (
            <div className="cash-reports-bar-chart stock-reports-trend-chart">
              {dashboard.dailyAdjustmentTrend.map((point) => (
                <div key={point.date} className="cash-reports-bar-group">
                  <div className="cash-reports-bar-stack">
                    <div
                      className="cash-reports-bar cash-reports-bar--in"
                      style={{ height: `${Math.max(6, (point.total / maxTrend) * 100)}%` }}
                      title={formatCurrency(point.total)}
                    />
                  </div>
                  <span className="cash-reports-bar-net is-positive">{formatCurrency(point.total)}</span>
                  <span className="cash-reports-bar-label">{point.dateLabel}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="module-card stock-reports-table-card">
        <div className="stock-reports-table-head">
          <h2>Stok envanteri</h2>
          <span className="stock-reports-table-badge">{dashboard.valuation.rows.length} ürün</span>
        </div>
        <table className="module-table module-table--wide stock-reports-table">
          <thead>
            <tr>
              <th>Ürün</th>
              <th className="customer-list-col-num">Adet</th>
              <th className="customer-list-col-num">Birim maliyet</th>
              <th className="customer-list-col-num">Stok değeri</th>
            </tr>
          </thead>
          <tbody>
            {dashboard.valuation.rows.length === 0 ? (
              <tr><td colSpan={4} className="module-empty">Stokta ürün yok</td></tr>
            ) : dashboard.valuation.rows.map((row) => (
              <tr key={row.productId}>
                <td><strong>{row.name}</strong></td>
                <td className="customer-list-col-num">{row.quantity}</td>
                <td className="customer-list-col-num">{formatCurrency(row.unitCost)}</td>
                <td className="customer-list-col-num">{formatCurrency(row.totalValue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
