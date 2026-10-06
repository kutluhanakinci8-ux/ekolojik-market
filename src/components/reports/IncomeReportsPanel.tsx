import { useMemo } from 'react';
import type { Store } from '../../store/useStore';
import type { ReportPeriod } from '../../utils/analytics';
import { buildIncomeReportDashboard } from '../../utils/incomeReportAnalytics';
import { formatCurrency } from '../../utils/format';
import { exportProfitLossCsv } from '../../utils/reportExport';
import { trialBalancePeriodLabel } from '../../utils/trialBalance';

interface IncomeReportsPanelProps {
  store: Store;
  period: ReportPeriod;
}

function maxChartValue(rows: { value: number }[]): number {
  return Math.max(...rows.map((row) => row.value), 1);
}

function maxTrendValue(points: { total: number }[]): number {
  return Math.max(...points.map((point) => point.total), 1);
}

const STRUCTURE_COLORS: Record<string, string> = {
  revenue: 'linear-gradient(90deg, #2563eb 0%, #60a5fa 100%)',
  cogs: 'linear-gradient(90deg, #b45309 0%, #f59e0b 100%)',
  gross: 'linear-gradient(90deg, #059669 0%, #34d399 100%)',
  opex: 'linear-gradient(90deg, #dc2626 0%, #f87171 100%)',
  net: 'linear-gradient(90deg, #7c3aed 0%, #a78bfa 100%)',
};

export function IncomeReportsPanel({ store, period }: IncomeReportsPanelProps) {
  const periodLabel = trialBalancePeriodLabel(period);

  const dashboard = useMemo(
    () => buildIncomeReportDashboard(
      store.sales,
      store.saleReturns,
      store.expenses,
      store.products,
      store.stockAdjustments,
      period,
    ),
    [
      store.sales,
      store.saleReturns,
      store.expenses,
      store.products,
      store.stockAdjustments,
      period,
    ],
  );

  const { profitLoss } = dashboard;
  const maxStructure = maxChartValue(dashboard.structureChart);
  const maxPayment = maxChartValue(dashboard.paymentChart);
  const maxCategory = maxChartValue(dashboard.categoryChart);
  const maxTrend = maxTrendValue(dashboard.dailyTrend);

  return (
    <div className="accounting-reports-section income-reports-premium">
      <p className="module-hint">
        Dönem: <strong>{periodLabel}</strong>. Gelir tablosu KDV hariç net satış ve kârlılık üzerinden hesaplanır.
      </p>

      <div className="accounting-partner-profit-kpis income-reports-kpis">
        <div className="accounting-partner-profit-kpi">
          <span className="accounting-partner-profit-kpi-label">Net satış</span>
          <strong>{formatCurrency(profitLoss.netRevenue)}</strong>
          <em>{dashboard.saleCount} satış</em>
        </div>
        <div className="accounting-partner-profit-kpi">
          <span className="accounting-partner-profit-kpi-label">Brüt kâr</span>
          <strong>{formatCurrency(profitLoss.grossProfit)}</strong>
          <em>Marj {profitLoss.grossMargin.toFixed(1)}%</em>
        </div>
        <div className="accounting-partner-profit-kpi">
          <span className="accounting-partner-profit-kpi-label">Net kâr</span>
          <strong className={profitLoss.netProfit < 0 ? 'accounting-partner-profit-warn' : ''}>
            {formatCurrency(profitLoss.netProfit)}
          </strong>
          <em>Net marj {dashboard.netMarginPercent.toFixed(1)}%</em>
        </div>
        <div className="accounting-partner-profit-kpi">
          <span className="accounting-partner-profit-kpi-label">İade</span>
          <strong>{formatCurrency(dashboard.returnsGrossTotal)}</strong>
          <em>{dashboard.returnCount} işlem</em>
        </div>
      </div>

      <div className="module-grid-2 income-reports-charts">
        <section className="module-card income-reports-chart-card">
          <h2>Gelir tablosu yapısı</h2>
          <p className="cash-reports-chart-sub">Net satıştan net kâra kırılım</p>
          {dashboard.structureChart.length === 0 ? (
            <p className="module-empty">Bu dönemde gelir verisi yok</p>
          ) : (
            <div className="reports-brand-chart income-reports-chart-scroll">
              {dashboard.structureChart.map((row) => (
                <div key={row.key} className="reports-brand-chart-row">
                  <div className="reports-brand-chart-head">
                    <span>{row.label}</span>
                    <strong>{row.displayValue} · {(row.share * 100).toFixed(0)}%</strong>
                  </div>
                  <div className="reports-brand-chart-track">
                    <span
                      className="reports-brand-chart-fill"
                      style={{
                        width: `${Math.max(4, (row.value / maxStructure) * 100)}%`,
                        background: STRUCTURE_COLORS[row.key],
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="module-card income-reports-chart-card">
          <h2>Ödeme yöntemi dağılımı</h2>
          <p className="cash-reports-chart-sub">Dönem satış tahsilatları (iade düşülmüş)</p>
          {dashboard.paymentChart.length === 0 ? (
            <p className="module-empty">Ödeme kaydı yok</p>
          ) : (
            <div className="reports-brand-chart income-reports-chart-scroll">
              {dashboard.paymentChart.map((row) => (
                <div key={row.key} className="reports-brand-chart-row">
                  <div className="reports-brand-chart-head">
                    <span>{row.label}</span>
                    <strong>{row.displayValue} · {(row.share * 100).toFixed(0)}%</strong>
                  </div>
                  <div className="reports-brand-chart-track">
                    <span
                      className="reports-brand-chart-fill income-reports-fill--payment"
                      style={{ width: `${Math.max(4, (row.value / maxPayment) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="module-card income-reports-chart-card">
          <h2>Kategori geliri</h2>
          <p className="cash-reports-chart-sub">Ürün kategorilerine göre ciro (KDV dahil satır tutarı)</p>
          {dashboard.categoryChart.length === 0 ? (
            <p className="module-empty">Kategori geliri yok</p>
          ) : (
            <div className="reports-brand-chart income-reports-chart-scroll">
              {dashboard.categoryChart.map((row) => (
                <div key={row.key} className="reports-brand-chart-row">
                  <div className="reports-brand-chart-head">
                    <span>{row.label}</span>
                    <strong>{row.displayValue} · {(row.share * 100).toFixed(0)}%</strong>
                  </div>
                  <div className="reports-brand-chart-track">
                    <span
                      className="reports-brand-chart-fill income-reports-fill--category"
                      style={{ width: `${Math.max(4, (row.value / maxCategory) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="module-card income-reports-chart-card">
          <h2>Günlük satış trendi</h2>
          <p className="cash-reports-chart-sub">Net satış tutarı (iade sonrası)</p>
          {dashboard.dailyTrend.length === 0 ? (
            <p className="module-empty">Trend verisi yok</p>
          ) : (
            <div className="cash-reports-bar-chart income-reports-trend-chart">
              {dashboard.dailyTrend.map((point) => (
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

      <section className="module-card income-reports-pl-card">
        <div className="income-reports-table-head">
          <h2>Gelir tablosu özet</h2>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => exportProfitLossCsv(profitLoss, period)}
          >
            CSV İndir
          </button>
        </div>
        <div className="accounting-pl-grid income-reports-pl-grid">
          <div className="accounting-pl-row">
            <span>Net satışlar</span>
            <strong>{formatCurrency(profitLoss.netRevenue)}</strong>
          </div>
          <div className="accounting-pl-row">
            <span>Satılan malın maliyeti (SMM)</span>
            <strong className="is-negative">-{formatCurrency(profitLoss.cogs)}</strong>
          </div>
          <div className="accounting-pl-row accounting-pl-row--highlight">
            <span>Brüt kâr</span>
            <strong>{formatCurrency(profitLoss.grossProfit)}</strong>
          </div>
          <div className="accounting-pl-row">
            <span>Faaliyet giderleri</span>
            <strong className="is-negative">-{formatCurrency(profitLoss.operatingExpenses)}</strong>
          </div>
          <div className="accounting-pl-row accounting-pl-row--total">
            <span>Net kâr</span>
            <strong>{formatCurrency(profitLoss.netProfit)}</strong>
          </div>
        </div>
      </section>
    </div>
  );
}
