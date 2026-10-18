import { useMemo } from 'react';
import type { Store } from '../../store/useStore';
import type { ReportPeriod } from '../../utils/analytics';
import { filterAuditByPeriod } from '../../utils/auditPeriodFilter';
import {
  buildSystemActivityOverview,
  SYSTEM_ACTIVITY_MODULE_LABELS,
  type SystemActivityModule,
} from '../../utils/systemActivityAnalytics';
import { trialBalancePeriodLabel } from '../../utils/trialBalance';
import { SystemActivityUserCharts } from './SystemActivityUserCharts';

interface SystemActivityReportsPanelProps {
  store: Store;
  period: ReportPeriod;
}

function maxCount(rows: { count: number }[]): number {
  return Math.max(...rows.map((r) => r.count), 1);
}

const MODULE_CHART_COLORS: Partial<Record<SystemActivityModule, string>> = {
  sales: '#3a9e34',
  stock: '#2f7dd1',
  accounting: '#8b5cf6',
  cash: '#d97706',
  customers: '#0d9488',
  purchases: '#64748b',
  security: '#dc2626',
  settings: '#6b7280',
  other: '#94a3b8',
};

export function SystemActivityReportsPanel({ store, period }: SystemActivityReportsPanelProps) {
  const periodLabel = trialBalancePeriodLabel(period);

  const overview = useMemo(() => {
    const rows = filterAuditByPeriod(store.activityAuditLog, period);
    return buildSystemActivityOverview(rows, store.users);
  }, [store.activityAuditLog, store.users, period]);

  const maxModule = maxCount(overview.moduleCounts);
  const maxPageBucket = maxCount(overview.pageViewCounts);
  const maxPageDetail = maxCount(overview.pageDetail);

  const topModuleLabel = overview.topModule
    ? SYSTEM_ACTIVITY_MODULE_LABELS[overview.topModule]
    : '—';

  return (
    <div className="accounting-reports-section system-activity-reports">
      <p className="module-hint">
        Dönem: <strong>{periodLabel}</strong>. Kayıtlar oturum aktivite günlüğünden üretilir; satış/stok/muhasebe
        işlemleri gerçekleşen aksiyonlardan, sekme kullanımı <em>Sekme</em> (page_view) kayıtlarından sayılır.
      </p>

      <div className="accounting-partner-profit-kpis">
        <div className="accounting-partner-profit-kpi">
          <span className="accounting-partner-profit-kpi-label">Kayıtlı işlem</span>
          <strong>{overview.periodOperationCount}</strong>
        </div>
        <div className="accounting-partner-profit-kpi">
          <span className="accounting-partner-profit-kpi-label">En yoğun alan</span>
          <strong>{topModuleLabel}</strong>
        </div>
        <div className="accounting-partner-profit-kpi">
          <span className="accounting-partner-profit-kpi-label">Panel görüntüleme</span>
          <strong>{overview.panelVsReports.panelViews}</strong>
        </div>
        <div className="accounting-partner-profit-kpi">
          <span className="accounting-partner-profit-kpi-label">Raporlar görüntüleme</span>
          <strong>{overview.panelVsReports.reportsViews}</strong>
        </div>
      </div>

      <section className="module-card system-activity-users">
        <h2>Kullanıcı bazında dağılım</h2>
        <p className="cash-reports-chart-sub">
          Her kullanıcı için işlem türleri ve sekme geçişleri ayrı ayrı
        </p>
        {overview.byUser.length === 0 ? (
          <p className="module-empty">Bu dönemde kullanıcı aktivitesi kaydı yok</p>
        ) : (
          <div className="system-activity-user-list">
            {overview.byUser.map((user) => (
              <SystemActivityUserCharts key={user.userId} user={user} />
            ))}
          </div>
        )}
      </section>

      <div className="module-grid-2 system-activity-charts">
        <section className="module-card">
          <h2>İşlem türü dağılımı</h2>
          <p className="cash-reports-chart-sub">Satış, stok, muhasebe ve diğer modüllerdeki kayıtlı aksiyonlar</p>
          {overview.moduleCounts.length === 0 ? (
            <p className="module-empty">Bu dönemde işlem kaydı yok</p>
          ) : (
            <div className="reports-brand-chart">
              {overview.moduleCounts.map((row) => (
                <div key={row.id} className="reports-brand-chart-row">
                  <div className="reports-brand-chart-head">
                    <span>{row.label}</span>
                    <strong>{row.count} · {(row.share * 100).toFixed(0)}%</strong>
                  </div>
                  <div className="reports-brand-chart-track">
                    <span
                      className="reports-brand-chart-fill"
                      style={{
                        width: `${Math.max(4, (row.count / maxModule) * 100)}%`,
                        background: MODULE_CHART_COLORS[row.id]
                          ? `linear-gradient(90deg, ${MODULE_CHART_COLORS[row.id]} 0%, ${MODULE_CHART_COLORS[row.id]}cc 100%)`
                          : undefined,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="module-card">
          <h2>Sekme kullanımı (özet)</h2>
          <p className="cash-reports-chart-sub">Panel vs Raporlar ve diğer ana alanlar</p>
          {overview.pageViewCounts.length === 0 ? (
            <p className="module-empty">Sekme geçiş kaydı yok</p>
          ) : (
            <div className="reports-brand-chart">
              {overview.pageViewCounts.map((row) => (
                <div key={row.id} className="reports-brand-chart-row">
                  <div className="reports-brand-chart-head">
                    <span>{row.label}</span>
                    <strong>{row.count} · {(row.share * 100).toFixed(0)}%</strong>
                  </div>
                  <div className="reports-brand-chart-track">
                    <span
                      className="reports-brand-chart-fill"
                      style={{ width: `${Math.max(4, (row.count / maxPageBucket) * 100)}%` }}
                    />
                  </div>
                  {row.id === 'panel' || row.id === 'reports' ? (
                    <small>
                      {row.id === 'panel' ? 'Ana gösterge paneli' : 'Üst menü Raporlar ekranı'}
                    </small>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {overview.pageDetail.length > 0 && (
        <section className="module-card">
          <h2>Tüm sekmeler</h2>
          <div className="cash-reports-hbar-list">
            {overview.pageDetail.map((row) => (
              <div key={row.page} className="cash-reports-hbar-row">
                <div className="cash-reports-hbar-head">
                  <span>{row.label}</span>
                  <strong>{row.count}</strong>
                </div>
                <div className="cash-reports-hbar-track">
                  <span
                    className="cash-reports-hbar-fill"
                    style={{ width: `${Math.max(4, (row.count / maxPageDetail) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <p className="module-hint">
        İpucu: Raporlar ekranı işlem girişi için değildir; satış ve stok işlemleri ilgili sekmelerden yapılır.
        Burada yalnızca sistemde kaydedilen kullanım özetini görürsünüz.
      </p>
    </div>
  );
}
