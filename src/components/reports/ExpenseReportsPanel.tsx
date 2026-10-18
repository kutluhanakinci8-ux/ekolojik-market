import { useMemo } from 'react';
import type { Store } from '../../store/useStore';
import type { ReportPeriod } from '../../utils/analytics';
import { buildExpenseReportDashboard } from '../../utils/expenseReportAnalytics';
import { getExpenseCategoryLabel } from '../../utils/expenseCategories';
import { formatCurrency, formatDateTime } from '../../utils/format';
import { trialBalancePeriodLabel } from '../../utils/trialBalance';

interface ExpenseReportsPanelProps {
  store: Store;
  period: ReportPeriod;
}

function maxChartValue(rows: { value: number }[]): number {
  return Math.max(...rows.map((row) => row.value), 1);
}

function maxTrendValue(points: { total: number }[]): number {
  return Math.max(...points.map((point) => point.total), 1);
}

export function ExpenseReportsPanel({ store, period }: ExpenseReportsPanelProps) {
  const periodLabel = trialBalancePeriodLabel(period);
  const customCategories = store.settings.customExpenseCategories ?? [];

  const dashboard = useMemo(
    () => buildExpenseReportDashboard(
      store.sales,
      store.saleReturns,
      store.expenses,
      store.products,
      store.stockAdjustments,
      customCategories,
      period,
    ),
    [
      store.sales,
      store.saleReturns,
      store.expenses,
      store.products,
      store.stockAdjustments,
      customCategories,
      period,
    ],
  );

  const maxCategory = maxChartValue(dashboard.categoryChart);
  const maxSupplier = maxChartValue(dashboard.supplierChart);
  const maxTop = maxChartValue(dashboard.topExpenseChart);
  const maxTrend = maxTrendValue(dashboard.dailyTrend);

  return (
    <div className="accounting-reports-section expense-reports-premium">
      <p className="module-hint">
        Dönem: <strong>{periodLabel}</strong>. Faaliyet giderleri seçili dönemdeki kayıtlardan hesaplanır.
      </p>

      <div className="accounting-partner-profit-kpis expense-reports-kpis">
        <div className="accounting-partner-profit-kpi">
          <span className="accounting-partner-profit-kpi-label">Toplam gider</span>
          <strong>{formatCurrency(dashboard.totalExpenses)}</strong>
          <em>{dashboard.expenseCount} kayıt</em>
        </div>
        <div className="accounting-partner-profit-kpi">
          <span className="accounting-partner-profit-kpi-label">Ortalama gider</span>
          <strong>{formatCurrency(dashboard.averageExpense)}</strong>
        </div>
        <div className="accounting-partner-profit-kpi">
          <span className="accounting-partner-profit-kpi-label">Net satışa oran</span>
          <strong>{dashboard.expenseToRevenuePercent.toFixed(1)}%</strong>
          <em>Satış {formatCurrency(dashboard.profitLoss.netRevenue)}</em>
        </div>
        <div className="accounting-partner-profit-kpi">
          <span className="accounting-partner-profit-kpi-label">KDV (gider)</span>
          <strong>{formatCurrency(dashboard.totalVat)}</strong>
        </div>
      </div>

      <div className="module-grid-2 expense-reports-charts">
        <section className="module-card expense-reports-chart-card">
          <h2>Kategori dağılımı</h2>
          <p className="cash-reports-chart-sub">Gider kategorilerine göre toplam</p>
          {dashboard.categoryChart.length === 0 ? (
            <p className="module-empty">Bu dönemde gider kaydı yok</p>
          ) : (
            <div className="reports-brand-chart expense-reports-chart-scroll">
              {dashboard.categoryChart.map((row) => (
                <div key={row.key} className="reports-brand-chart-row">
                  <div className="reports-brand-chart-head">
                    <span>{row.label}</span>
                    <strong>{row.displayValue} · {(row.share * 100).toFixed(0)}%</strong>
                  </div>
                  <div className="reports-brand-chart-track">
                    <span
                      className="reports-brand-chart-fill expense-reports-fill--category"
                      style={{ width: `${Math.max(4, (row.value / maxCategory) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="module-card expense-reports-chart-card">
          <h2>Günlük gider trendi</h2>
          <p className="cash-reports-chart-sub">İş günü / kayıt tarihine göre</p>
          {dashboard.dailyTrend.length === 0 ? (
            <p className="module-empty">Trend verisi yok</p>
          ) : (
            <div className="cash-reports-bar-chart expense-reports-trend-chart">
              {dashboard.dailyTrend.map((point) => (
                <div key={point.date} className="cash-reports-bar-group">
                  <div className="cash-reports-bar-stack">
                    <div
                      className="cash-reports-bar cash-reports-bar--out"
                      style={{ height: `${Math.max(6, (point.total / maxTrend) * 100)}%` }}
                      title={formatCurrency(point.total)}
                    />
                  </div>
                  <span className="cash-reports-bar-net is-negative">{formatCurrency(point.total)}</span>
                  <span className="cash-reports-bar-label">{point.dateLabel}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="module-card expense-reports-chart-card">
          <h2>Tedarikçi / firma</h2>
          <p className="cash-reports-chart-sub">Gider kaydındaki tedarikçi adına göre</p>
          {dashboard.supplierChart.length === 0 ? (
            <p className="module-empty">Tedarikçi adı girilmiş gider yok</p>
          ) : (
            <div className="reports-brand-chart expense-reports-chart-scroll">
              {dashboard.supplierChart.map((row) => (
                <div key={row.key} className="reports-brand-chart-row">
                  <div className="reports-brand-chart-head">
                    <span>{row.label}</span>
                    <strong>{row.displayValue} · {(row.share * 100).toFixed(0)}%</strong>
                  </div>
                  <div className="reports-brand-chart-track">
                    <span
                      className="reports-brand-chart-fill expense-reports-fill--supplier"
                      style={{ width: `${Math.max(4, (row.value / maxSupplier) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="module-card expense-reports-chart-card">
          <h2>En yüksek giderler</h2>
          <p className="cash-reports-chart-sub">Dönemdeki en büyük kalemler</p>
          {dashboard.topExpenseChart.length === 0 ? (
            <p className="module-empty">Kayıt yok</p>
          ) : (
            <div className="reports-brand-chart expense-reports-chart-scroll">
              {dashboard.topExpenseChart.map((row) => (
                <div key={row.key} className="reports-brand-chart-row">
                  <div className="reports-brand-chart-head">
                    <span>{row.label}</span>
                    <strong>{row.displayValue} · {(row.share * 100).toFixed(0)}%</strong>
                  </div>
                  <div className="reports-brand-chart-track">
                    <span
                      className="reports-brand-chart-fill expense-reports-fill--top"
                      style={{ width: `${Math.max(4, (row.value / maxTop) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="module-card expense-reports-table-card">
        <div className="expense-reports-table-head">
          <h2>Gider hareketleri</h2>
          <span className="expense-reports-table-badge">{dashboard.expenseCount} kayıt</span>
        </div>
        <table className="module-table module-table--wide expense-reports-table">
          <thead>
            <tr>
              <th>Tarih</th>
              <th>Kategori</th>
              <th>Açıklama</th>
              <th className="customer-list-col-num">Tutar</th>
            </tr>
          </thead>
          <tbody>
            {dashboard.expenses.length === 0 ? (
              <tr><td colSpan={4} className="module-empty">Kayıt yok</td></tr>
            ) : dashboard.expenses.map((row) => (
              <tr key={row.id}>
                <td>{formatDateTime(row.createdAt)}</td>
                <td>{getExpenseCategoryLabel(row.category, customCategories)}</td>
                <td>{row.description?.trim() || row.documentNo || '—'}</td>
                <td className="customer-list-col-num is-negative">{formatCurrency(row.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
