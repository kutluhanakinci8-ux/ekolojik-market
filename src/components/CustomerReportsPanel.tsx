import { useMemo, useState } from 'react';
import type { Store } from '../store/useStore';
import type { ReportPeriod } from '../utils/analytics';
import { buildCustomerStatement } from '../utils/accountingAnalytics';
import { buildCustomerReportDashboard } from '../utils/customerReportAnalytics';
import { formatCurrency, formatDateTime } from '../utils/format';
import {
  exportCustomerLedgerCsv,
  exportCustomerPeriodSalesCsv,
} from '../utils/reportExport';
import { trialBalancePeriodLabel } from '../utils/trialBalance';
import { CrmCohortClvPanel } from './crm/CrmCohortClvPanel';

interface CustomerReportsPanelProps {
  store: Store;
  period: ReportPeriod;
}

function maxChartValue(rows: { value: number }[]): number {
  return Math.max(...rows.map((row) => row.value), 1);
}

export function CustomerReportsPanel({ store, period }: CustomerReportsPanelProps) {
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const periodLabel = trialBalancePeriodLabel(period);

  const dashboard = useMemo(
    () => buildCustomerReportDashboard(
      store.customers,
      store.customerLedger,
      store.sales,
      store.saleReturns,
      period,
    ),
    [store.customers, store.customerLedger, store.sales, store.saleReturns, period],
  );

  const customerStatement = useMemo(() => {
    if (!selectedCustomerId) return [];
    return buildCustomerStatement(selectedCustomerId, store.customerLedger);
  }, [selectedCustomerId, store.customerLedger]);

  const selectedCustomerName = useMemo(() => {
    if (!selectedCustomerId) return '';
    return store.customers.find((c) => c.id === selectedCustomerId)?.name ?? 'Müşteri';
  }, [selectedCustomerId, store.customers]);

  const maxAging = maxChartValue(dashboard.agingChart);
  const maxReceivable = maxChartValue(dashboard.receivableChart);
  const maxOverdue = maxChartValue(dashboard.overdueChart);
  const maxPeriodSales = maxChartValue(dashboard.periodSalesChart);

  return (
    <div className="accounting-reports-section customer-reports-premium">
      <p className="module-hint">
        Dönem: <strong>{periodLabel}</strong>. Alacak ve yaşlandırma güncel cari bakiyesidir;
        dönem satışları seçili aralıktaki müşteri bağlı satışları gösterir. Satıra tıklayarak ekstre açın.
      </p>

      <div className="accounting-partner-profit-kpis customer-reports-kpis">
        <div className="accounting-partner-profit-kpi">
          <span className="accounting-partner-profit-kpi-label">Toplam alacak</span>
          <strong>{formatCurrency(dashboard.receivableSummary.totalReceivable)}</strong>
          <em>{dashboard.receivableSummary.customerWithBalanceCount} müşteri</em>
        </div>
        <div className="accounting-partner-profit-kpi">
          <span className="accounting-partner-profit-kpi-label">Vadesi geçen</span>
          <strong className={dashboard.receivableSummary.totalOverdue > 0 ? 'accounting-partner-profit-warn' : ''}>
            {formatCurrency(dashboard.receivableSummary.totalOverdue)}
          </strong>
        </div>
        <div className="accounting-partner-profit-kpi">
          <span className="accounting-partner-profit-kpi-label">Dönem müşteri satışı</span>
          <strong>{formatCurrency(dashboard.periodSalesSummary.total)}</strong>
          <em>
            {dashboard.periodSalesSummary.saleCount} satış · {dashboard.periodSalesSummary.customerCount} müşteri
          </em>
        </div>
      </div>

      <div className="module-grid-2 customer-reports-charts">
        <section className="module-card customer-reports-chart-card">
          <h2>Alacak yaşlandırma</h2>
          <p className="cash-reports-chart-sub">Açık alacakların vade dilimleri (güncel)</p>
          {dashboard.agingChart.length === 0 ? (
            <p className="module-empty">Açık alacak yok</p>
          ) : (
            <div className="reports-brand-chart customer-reports-chart-scroll">
              {dashboard.agingChart.map((row) => (
                <div key={row.key} className="reports-brand-chart-row">
                  <div className="reports-brand-chart-head">
                    <span>{row.label}</span>
                    <strong>{row.displayValue} · {(row.share * 100).toFixed(0)}%</strong>
                  </div>
                  <div className="reports-brand-chart-track">
                    <span
                      className="reports-brand-chart-fill customer-reports-fill--aging"
                      style={{ width: `${Math.max(4, (row.value / maxAging) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="module-card customer-reports-chart-card">
          <h2>En yüksek alacaklar</h2>
          <p className="cash-reports-chart-sub">Güncel müşteri cari bakiyeleri</p>
          {dashboard.receivableChart.length === 0 ? (
            <p className="module-empty">Alacak kaydı yok</p>
          ) : (
            <div className="reports-brand-chart customer-reports-chart-scroll">
              {dashboard.receivableChart.map((row) => (
                <div key={row.key} className="reports-brand-chart-row">
                  <div className="reports-brand-chart-head">
                    <span>{row.label}</span>
                    <strong>{row.displayValue} · {(row.share * 100).toFixed(0)}%</strong>
                  </div>
                  <div className="reports-brand-chart-track">
                    <span
                      className="reports-brand-chart-fill customer-reports-fill--receivable"
                      style={{ width: `${Math.max(4, (row.value / maxReceivable) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="module-card customer-reports-chart-card">
          <h2>Vadesi geçen alacaklar</h2>
          <p className="cash-reports-chart-sub">Vade tarihi geçmiş açık kalemler</p>
          {dashboard.overdueChart.length === 0 ? (
            <p className="module-empty">Vadesi geçen alacak yok</p>
          ) : (
            <div className="reports-brand-chart customer-reports-chart-scroll">
              {dashboard.overdueChart.map((row) => (
                <div key={row.key} className="reports-brand-chart-row">
                  <div className="reports-brand-chart-head">
                    <span>{row.label}</span>
                    <strong className="accounting-partner-profit-warn">
                      {row.displayValue} · {(row.share * 100).toFixed(0)}%
                    </strong>
                  </div>
                  <div className="reports-brand-chart-track">
                    <span
                      className="reports-brand-chart-fill customer-reports-fill--overdue"
                      style={{ width: `${Math.max(4, (row.value / maxOverdue) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="module-card customer-reports-chart-card">
          <h2>Dönem satış sıralaması</h2>
          <p className="cash-reports-chart-sub">Seçili dönemde müşteri bağlı net satış</p>
          {dashboard.periodSalesChart.length === 0 ? (
            <p className="module-empty">Bu dönemde müşteri satışı yok</p>
          ) : (
            <div className="reports-brand-chart customer-reports-chart-scroll">
              {dashboard.periodSalesChart.map((row) => (
                <div key={row.key} className="reports-brand-chart-row">
                  <div className="reports-brand-chart-head">
                    <span>{row.label}</span>
                    <strong>{row.displayValue} · {(row.share * 100).toFixed(0)}%</strong>
                  </div>
                  <div className="reports-brand-chart-track">
                    <span
                      className="reports-brand-chart-fill customer-reports-fill--sales"
                      style={{ width: `${Math.max(4, (row.value / maxPeriodSales) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="module-grid-2 customer-reports-tables">
        <section className="module-card customer-reports-table-card">
          <div className="customer-reports-table-head">
            <h2>Cari alacaklar</h2>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => exportCustomerLedgerCsv(dashboard.customerRows)}
              disabled={dashboard.customerRows.length === 0}
            >
              CSV
            </button>
          </div>
          <table className="module-table module-table--wide customer-reports-table">
            <thead>
              <tr>
                <th>Müşteri</th>
                <th className="customer-list-col-num">Bakiye</th>
                <th className="customer-list-col-num">Vadesi geçen</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.customerRows.length === 0 ? (
                <tr><td colSpan={3} className="module-empty">Alacak kaydı yok</td></tr>
              ) : dashboard.customerRows.map((row) => (
                <tr
                  key={row.customerId}
                  className={selectedCustomerId === row.customerId ? 'is-selected' : ''}
                  onClick={() => setSelectedCustomerId(row.customerId)}
                >
                  <td><strong>{row.customerName}</strong></td>
                  <td className="customer-list-col-num is-negative">{formatCurrency(row.balance)}</td>
                  <td className="customer-list-col-num">
                    {row.overdueBalance > 0 ? (
                      <span className="accounting-partner-profit-warn">{formatCurrency(row.overdueBalance)}</span>
                    ) : formatCurrency(0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="module-card customer-reports-table-card">
          <div className="customer-reports-table-head">
            <h2>Dönem satış detayı</h2>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => exportCustomerPeriodSalesCsv(dashboard.periodSalesRows, periodLabel)}
              disabled={dashboard.periodSalesRows.length === 0}
            >
              CSV
            </button>
          </div>
          <table className="module-table module-table--wide customer-reports-table">
            <thead>
              <tr>
                <th>Müşteri</th>
                <th className="customer-list-col-num">Satış</th>
                <th className="customer-list-col-num">Veresiye</th>
                <th className="customer-list-col-num">Tutar</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.periodSalesRows.length === 0 ? (
                <tr><td colSpan={4} className="module-empty">Seçili dönemde satış yok</td></tr>
              ) : dashboard.periodSalesRows.map((row) => (
                <tr
                  key={row.customerId}
                  className={selectedCustomerId === row.customerId ? 'is-selected' : ''}
                  onClick={() => setSelectedCustomerId(row.customerId)}
                >
                  <td><strong>{row.customerName}</strong></td>
                  <td className="customer-list-col-num">{row.saleCount}</td>
                  <td className="customer-list-col-num">{row.creditSaleCount > 0 ? row.creditSaleCount : '—'}</td>
                  <td className="customer-list-col-num">{formatCurrency(row.periodTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      {selectedCustomerId && (
        <section className="module-card customer-reports-table-card customer-reports-statement-card">
          <div className="customer-reports-table-head">
            <h2>Müşteri ekstresi — {selectedCustomerName}</h2>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setSelectedCustomerId('')}
            >
              Kapat
            </button>
          </div>
          <table className="module-table module-table--wide customer-reports-table">
            <thead>
              <tr>
                <th>Tarih</th>
                <th>İşlem</th>
                <th className="customer-list-col-num">Borç</th>
                <th className="customer-list-col-num">Alacak</th>
                <th className="customer-list-col-num">Bakiye</th>
              </tr>
            </thead>
            <tbody>
              {customerStatement.length === 0 ? (
                <tr><td colSpan={5} className="module-empty">Hareket yok</td></tr>
              ) : customerStatement.map((row) => (
                <tr key={row.id}>
                  <td>{formatDateTime(row.date)}</td>
                  <td>{row.type}</td>
                  <td className="customer-list-col-num">{row.debit > 0 ? formatCurrency(row.debit) : '—'}</td>
                  <td className="customer-list-col-num">{row.credit > 0 ? formatCurrency(row.credit) : '—'}</td>
                  <td className="customer-list-col-num">{formatCurrency(row.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <CrmCohortClvPanel store={store} />
    </div>
  );
}
