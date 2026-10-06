import { useMemo, useState } from 'react';
import type { Store } from '../../store/useStore';
import type { ReportPeriod } from '../../utils/analytics';
import { buildPartnerCapitalRows, getTotalEquityCapital } from '../../utils/equityAnalytics';
import {
  buildPartnerProfitSharePreviewFromReports,
  formatPartnerProfitRangeLabel,
  reportPeriodDateRange,
} from '../../utils/partnerProfitShare';
import { trialBalancePeriodLabel } from '../../utils/trialBalance';
import { formatCurrency } from '../../utils/format';

interface PartnerReportsPanelProps {
  store: Store;
  period: ReportPeriod;
}

export function PartnerReportsPanel({ store, period }: PartnerReportsPanelProps) {
  const [zeroShareOnLoss, setZeroShareOnLoss] = useState(true);

  const partnerCapitalRows = useMemo(
    () => buildPartnerCapitalRows(store.equityPartners, store.capitalContributions),
    [store.equityPartners, store.capitalContributions],
  );

  const partnerProfitPreview = useMemo(
    () => buildPartnerProfitSharePreviewFromReports(
      store.equityPartners,
      period,
      store.sales,
      store.saleReturns,
      store.expenses,
      store.products,
      store.stockAdjustments,
      { zeroShareOnLoss },
    ),
    [
      store.equityPartners,
      store.sales,
      store.saleReturns,
      store.expenses,
      store.products,
      store.stockAdjustments,
      zeroShareOnLoss,
      period,
    ],
  );

  const partnerPeriodRangeLabel = useMemo(() => {
    if (period === 'all') return 'Tüm kayıtlar';
    const range = reportPeriodDateRange(period);
    return formatPartnerProfitRangeLabel(range.from, range.to);
  }, [period]);

  return (
    <div className="accounting-reports-section accounting-ortaklar-panel">
      <div className="accounting-ortaklar-block accounting-partner-profit">
        <h3>Kar payı önizleme</h3>
        <p className="module-hint">
          Dönem: <strong>{trialBalancePeriodLabel(period)}</strong>.
          Net satış (KDV hariç) − SMM − giderler = dağıtılabilir kâr.
        </p>
        <p className="accounting-partner-profit-breakdown">
          <span>Net satış: {formatCurrency(partnerProfitPreview.periodBasis.netRevenue)}</span>
          <span>SMM: {formatCurrency(partnerProfitPreview.periodBasis.cogs)}</span>
          <span>Gider: {formatCurrency(partnerProfitPreview.periodBasis.operatingExpenses)}</span>
          <span><strong>Net kâr: {formatCurrency(partnerProfitPreview.periodBasis.netProfit)}</strong></span>
        </p>
        <label className="accounting-checkbox accounting-partner-profit-option">
          <input
            type="checkbox"
            checked={zeroShareOnLoss}
            onChange={(e) => setZeroShareOnLoss(e.target.checked)}
          />
          Net kâr negatifse kar payını 0 göster
        </label>
        <div className="accounting-partner-profit-kpis">
          <div className="accounting-partner-profit-kpi">
            <span className="accounting-partner-profit-kpi-label">{partnerProfitPreview.periodLabel} net kâr</span>
            <strong>{formatCurrency(partnerProfitPreview.netProfitMonth)}</strong>
            <em>{partnerPeriodRangeLabel}</em>
          </div>
          <div className="accounting-partner-profit-kpi">
            <span className="accounting-partner-profit-kpi-label">Bu yıl net kâr (YTD)</span>
            <strong>{formatCurrency(partnerProfitPreview.netProfitYear)}</strong>
            <em>{formatPartnerProfitRangeLabel(partnerProfitPreview.yearRange.from, partnerProfitPreview.yearRange.to)}</em>
          </div>
          <div className="accounting-partner-profit-kpi">
            <span className="accounting-partner-profit-kpi-label">Toplam kar payı oranı</span>
            <strong className={partnerProfitPreview.sharePercentComplete ? '' : 'accounting-partner-profit-warn'}>
              {partnerProfitPreview.totalSharePercent}%
            </strong>
          </div>
        </div>
        <table className="module-table accounting-partner-profit-table">
          <thead>
            <tr>
              <th>Hesap</th>
              <th>Ortak</th>
              <th>Kar payı %</th>
              <th className="customer-list-col-num">{partnerProfitPreview.periodLabel} pay</th>
              <th className="customer-list-col-num">YTD pay</th>
            </tr>
          </thead>
          <tbody>
            {partnerProfitPreview.rows.map((row) => (
              <tr key={row.partnerId}>
                <td><code>{row.accountCode}</code></td>
                <td>{row.partnerName}{row.country ? ` · ${row.country}` : ''}</td>
                <td>{row.sharePercent > 0 ? `${row.sharePercent}%` : '—'}</td>
                <td className="customer-list-col-num">{formatCurrency(row.monthlyShare)}</td>
                <td className="customer-list-col-num">{formatCurrency(row.yearlyShare)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="accounting-ortaklar-block">
        <h3>Ortak sermayesi (500)</h3>
        <p className="module-hint">
          Toplam sermaye: {formatCurrency(getTotalEquityCapital(store.capitalContributions))}
        </p>
        <table className="module-table">
          <thead>
            <tr><th>Hesap</th><th>Ortak</th><th>Ülke</th><th>Pay %</th><th className="customer-list-col-num">Sermaye</th></tr>
          </thead>
          <tbody>
            {partnerCapitalRows.map((row) => (
              <tr key={row.partnerId}>
                <td><code>{row.accountCode}</code></td>
                <td>{row.partnerName}</td>
                <td>{row.country || '—'}</td>
                <td>{row.sharePercent > 0 ? `${row.sharePercent}%` : '—'}</td>
                <td className="customer-list-col-num">{formatCurrency(row.totalContributed)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
