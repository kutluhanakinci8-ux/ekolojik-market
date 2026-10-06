import { useMemo } from 'react';
import type { Store } from '../../store/useStore';
import { buildCustomerClvRows, buildCustomerCohortRows } from '../../utils/crm/cohortClv';
import { formatCurrency } from '../../utils/format';

interface CrmCohortClvPanelProps {
  store: Store;
}

export function CrmCohortClvPanel({ store }: CrmCohortClvPanelProps) {
  const cohorts = useMemo(
    () => buildCustomerCohortRows(store.customers, store.sales, store.saleReturns),
    [store.customers, store.sales, store.saleReturns],
  );

  const clvRows = useMemo(
    () => buildCustomerClvRows(store.customers, store.sales, store.saleReturns, 12),
    [store.customers, store.sales, store.saleReturns],
  );

  const maxRevenue = Math.max(...cohorts.map((c) => c.revenue), 1);

  return (
    <div className="crm-cohort-clv-panel">
      <section className="module-card customer-reports-chart-card">
        <h2>Kohort (ilk alışveriş ayı)</h2>
        <p className="cash-reports-chart-sub">Tekrar alışveriş oranı ve kohort cirosu</p>
        {cohorts.length === 0 ? (
          <p className="module-empty">Yeterli satış verisi yok</p>
        ) : (
          <div className="reports-brand-chart">
            {cohorts.map((row) => (
              <div key={row.cohortMonth} className="reports-brand-chart-row">
                <div className="reports-brand-chart-head">
                  <span>{row.cohortMonth}</span>
                  <strong>
                    {row.customerCount} müşteri · tekrar %{row.repeatRate} · {formatCurrency(row.revenue)}
                  </strong>
                </div>
                <div className="reports-brand-chart-track">
                  <span
                    className="reports-brand-chart-fill"
                    style={{ width: `${Math.max(4, (row.revenue / maxRevenue) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="module-card customer-reports-chart-card">
        <h2>Müşteri yaşam değeri (CLV)</h2>
        <p className="cash-reports-chart-sub">Net satış toplamına göre tahmini CLV</p>
        <div className="customer-list-table-wrap">
          <table className="customer-list-table">
            <thead>
              <tr>
                <th>Müşteri</th>
                <th className="customer-list-col-num">Sipariş</th>
                <th className="customer-list-col-num">Ort. sepet</th>
                <th className="customer-list-col-num">CLV</th>
              </tr>
            </thead>
            <tbody>
              {clvRows.map((row) => (
                <tr key={row.customerId}>
                  <td>{row.customerName}</td>
                  <td className="customer-list-col-num">{row.orderCount}</td>
                  <td className="customer-list-col-num">{formatCurrency(row.avgOrderValue)}</td>
                  <td className="customer-list-col-num"><strong>{formatCurrency(row.clvEstimate)}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
