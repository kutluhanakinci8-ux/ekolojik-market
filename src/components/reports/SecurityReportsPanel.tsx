import { useMemo } from 'react';
import type { Store } from '../../store/useStore';
import type { ReportPeriod } from '../../utils/analytics';
import { filterAuditByPeriod } from '../../utils/auditPeriodFilter';
import { buildActivityCategoryChart } from '../../utils/activityAudit';
import { buildFailedLoginUserChart, buildLoginUserChart } from '../../utils/securityLoginAnalytics';
import { trialBalancePeriodLabel } from '../../utils/trialBalance';

interface SecurityReportsPanelProps {
  store: Store;
  period: ReportPeriod;
}

export function SecurityReportsPanel({ store, period }: SecurityReportsPanelProps) {
  const periodLabel = trialBalancePeriodLabel(period);

  const loginRows = useMemo(
    () => filterAuditByPeriod(store.loginAuditLog, period),
    [store.loginAuditLog, period],
  );

  const activityRows = useMemo(
    () => filterAuditByPeriod(store.activityAuditLog, period)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [store.activityAuditLog, period],
  );

  const stats = useMemo(() => {
    const success = loginRows.filter((row) => row.success).length;
    const failed = loginRows.filter((row) => !row.success).length;
    const lockouts = store.getLoginLockouts().filter((row) => row.lockedUntil || row.requiresAdminUnlock);
    return { success, failed, lockouts: lockouts.length };
  }, [loginRows, store]);

  const activityChart = useMemo(
    () => buildActivityCategoryChart(activityRows),
    [activityRows],
  );

  const maxActivityCount = useMemo(
    () => Math.max(...activityChart.map((row) => row.count), 1),
    [activityChart],
  );

  const loginUserChart = useMemo(
    () => buildLoginUserChart(loginRows, store.users),
    [loginRows, store.users],
  );

  const maxLoginCount = useMemo(
    () => Math.max(...loginUserChart.map((row) => row.successCount), 1),
    [loginUserChart],
  );

  const failedLoginChart = useMemo(
    () => buildFailedLoginUserChart(loginRows, store.users),
    [loginRows, store.users],
  );

  const maxFailedLoginCount = useMemo(
    () => Math.max(...failedLoginChart.map((row) => row.failedCount), 1),
    [failedLoginChart],
  );

  return (
    <div className="accounting-reports-section">
      <p className="module-hint">
        Dönem: <strong>{periodLabel}</strong>. Özetler giriş ve aktivite günlüklerinden üretilir.
      </p>
      <div className="accounting-partner-profit-kpis">
        <div className="accounting-partner-profit-kpi">
          <span className="accounting-partner-profit-kpi-label">Başarılı giriş</span>
          <strong>{stats.success}</strong>
        </div>
        <div className="accounting-partner-profit-kpi">
          <span className="accounting-partner-profit-kpi-label">Başarısız giriş</span>
          <strong className={stats.failed > 0 ? 'accounting-partner-profit-warn' : ''}>{stats.failed}</strong>
        </div>
        <div className="accounting-partner-profit-kpi">
          <span className="accounting-partner-profit-kpi-label">Aktif kilit</span>
          <strong>{stats.lockouts}</strong>
        </div>
        <div className="accounting-partner-profit-kpi">
          <span className="accounting-partner-profit-kpi-label">Aktivite kaydı</span>
          <strong>{activityRows.length}</strong>
        </div>
      </div>

      <div className="module-grid-2 security-reports-charts">
        <section className="module-card security-activity-chart-card">
          <h2>Sistem aktivite özeti</h2>
          <p className="cash-reports-chart-sub">
            Dönemdeki tüm aktivite kayıtları, tür bazında
          </p>
          {activityChart.length === 0 ? (
            <p className="module-empty">Bu dönemde aktivite kaydı yok</p>
          ) : (
            <div className="reports-brand-chart security-activity-chart">
              {activityChart.map((row) => (
                <div key={row.label} className="reports-brand-chart-row">
                  <div className="reports-brand-chart-head">
                    <span>{row.label}</span>
                    <strong>{row.count} · {(row.share * 100).toFixed(1)}%</strong>
                  </div>
                  <div className="reports-brand-chart-track">
                    <span
                      className="reports-brand-chart-fill"
                      style={{ width: `${Math.max(4, (row.count / maxActivityCount) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="module-card security-login-chart-card">
          <h2>En çok giriş yapan kullanıcılar</h2>
          <p className="cash-reports-chart-sub">
            Başarılı oturum açılışları, kullanıcı bazında
          </p>
          {loginUserChart.length === 0 ? (
            <p className="module-empty">Bu dönemde giriş kaydı yok</p>
          ) : (
            <div className="reports-brand-chart security-login-user-chart">
              {loginUserChart.map((row) => (
                <div key={row.userKey} className="reports-brand-chart-row">
                  <div className="reports-brand-chart-head">
                    <span>
                      {row.displayName}
                      <small className="security-login-user-chart-username"> @{row.username}</small>
                    </span>
                    <strong>
                      {row.successCount} · {(row.share * 100).toFixed(0)}%
                    </strong>
                  </div>
                  <div className="reports-brand-chart-track">
                    <span
                      className="reports-brand-chart-fill security-login-user-chart-fill"
                      style={{ width: `${Math.max(4, (row.successCount / maxLoginCount) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="module-card security-login-chart-card security-failed-login-chart-card">
        <h2>Başarısız giriş yapan kullanıcılar</h2>
        <p className="cash-reports-chart-sub">
          Hatalı şifre veya PIN denemeleri, kullanıcı bazında
        </p>
        {failedLoginChart.length === 0 ? (
          <p className="module-empty">Bu dönemde başarısız giriş kaydı yok</p>
        ) : (
          <div className="reports-brand-chart security-login-user-chart">
            {failedLoginChart.map((row) => (
              <div key={row.userKey} className="reports-brand-chart-row">
                <div className="reports-brand-chart-head">
                  <span>
                    {row.displayName}
                    <small className="security-login-user-chart-username"> @{row.username}</small>
                  </span>
                  <strong className="accounting-partner-profit-warn">
                    {row.failedCount} · {(row.share * 100).toFixed(0)}%
                  </strong>
                </div>
                <div className="reports-brand-chart-track">
                  <span
                    className="reports-brand-chart-fill security-failed-login-chart-fill"
                    style={{ width: `${Math.max(4, (row.failedCount / maxFailedLoginCount) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
