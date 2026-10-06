import { useMemo } from 'react';
import type { Store } from '../store/useStore';
import type { ReportPeriod } from '../utils/analytics';
import { buildCashReport, resolveCashReportDateRange } from '../utils/cashReportAnalytics';
import { formatCurrency, formatDateTime } from '../utils/format';
import { getExpenseCategoryLabel } from '../utils/expenseCategories';
import { trialBalancePeriodLabel } from '../utils/trialBalance';

interface CashReportsPanelProps {
  store: Store;
  period: ReportPeriod;
  useCustomRange: boolean;
  dateFrom: string;
  dateTo: string;
}

function maxBarValue(values: number[]): number {
  return Math.max(...values, 1);
}

function maxChartValue(rows: { value: number }[]): number {
  return Math.max(...rows.map((row) => row.value), 1);
}

export function CashReportsPanel({
  store,
  period,
  useCustomRange,
  dateFrom,
  dateTo,
}: CashReportsPanelProps) {
  const periodLabel = trialBalancePeriodLabel(period);

  const report = useMemo(() => {
    const range = resolveCashReportDateRange(
      period,
      useCustomRange,
      dateFrom,
      dateTo,
      store.sales,
      store.expenses,
      store.cashHandovers,
      store.saleReturns,
      store.cashSessions,
    );
    return buildCashReport(
      store.sales,
      store.saleReturns,
      store.expenses,
      store.cashHandovers,
      store.cashSessions,
      range,
      store.settings.customExpenseCategories ?? [],
      store.journalVouchers,
    );
  }, [
    period,
    useCustomRange,
    dateFrom,
    dateTo,
    store.sales,
    store.saleReturns,
    store.expenses,
    store.cashHandovers,
    store.cashSessions,
    store.settings.customExpenseCategories,
    store.journalVouchers,
  ]);

  const maxFlow = maxBarValue(
    report.cashFlowTrend.flatMap((point) => [point.inflow, point.outflow, Math.abs(point.net)]),
  );

  const expenseChart = useMemo(
    () => report.expenseByCategory.map((row) => ({
      key: row.category,
      label: row.label,
      value: row.total,
      share: row.share,
    })),
    [report.expenseByCategory],
  );
  const maxExpense = maxChartValue(expenseChart.map((row) => ({ value: row.value })));

  const activityChart = useMemo(
    () => report.activityBreakdown.map((row) => ({
      key: row.kind,
      label: row.label,
      value: Math.abs(row.cashImpact),
      display: row.cashImpact,
    })),
    [report.activityBreakdown],
  );
  const maxActivity = maxChartValue(activityChart.map((row) => ({ value: row.value })));

  const customCategories = store.settings.customExpenseCategories ?? [];

  return (
    <div className="accounting-reports-section cash-reports cash-reports-premium">
      <p className="module-hint">
        Dönem: <strong>{periodLabel}</strong>. Nakit hareketleri kasa oturumu, nakit satış, gider ve devir kayıtlarından hesaplanır.
      </p>

      <div className="accounting-partner-profit-kpis cash-reports-kpis-premium">
        <div className="accounting-partner-profit-kpi">
          <span className="accounting-partner-profit-kpi-label">Nakit tahsilat</span>
          <strong>{formatCurrency(report.totalCashSales)}</strong>
        </div>
        <div className="accounting-partner-profit-kpi">
          <span className="accounting-partner-profit-kpi-label">Nakit iade</span>
          <strong className="accounting-partner-profit-warn">{formatCurrency(report.totalCashRefunds)}</strong>
        </div>
        <div className="accounting-partner-profit-kpi">
          <span className="accounting-partner-profit-kpi-label">Toplam gider</span>
          <strong>{formatCurrency(report.totalExpenses)}</strong>
        </div>
        <div className="accounting-partner-profit-kpi">
          <span className="accounting-partner-profit-kpi-label">Yönetime devir</span>
          <strong>{formatCurrency(report.totalHandovers)}</strong>
        </div>
        <div className="accounting-partner-profit-kpi">
          <span className="accounting-partner-profit-kpi-label">Net nakit akış</span>
          <strong className={report.netCashMovement >= 0 ? '' : 'accounting-partner-profit-warn'}>
            {formatCurrency(report.netCashMovement)}
          </strong>
          <em>Ort. kapanış {formatCurrency(report.averageClosing)}</em>
        </div>
        <div className="accounting-partner-profit-kpi">
          <span className="accounting-partner-profit-kpi-label">Kasa günü</span>
          <strong>{report.sessionCount}</strong>
          <em>{report.closedSessionCount} kapatıldı</em>
        </div>
      </div>

      <div className="module-grid-2 cash-reports-charts">
        <section className="module-card cash-reports-chart-card">
          <h2>Günlük nakit akışı</h2>
          <p className="cash-reports-chart-sub">Yeşil: tahsilat · Kırmızı: çıkış · Alt satır: net</p>
          {report.cashFlowTrend.length === 0 ? (
            <p className="module-empty">Bu dönemde veri yok</p>
          ) : (
            <div className="cash-reports-bar-chart cash-reports-trend-chart-premium">
              {report.cashFlowTrend.map((point) => (
                <div key={point.date} className="cash-reports-bar-group">
                  <div className="cash-reports-bar-stack">
                    <div
                      className="cash-reports-bar cash-reports-bar--in"
                      style={{ height: `${Math.max(4, (point.inflow / maxFlow) * 100)}%` }}
                      title={`Tahsilat: ${formatCurrency(point.inflow)}`}
                    />
                    <div
                      className="cash-reports-bar cash-reports-bar--out"
                      style={{ height: `${Math.max(4, (point.outflow / maxFlow) * 100)}%` }}
                      title={`Çıkış: ${formatCurrency(point.outflow)}`}
                    />
                  </div>
                  <span className={`cash-reports-bar-net ${point.net >= 0 ? 'is-positive' : 'is-negative'}`}>
                    {formatCurrency(point.net)}
                  </span>
                  <span className="cash-reports-bar-label">{point.dateLabel}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="module-card cash-reports-chart-card">
          <h2>Gider kategorileri</h2>
          <p className="cash-reports-chart-sub">Dönemdeki nakit çıkışları — gider dağılımı</p>
          {expenseChart.length === 0 ? (
            <p className="module-empty">Gider kaydı yok</p>
          ) : (
            <div className="reports-brand-chart cash-reports-chart-scroll">
              {expenseChart.map((row) => (
                <div key={row.key} className="reports-brand-chart-row">
                  <div className="reports-brand-chart-head">
                    <span>{row.label}</span>
                    <strong>{formatCurrency(row.value)} · {row.share}%</strong>
                  </div>
                  <div className="reports-brand-chart-track">
                    <span
                      className="reports-brand-chart-fill cash-reports-fill--expense"
                      style={{ width: `${Math.max(4, (row.value / maxExpense) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="module-card cash-reports-chart-card">
          <h2>Nakit hareket türleri</h2>
          <p className="cash-reports-chart-sub">Satış, iade, gider ve devir — kasa etkisi</p>
          {activityChart.length === 0 ? (
            <p className="module-empty">Hareket kaydı yok</p>
          ) : (
            <div className="reports-brand-chart cash-reports-chart-scroll">
              {activityChart.map((row) => (
                <div key={row.key} className="reports-brand-chart-row">
                  <div className="reports-brand-chart-head">
                    <span>{row.label}</span>
                    <strong className={row.display >= 0 ? '' : 'accounting-partner-profit-warn'}>
                      {row.display >= 0 ? '+' : ''}{formatCurrency(row.display)}
                    </strong>
                  </div>
                  <div className="reports-brand-chart-track">
                    <span
                      className={`reports-brand-chart-fill cash-reports-fill--activity cash-reports-fill--activity-${row.key}`}
                      style={{ width: `${Math.max(4, (row.value / maxActivity) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="module-card cash-reports-chart-card cash-reports-breakdown-card">
          <h2>Özet kırılım</h2>
          <p className="cash-reports-chart-sub">İşlem adedi ve toplam tutar</p>
          <div className="cash-reports-breakdown-grid cash-reports-breakdown-grid--premium">
            {report.activityBreakdown.map((row) => (
              <div key={row.kind} className={`cash-reports-breakdown-item cash-reports-breakdown-item--${row.kind}`}>
                <span className="cash-reports-breakdown-label">{row.label}</span>
                <strong className={row.cashImpact >= 0 ? 'is-positive' : 'is-negative'}>
                  {row.cashImpact >= 0 ? '+' : ''}{formatCurrency(row.cashImpact)}
                </strong>
                <small>{row.count} işlem · Toplam {formatCurrency(row.total)}</small>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="module-card cash-reports-table-card-premium">
        <div className="cash-reports-table-head-premium">
          <h2>Günlük kasa özeti</h2>
          <span className="cash-reports-table-badge">{report.dailyRows.length} gün</span>
        </div>
        {report.dailyRows.length === 0 ? (
          <p className="module-empty">Bu dönemde kasa hareketi yok</p>
        ) : (
          <div className="cash-reports-table-wrap">
            <table className="module-table module-table--wide cash-reports-table cash-reports-table--premium">
              <thead>
                <tr>
                  <th>Tarih</th>
                  <th>Açılış</th>
                  <th>Satış</th>
                  <th>İade</th>
                  <th>Gider</th>
                  <th>Devir</th>
                  <th>Net nakit</th>
                  <th>Kapanış</th>
                  <th>Durum</th>
                </tr>
              </thead>
              <tbody>
                {[...report.dailyRows].reverse().map((row) => (
                  <tr key={row.date}>
                    <td>{row.dateLabel}</td>
                    <td>{formatCurrency(row.openingBalance)}</td>
                    <td className="is-positive">{formatCurrency(row.cashSales)}</td>
                    <td className="is-negative">{formatCurrency(row.cashRefunds)}</td>
                    <td className="is-negative">{formatCurrency(row.expenseTotal)}</td>
                    <td className="is-negative">{formatCurrency(row.handoverTotal)}</td>
                    <td className={row.netCashFlow >= 0 ? 'is-positive' : 'is-negative'}>
                      {formatCurrency(row.netCashFlow)}
                    </td>
                    <td><strong>{formatCurrency(row.closingBalance)}</strong></td>
                    <td>
                      <span className={`cash-reports-status ${row.isClosed ? 'is-closed' : 'is-open'}`}>
                        {row.isClosed ? 'Kapalı' : 'Açık'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="module-grid-2 cash-reports-detail-grid">
        <section className="module-card cash-reports-table-card-premium">
          <div className="cash-reports-table-head-premium">
            <h2>Gider listesi</h2>
            <span className="cash-reports-table-badge">{report.expenses.length} kayıt</span>
          </div>
          {report.expenses.length === 0 ? (
            <p className="module-empty">Gider kaydı yok</p>
          ) : (
            <div className="cash-reports-table-wrap">
              <table className="module-table cash-reports-table cash-reports-table--premium">
                <thead>
                  <tr>
                    <th>Tarih</th>
                    <th>Açıklama</th>
                    <th>Kategori</th>
                    <th>Tutar</th>
                  </tr>
                </thead>
                <tbody>
                  {report.expenses.map((expense) => (
                    <tr key={expense.id}>
                      <td>{formatDateTime(expense.createdAt)}</td>
                      <td>{expense.description}</td>
                      <td>{getExpenseCategoryLabel(expense.category, customCategories)}</td>
                      <td className="is-negative">{formatCurrency(expense.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="module-card cash-reports-table-card-premium">
          <div className="cash-reports-table-head-premium">
            <h2>Yönetime devir</h2>
            <span className="cash-reports-table-badge">{report.handovers.length} kayıt</span>
          </div>
          {report.handovers.length === 0 ? (
            <div className="cash-reports-empty-hint">
              <p className="module-empty">Bu dönemde yönetime nakit devri yapılmadı</p>
              <p>
                Kasa ekranında <strong>⇢ Yönetime Nakit Devri</strong> bölümünden tutar girip
                <strong> Devret</strong> ile kayıt oluşturun.
              </p>
            </div>
          ) : (
            <div className="cash-reports-table-wrap">
              <table className="module-table cash-reports-table cash-reports-table--premium">
                <thead>
                  <tr>
                    <th>Tarih</th>
                    <th>Alıcı</th>
                    <th>Not</th>
                    <th>Tutar</th>
                  </tr>
                </thead>
                <tbody>
                  {report.handovers.map((handover) => (
                    <tr key={handover.id}>
                      <td>{formatDateTime(handover.createdAt)}</td>
                      <td>{handover.recipient}</td>
                      <td>{handover.note || '—'}</td>
                      <td className="is-negative">{formatCurrency(handover.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
