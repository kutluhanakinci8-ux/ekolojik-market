import { useMemo } from 'react';
import type { Store } from '../../store/useStore';
import type { ReportPeriod } from '../../utils/analytics';
import { USER_ROLE_LABELS } from '../../types/user';
import { buildUserReportDashboard } from '../../utils/userReportAnalytics';
import { formatDuration } from '../../utils/userUsageStats';
import { formatDateTime } from '../../utils/format';
import { trialBalancePeriodLabel } from '../../utils/trialBalance';

interface UserReportsPanelProps {
  store: Store;
  period: ReportPeriod;
}

function maxChartValue(rows: { value: number }[] | { successCount: number }[]): number {
  if (rows.length === 0) return 1;
  const first = rows[0];
  if ('value' in first) {
    return Math.max(...(rows as { value: number }[]).map((row) => row.value), 1);
  }
  return Math.max(...(rows as { successCount: number }[]).map((row) => row.successCount), 1);
}

export function UserReportsPanel({ store, period }: UserReportsPanelProps) {
  const periodLabel = trialBalancePeriodLabel(period);

  const dashboard = useMemo(
    () => buildUserReportDashboard(
      store.users,
      store.loginAuditLog,
      store.activityAuditLog,
      period,
      store.authSession?.sessionId,
    ),
    [
      store.users,
      store.loginAuditLog,
      store.activityAuditLog,
      store.authSession?.sessionId,
      period,
    ],
  );

  const maxDuration = maxChartValue(dashboard.durationChart);
  const maxActivity = maxChartValue(dashboard.activityChart);
  const maxLogin = maxChartValue(dashboard.loginChart);

  return (
    <div className="accounting-reports-section user-reports-premium">
      <p className="module-hint">
        Dönem: <strong>{periodLabel}</strong>. Oturum süreleri giriş/çıkış ve aktivite kayıtlarından hesaplanır.
        Çevrimiçi kullanıcılar tabloda vurgulanır.
      </p>

      <div className="accounting-partner-profit-kpis user-reports-kpis">
        <div className="accounting-partner-profit-kpi">
          <span className="accounting-partner-profit-kpi-label">Aktif hesap</span>
          <strong>{dashboard.periodOverview.activeAccountCount}</strong>
        </div>
        <div className="accounting-partner-profit-kpi">
          <span className="accounting-partner-profit-kpi-label">Çevrimiçi</span>
          <strong>{dashboard.periodOverview.onlineCount}</strong>
        </div>
        <div className="accounting-partner-profit-kpi">
          <span className="accounting-partner-profit-kpi-label">Dönem giriş</span>
          <strong>{dashboard.periodLoginTotal}</strong>
        </div>
        <div className="accounting-partner-profit-kpi">
          <span className="accounting-partner-profit-kpi-label">Dönem oturum süresi</span>
          <strong>{formatDuration(dashboard.periodDurationTotalMs)}</strong>
        </div>
        <div className="accounting-partner-profit-kpi">
          <span className="accounting-partner-profit-kpi-label">Dönem aktivite</span>
          <strong>{dashboard.periodActivityTotal}</strong>
        </div>
      </div>

      <div className="module-grid-2 user-reports-charts">
        <section className="module-card user-reports-chart-card">
          <h2>Oturum süresi (dönem)</h2>
          <p className="cash-reports-chart-sub">Kullanıcıların seçili dönemdeki tahmini oturum süresi</p>
          {dashboard.durationChart.length === 0 ? (
            <p className="module-empty">Bu dönemde oturum süresi yok</p>
          ) : (
            <div className="reports-brand-chart user-reports-chart-scroll">
              {dashboard.durationChart.map((row) => (
                <div key={row.userKey} className="reports-brand-chart-row">
                  <div className="reports-brand-chart-head">
                    <span>
                      {row.label}
                      <small className="user-reports-chart-sublabel">{row.sublabel}</small>
                    </span>
                    <strong>{row.displayValue} · {(row.share * 100).toFixed(0)}%</strong>
                  </div>
                  <div className="reports-brand-chart-track">
                    <span
                      className="reports-brand-chart-fill user-reports-fill--duration"
                      style={{ width: `${Math.max(4, (row.value / maxDuration) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="module-card user-reports-chart-card">
          <h2>Giriş sayısı (dönem)</h2>
          <p className="cash-reports-chart-sub">Başarılı oturum açılışları</p>
          {dashboard.loginChart.length === 0 ? (
            <p className="module-empty">Bu dönemde giriş yok</p>
          ) : (
            <div className="reports-brand-chart user-reports-chart-scroll">
              {dashboard.loginChart.map((row) => (
                <div key={row.userKey} className="reports-brand-chart-row">
                  <div className="reports-brand-chart-head">
                    <span>
                      {row.displayName}
                      <small className="user-reports-chart-sublabel">@{row.username}</small>
                    </span>
                    <strong>{row.successCount} · {(row.share * 100).toFixed(0)}%</strong>
                  </div>
                  <div className="reports-brand-chart-track">
                    <span
                      className="reports-brand-chart-fill user-reports-fill--login"
                      style={{ width: `${Math.max(4, (row.successCount / maxLogin) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="module-card user-reports-chart-card">
          <h2>Aktivite yoğunluğu</h2>
          <p className="cash-reports-chart-sub">Dönemdeki aktivite günlüğü kayıtları</p>
          {dashboard.activityChart.length === 0 ? (
            <p className="module-empty">Aktivite kaydı yok</p>
          ) : (
            <div className="reports-brand-chart user-reports-chart-scroll">
              {dashboard.activityChart.map((row) => (
                <div key={row.userKey} className="reports-brand-chart-row">
                  <div className="reports-brand-chart-head">
                    <span>
                      {row.label}
                      <small className="user-reports-chart-sublabel">{row.sublabel}</small>
                    </span>
                    <strong>{row.displayValue} · {(row.share * 100).toFixed(0)}%</strong>
                  </div>
                  <div className="reports-brand-chart-track">
                    <span
                      className="reports-brand-chart-fill user-reports-fill--activity"
                      style={{ width: `${Math.max(4, (row.value / maxActivity) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="module-card user-reports-chart-card">
          <h2>Rol & güvenlik</h2>
          <p className="cash-reports-chart-sub">Aktif hesaplar — rol dağılımı ve 2FA durumu</p>
          <div className="user-reports-mini-charts">
            {dashboard.roleChart.length === 0 ? (
              <p className="module-empty module-empty--compact">Aktif kullanıcı yok</p>
            ) : (
              <div className="reports-brand-chart reports-brand-chart--compact">
                <p className="user-reports-mini-title">Roller</p>
                {dashboard.roleChart.map((row) => (
                  <div key={row.role} className="reports-brand-chart-row">
                    <div className="reports-brand-chart-head">
                      <span>{row.label}</span>
                      <strong>{row.count} · {(row.share * 100).toFixed(0)}%</strong>
                    </div>
                    <div className="reports-brand-chart-track">
                      <span
                        className="reports-brand-chart-fill user-reports-fill--role"
                        style={{ width: `${Math.max(8, row.share * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
            {dashboard.totpChart.length > 0 && (
              <div className="reports-brand-chart reports-brand-chart--compact">
                <p className="user-reports-mini-title">İki adımlı doğrulama</p>
                {dashboard.totpChart.map((row) => (
                  <div key={row.id} className="reports-brand-chart-row">
                    <div className="reports-brand-chart-head">
                      <span>{row.label}</span>
                      <strong>{row.count} · {(row.share * 100).toFixed(0)}%</strong>
                    </div>
                    <div className="reports-brand-chart-track">
                      <span
                        className={`reports-brand-chart-fill ${row.id === 'enabled' ? 'user-reports-fill--totp-on' : 'user-reports-fill--totp-off'}`}
                        style={{ width: `${Math.max(8, row.share * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      <section className="module-card user-reports-table-card">
        <div className="user-reports-table-head">
          <h2>Kullanıcı detay tablosu</h2>
          <span className="user-reports-table-badge">{dashboard.users.length} hesap</span>
        </div>
        <table className="module-table module-table--wide user-reports-table">
          <thead>
            <tr>
              <th>Kullanıcı</th>
              <th>Rol</th>
              <th>Durum</th>
              <th className="customer-list-col-num">Dönem giriş</th>
              <th className="customer-list-col-num">Dönem süre</th>
              <th className="customer-list-col-num">Dönem aktivite</th>
              <th className="customer-list-col-num">Toplam süre</th>
              <th>2FA</th>
              <th>Son giriş</th>
            </tr>
          </thead>
          <tbody>
            {dashboard.users.map((row) => (
              <tr key={row.userId} className={row.isOnline ? 'is-selected' : undefined}>
                <td>
                  <strong>{row.displayName}</strong>
                  <br />
                  <small className="mono">@{row.username}</small>
                </td>
                <td>{USER_ROLE_LABELS[row.role]}</td>
                <td>
                  {row.isOnline ? '🟢 Çevrimiçi' : row.isActive ? 'Hesap aktif' : '🔒 Pasif'}
                </td>
                <td className="customer-list-col-num">{row.periodLoginCount}</td>
                <td className="customer-list-col-num">{formatDuration(row.periodDurationMs)}</td>
                <td className="customer-list-col-num">{row.periodActivityCount}</td>
                <td className="customer-list-col-num">{formatDuration(row.totalDurationMs)}</td>
                <td>{row.totpEnabled ? '✓ Açık' : '—'}</td>
                <td>{row.lastLoginAt ? formatDateTime(row.lastLoginAt) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
