import { useMemo } from 'react';
import type { Store } from '../../store/useStore';
import { buildCrmDashboardSummary } from '../../utils/crm/crmDashboardAnalytics';
import { formatCurrency } from '../../utils/format';

interface DashboardCrmSummaryPanelProps {
  store: Store;
}

export function DashboardCrmSummaryPanel({ store }: DashboardCrmSummaryPanelProps) {
  const summary = useMemo(
    () => buildCrmDashboardSummary(
      store.customers,
      store.sales,
      store.saleReturns,
      store.customerLedger,
      store.crmData,
      store.crmSettings,
    ),
    [
      store.customers,
      store.sales,
      store.saleReturns,
      store.customerLedger,
      store.crmData,
      store.crmSettings,
    ],
  );

  return (
    <section className="dashboard-card dashboard-crm-summary-card">
      <div className="dashboard-card-header">
        <h2>CRM Özeti</h2>
        <span className="dashboard-card-subtitle">Lead, tahsilat ve sadakat</span>
      </div>

      <div className="dashboard-crm-kpis">
        <div className="dashboard-crm-kpi">
          <span>Açık lead</span>
          <strong>{summary.openLeads}</strong>
        </div>
        <div className="dashboard-crm-kpi">
          <span>Açık görev</span>
          <strong>{summary.openTasks}</strong>
          {summary.tasksDueToday > 0 && <em>Bugün: {summary.tasksDueToday}</em>}
        </div>
        <div className="dashboard-crm-kpi dashboard-crm-kpi--warn">
          <span>Alacak</span>
          <strong>{formatCurrency(summary.totalReceivable)}</strong>
          <em>{summary.customersWithReceivable} müşteri</em>
        </div>
        <div className="dashboard-crm-kpi dashboard-crm-kpi--danger">
          <span>Vadesi geçen</span>
          <strong>{formatCurrency(summary.overdueReceivable)}</strong>
        </div>
        <div className="dashboard-crm-kpi">
          <span>Uyuyan müşteri</span>
          <strong>{summary.churnRiskCount}</strong>
        </div>
        <div className="dashboard-crm-kpi">
          <span>Doğum günü (7 gün)</span>
          <strong>{summary.birthdaysThisWeek}</strong>
        </div>
      </div>

      <p className="dashboard-crm-foot">
        SMS: {summary.smsTemplateCount} · Bekleyen gönderim: {store.crmData.outreachQueue.filter((q) => q.status === 'pending').length}
        · Müşteriler → CRM Merkezi → Otomasyon
      </p>
    </section>
  );
}
