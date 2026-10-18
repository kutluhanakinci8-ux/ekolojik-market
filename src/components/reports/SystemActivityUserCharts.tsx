import type { SystemActivityModule, UserActivityBreakdown } from '../../utils/systemActivityAnalytics';

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

function maxCount(rows: { count: number }[]): number {
  return Math.max(...rows.map((r) => r.count), 1);
}

function MiniModuleChart({
  rows,
  max,
}: {
  rows: UserActivityBreakdown['moduleCounts'];
  max: number;
}) {
  if (rows.length === 0) {
    return <p className="module-empty module-empty--compact">İşlem kaydı yok</p>;
  }
  return (
    <div className="reports-brand-chart reports-brand-chart--compact">
      {rows.map((row) => (
        <div key={row.id} className="reports-brand-chart-row">
          <div className="reports-brand-chart-head">
            <span>{row.label}</span>
            <strong>{row.count}</strong>
          </div>
          <div className="reports-brand-chart-track">
            <span
              className="reports-brand-chart-fill"
              style={{
                width: `${Math.max(4, (row.count / max) * 100)}%`,
                background: MODULE_CHART_COLORS[row.id]
                  ? `linear-gradient(90deg, ${MODULE_CHART_COLORS[row.id]} 0%, ${MODULE_CHART_COLORS[row.id]}cc 100%)`
                  : undefined,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function MiniPageChart({
  rows,
  max,
}: {
  rows: UserActivityBreakdown['pageViewCounts'];
  max: number;
}) {
  if (rows.length === 0) {
    return <p className="module-empty module-empty--compact">Sekme kaydı yok</p>;
  }
  return (
    <div className="reports-brand-chart reports-brand-chart--compact">
      {rows.map((row) => (
        <div key={row.id} className="reports-brand-chart-row">
          <div className="reports-brand-chart-head">
            <span>{row.label}</span>
            <strong>{row.count}</strong>
          </div>
          <div className="reports-brand-chart-track">
            <span
              className="reports-brand-chart-fill"
              style={{ width: `${Math.max(4, (row.count / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SystemActivityUserCharts({ user }: { user: UserActivityBreakdown }) {
  const maxModule = maxCount(user.moduleCounts);
  const maxPage = maxCount(user.pageViewCounts);

  return (
    <article className="system-activity-user-card">
      <header className="system-activity-user-card-head">
        <div>
          <strong>{user.displayName}</strong>
          <span className="mono system-activity-user-card-username">@{user.username}</span>
        </div>
        <div className="system-activity-user-card-stats">
          <span><em>İşlem</em> {user.operationCount}</span>
          <span><em>Sekme</em> {user.pageViewCount}</span>
        </div>
      </header>
      <div className="system-activity-user-card-charts">
        <div>
          <h3>İşlem türleri</h3>
          <MiniModuleChart rows={user.moduleCounts} max={maxModule} />
        </div>
        <div>
          <h3>Sekme kullanımı</h3>
          <MiniPageChart rows={user.pageViewCounts} max={maxPage} />
        </div>
      </div>
    </article>
  );
}
