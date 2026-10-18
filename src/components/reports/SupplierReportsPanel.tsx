import { useMemo, useState } from 'react';
import type { Store } from '../../store/useStore';
import type { ReportPeriod } from '../../utils/analytics';
import { buildSupplierStatement } from '../../utils/accountingAnalytics';
import { buildSupplierReportDashboard } from '../../utils/supplierReportAnalytics';
import { formatCurrency, formatDateTime } from '../../utils/format';
import { exportSupplierLedgerCsv } from '../../utils/reportExport';
import { trialBalancePeriodLabel } from '../../utils/trialBalance';

interface SupplierReportsPanelProps {
  store: Store;
  period: ReportPeriod;
}

function maxChartValue(rows: { value: number }[]): number {
  return Math.max(...rows.map((row) => row.value), 1);
}

export function SupplierReportsPanel({ store, period }: SupplierReportsPanelProps) {
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const periodLabel = trialBalancePeriodLabel(period);

  const dashboard = useMemo(
    () => buildSupplierReportDashboard(
      store.suppliers,
      store.supplierLedger,
      store.purchaseInvoices,
      period,
    ),
    [store.suppliers, store.supplierLedger, store.purchaseInvoices, period],
  );

  const statement = useMemo(() => {
    if (!selectedSupplierId) return [];
    return buildSupplierStatement(selectedSupplierId, store.supplierLedger);
  }, [selectedSupplierId, store.supplierLedger]);

  const selectedName = useMemo(
    () => store.suppliers.find((s) => s.id === selectedSupplierId)?.name ?? '',
    [selectedSupplierId, store.suppliers],
  );

  const maxDebt = maxChartValue(dashboard.debtChart);
  const maxOverdue = maxChartValue(dashboard.overdueChart);
  const maxPurchase = maxChartValue(dashboard.periodPurchaseChart);
  const maxPayment = maxChartValue(dashboard.periodPaymentChart);

  return (
    <div className="accounting-reports-section supplier-reports-premium">
      <p className="module-hint">
        Dönem: <strong>{periodLabel}</strong>. Cari borçlar güncel bakiyeyi gösterir; alış ve ödeme grafikleri seçili döneme göre filtrelenir.
        Satıra tıklayarak ekstre açın.
      </p>

      <div className="accounting-partner-profit-kpis supplier-reports-kpis">
        <div className="accounting-partner-profit-kpi">
          <span className="accounting-partner-profit-kpi-label">Toplam borç</span>
          <strong>{formatCurrency(dashboard.totalDebt)}</strong>
          <em>{dashboard.supplierWithDebtCount} tedarikçi</em>
        </div>
        <div className="accounting-partner-profit-kpi">
          <span className="accounting-partner-profit-kpi-label">Vadesi geçen</span>
          <strong className={dashboard.totalOverdue > 0 ? 'accounting-partner-profit-warn' : ''}>
            {formatCurrency(dashboard.totalOverdue)}
          </strong>
        </div>
        <div className="accounting-partner-profit-kpi">
          <span className="accounting-partner-profit-kpi-label">Dönem alış</span>
          <strong>{formatCurrency(dashboard.periodPurchaseTotal)}</strong>
          <em>{dashboard.periodInvoiceCount} fatura</em>
        </div>
        <div className="accounting-partner-profit-kpi">
          <span className="accounting-partner-profit-kpi-label">Dönem ödeme</span>
          <strong>{formatCurrency(dashboard.periodPaymentTotal)}</strong>
        </div>
      </div>

      <div className="module-grid-2 supplier-reports-charts">
        <section className="module-card supplier-reports-chart-card">
          <h2>En yüksek borçlar</h2>
          <p className="cash-reports-chart-sub">Güncel tedarikçi cari bakiyeleri</p>
          {dashboard.debtChart.length === 0 ? (
            <p className="module-empty">Borç kaydı yok</p>
          ) : (
            <div className="reports-brand-chart supplier-reports-chart-scroll">
              {dashboard.debtChart.map((row) => (
                <div key={row.supplierId} className="reports-brand-chart-row">
                  <div className="reports-brand-chart-head">
                    <span>{row.label}</span>
                    <strong>{row.displayValue} · {(row.share * 100).toFixed(0)}%</strong>
                  </div>
                  <div className="reports-brand-chart-track">
                    <span
                      className="reports-brand-chart-fill supplier-reports-fill--debt"
                      style={{ width: `${Math.max(4, (row.value / maxDebt) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="module-card supplier-reports-chart-card">
          <h2>Vadesi geçen borçlar</h2>
          <p className="cash-reports-chart-sub">Vade tarihi geçmiş açık kalemler</p>
          {dashboard.overdueChart.length === 0 ? (
            <p className="module-empty">Vadesi geçen borç yok</p>
          ) : (
            <div className="reports-brand-chart supplier-reports-chart-scroll">
              {dashboard.overdueChart.map((row) => (
                <div key={row.supplierId} className="reports-brand-chart-row">
                  <div className="reports-brand-chart-head">
                    <span>{row.label}</span>
                    <strong className="accounting-partner-profit-warn">
                      {row.displayValue} · {(row.share * 100).toFixed(0)}%
                    </strong>
                  </div>
                  <div className="reports-brand-chart-track">
                    <span
                      className="reports-brand-chart-fill supplier-reports-fill--overdue"
                      style={{ width: `${Math.max(4, (row.value / maxOverdue) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="module-card supplier-reports-chart-card">
          <h2>Dönem alış hacmi</h2>
          <p className="cash-reports-chart-sub">Seçili dönemde kayıtlı alış faturaları (cari)</p>
          {dashboard.periodPurchaseChart.length === 0 ? (
            <p className="module-empty">Bu dönemde alış kaydı yok</p>
          ) : (
            <div className="reports-brand-chart supplier-reports-chart-scroll">
              {dashboard.periodPurchaseChart.map((row) => (
                <div key={row.supplierId} className="reports-brand-chart-row">
                  <div className="reports-brand-chart-head">
                    <span>{row.label}</span>
                    <strong>{row.displayValue} · {(row.share * 100).toFixed(0)}%</strong>
                  </div>
                  <div className="reports-brand-chart-track">
                    <span
                      className="reports-brand-chart-fill supplier-reports-fill--purchase"
                      style={{ width: `${Math.max(4, (row.value / maxPurchase) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="module-card supplier-reports-chart-card">
          <h2>Dönem ödemeler</h2>
          <p className="cash-reports-chart-sub">Tedarikçilere yapılan ödemeler</p>
          {dashboard.periodPaymentChart.length === 0 ? (
            <p className="module-empty">Bu dönemde ödeme kaydı yok</p>
          ) : (
            <div className="reports-brand-chart supplier-reports-chart-scroll">
              {dashboard.periodPaymentChart.map((row) => (
                <div key={row.supplierId} className="reports-brand-chart-row">
                  <div className="reports-brand-chart-head">
                    <span>{row.label}</span>
                    <strong>{row.displayValue} · {(row.share * 100).toFixed(0)}%</strong>
                  </div>
                  <div className="reports-brand-chart-track">
                    <span
                      className="reports-brand-chart-fill supplier-reports-fill--payment"
                      style={{ width: `${Math.max(4, (row.value / maxPayment) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="module-card supplier-reports-table-card">
        <div className="supplier-reports-table-head">
          <h2>Cari borç tablosu</h2>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => exportSupplierLedgerCsv(dashboard.balanceRows)}
            disabled={dashboard.balanceRows.length === 0}
          >
            CSV İndir
          </button>
        </div>
        <table className="module-table module-table--wide supplier-reports-table">
          <thead>
            <tr>
              <th>Tedarikçi</th>
              <th className="customer-list-col-num">Borç</th>
              <th className="customer-list-col-num">Vadesi geçen</th>
            </tr>
          </thead>
          <tbody>
            {dashboard.balanceRows.length === 0 ? (
              <tr><td colSpan={3} className="module-empty">Borç kaydı yok</td></tr>
            ) : dashboard.balanceRows.map((row) => (
              <tr
                key={row.supplierId}
                className={selectedSupplierId === row.supplierId ? 'is-selected' : ''}
                onClick={() => setSelectedSupplierId(row.supplierId)}
              >
                <td><strong>{row.supplierName}</strong></td>
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

      {selectedSupplierId && (
        <section className="module-card supplier-reports-table-card supplier-reports-statement-card">
          <div className="supplier-reports-table-head">
            <h2>Tedarikçi ekstresi — {selectedName}</h2>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setSelectedSupplierId('')}
            >
              Kapat
            </button>
          </div>
          <table className="module-table module-table--wide supplier-reports-table">
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
              {statement.length === 0 ? (
                <tr><td colSpan={5} className="module-empty">Hareket yok</td></tr>
              ) : statement.map((row) => (
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
    </div>
  );
}
