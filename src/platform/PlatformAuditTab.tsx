import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  downloadPlatformAuditCsv,
  fetchPlatformAuditOverview,
  runPlatformSecurityNotifyCheck,
  type PlatformAuditPayload,
} from '../services/platformApi';
import { KpiIcon, PlatformFilterSelect, RingProgress } from './platformUserUi';

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

function AuditSkeleton() {
  return (
    <div className="platform-audit platform-audit--loading" aria-busy="true">
      <div className="platform-users-skeleton-hero" />
      <div className="platform-users-skeleton-kpis" />
      <div className="platform-users-skeleton-block" />
    </div>
  );
}

export function PlatformAuditTab() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PlatformAuditPayload | null>(null);
  const [windowDays, setWindowDays] = useState(30);
  const [exporting, setExporting] = useState(false);
  const [notifyMsg, setNotifyMsg] = useState<string | null>(null);
  const [notifyBusy, setNotifyBusy] = useState(false);
  const [feedFilter, setFeedFilter] = useState<'all' | 'login' | 'activity'>('all');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await fetchPlatformAuditOverview(windowDays);
    if (!result.ok || !result.data) {
      setError(result.error ?? 'Veri yüklenemedi');
      setLoading(false);
      return;
    }
    setData(result.data);
    setLoading(false);
  }, [windowDays]);

  useEffect(() => {
    void load();
  }, [load]);

  const timeline = useMemo(() => {
    if (!data) return [];
    if (feedFilter === 'login') return data.timeline.filter((e) => e.kind === 'login');
    if (feedFilter === 'activity') return data.timeline.filter((e) => e.kind === 'activity');
    return data.timeline;
  }, [data, feedFilter]);

  const topActionMax = useMemo(() => {
    if (!data?.activity.topActions.length) return 1;
    return Math.max(1, ...data.activity.topActions.map((a) => a.count));
  }, [data]);

  const onExport = async () => {
    setExporting(true);
    const result = await downloadPlatformAuditCsv(Math.max(windowDays, 90));
    setExporting(false);
    if (!result.ok) setNotifyMsg(result.error ?? 'CSV indirilemedi');
  };

  const onNotifyCheck = async () => {
    setNotifyBusy(true);
    setNotifyMsg(null);
    const result = await runPlatformSecurityNotifyCheck(false);
    setNotifyBusy(false);
    if (!result.ok) {
      setNotifyMsg(result.error ?? 'Kontrol başarısız');
      return;
    }
    setNotifyMsg(result.message ?? (result.sent ? 'Bildirim gönderildi' : 'Eşik kontrolü tamam'));
    void load();
  };

  if (loading && !data) return <AuditSkeleton />;
  if (error && !data) {
    return (
      <div className="platform-users-error">
        <p className="landing-flash landing-flash--error" role="alert">{error}</p>
        <button type="button" className="btn btn-primary" onClick={() => void load()}>Tekrar dene</button>
      </div>
    );
  }
  if (!data) return null;

  const scoreVariant = data.securityScore >= 70 ? 'brand' : 'warn';

  return (
    <div className="platform-audit platform-audit--premium platform-users--premium">
      <header className="platform-users-hero platform-users-hero--premium platform-audit-hero">
        <div className="platform-users-hero-copy">
          <span className="platform-users-hero-badge">Audit Center</span>
          <h2>Denetim & olaylar</h2>
          <p>
            Giriş denemeleri, güvenlik aktivitesi, eşik uyarıları ve bildirim geçmişi — tek zaman çizelgesi.
          </p>
          <time className="platform-users-hero-time" dateTime={data.generatedAt}>
            Son güncelleme: {formatDateTime(data.generatedAt)}
          </time>
        </div>
        <div className="platform-users-hero-actions">
          <div className="platform-audit-hero-metrics">
            <RingProgress pct={data.securityScore} size={72} label="Skor" variant={scoreVariant} />
            <span className="platform-users-hero-stat-label">Güvenlik skoru (canlı)</span>
          </div>
          <div className="platform-comms-hero-btns">
            <button
              type="button"
              className="btn btn-text platform-security-export-btn"
              disabled={exporting}
              onClick={() => void onExport()}
            >
              {exporting ? 'İndiriliyor…' : `Denetim CSV (${Math.max(windowDays, 90)}g)`}
            </button>
            <button type="button" className="btn btn-primary platform-users-refresh" onClick={() => void load()}>
              Yenile
            </button>
          </div>
        </div>
      </header>

      <section className="platform-comms-toolbar" aria-label="Pencere">
        <div className="platform-users-filter-bar platform-comms-filter-bar">
          <div className="platform-users-select-grid platform-comms-select-grid">
            <PlatformFilterSelect
              label="Denetim penceresi"
              icon="status"
              value={String(windowDays)}
              onChange={(v) => setWindowDays(Number(v))}
            >
              <option value="7">7 gün</option>
              <option value="14">14 gün</option>
              <option value="30">30 gün</option>
              <option value="90">90 gün</option>
            </PlatformFilterSelect>
            <PlatformFilterSelect
              label="Akış filtresi"
              icon="role"
              value={feedFilter}
              onChange={(v) => setFeedFilter(v as 'all' | 'login' | 'activity')}
            >
              <option value="all">Tümü</option>
              <option value="login">Girişler</option>
              <option value="activity">Aktivite</option>
            </PlatformFilterSelect>
          </div>
        </div>
        {notifyMsg && <p className="platform-comms-action-msg" role="status">{notifyMsg}</p>}
      </section>

      <div className="platform-users-kpi-grid platform-users-kpi-grid--premium" aria-label="Denetim KPI">
        <article className="platform-users-kpi platform-users-kpi--primary">
          <KpiIcon name="login" />
          <div className="platform-users-kpi-body">
            <span className="platform-users-kpi-label">Güvenlik aktivitesi</span>
            <strong className="platform-users-kpi-value">{data.totals.securityActivityEvents}</strong>
            <span className="platform-users-kpi-sub">{data.windowDays}g · toplam {data.totals.activityEvents}</span>
          </div>
        </article>
        <article className="platform-users-kpi platform-users-kpi--danger">
          <KpiIcon name="churn" />
          <div className="platform-users-kpi-body">
            <span className="platform-users-kpi-label">Başarısız giriş (24s)</span>
            <strong className="platform-users-kpi-value">{data.totals.failedLogins24h}</strong>
            <span className="platform-users-kpi-sub">Pencere içi: {data.totals.loginFailed}</span>
          </div>
        </article>
        <article className="platform-users-kpi">
          <KpiIcon name="active" />
          <div className="platform-users-kpi-body">
            <span className="platform-users-kpi-label">Başarılı giriş</span>
            <strong className="platform-users-kpi-value">{data.totals.loginSuccess}</strong>
          </div>
        </article>
        <article className="platform-users-kpi platform-users-kpi--warn">
          <KpiIcon name="roles" />
          <div className="platform-users-kpi-body">
            <span className="platform-users-kpi-label">Aktif eşik uyarısı</span>
            <strong className="platform-users-kpi-value">{data.notify.activeThresholds.length}</strong>
            <span className="platform-users-kpi-sub">
              Bildirim: {data.notify.policyEnabled ? 'açık' : 'kapalı'}
            </span>
          </div>
        </article>
      </div>

      <div className="platform-comms-split">
        <section className="platform-users-panel" aria-label="Bildirimler">
          <div className="platform-users-panel-head platform-users-panel-head--stack">
            <h3>Güvenlik bildirimleri</h3>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={notifyBusy || !data.notify.policyEnabled}
              onClick={() => void onNotifyCheck()}
            >
              {notifyBusy ? 'Kontrol…' : 'Eşik kontrolü'}
            </button>
          </div>
          {data.notify.activeThresholds.length > 0 ? (
            <ul className="platform-audit-alert-list">
              {data.notify.activeThresholds.map((a) => (
                <li key={a.id} className={`platform-audit-alert platform-audit-alert--${a.severity}`}>
                  <strong>{a.title}</strong>
                  <span className="platform-muted">{a.detail}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="platform-muted platform-overview-empty">Şu an tetiklenen eşik uyarısı yok.</p>
          )}
          <h4 className="platform-audit-subhead">Son bildirimler</h4>
          {data.notify.history.length === 0 ? (
            <p className="platform-muted">Henüz kayıtlı bildirim yok.</p>
          ) : (
            <ul className="platform-audit-history">
              {data.notify.history.map((h) => (
                <li key={h.alertId}>
                  <span>{h.label}</span>
                  <time className="platform-muted">{formatDateTime(h.lastFiredAt)}</time>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="platform-users-panel" aria-label="Aktivite dağılımı">
          <div className="platform-users-panel-head">
            <h3>İşlem türleri</h3>
            <span className="platform-muted">{data.windowDays}g</span>
          </div>
          <ul className="platform-security-action-bars">
            {data.activity.topActions.map((row) => (
              <li key={row.action}>
                <span className="platform-security-action-label">{row.label}</span>
                <div className="platform-users-mini-bar platform-security-action-bar">
                  <span style={{ width: `${Math.round((row.count / topActionMax) * 100)}%` }} />
                </div>
                <strong className="platform-security-action-count">{row.count}</strong>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="platform-users-panel" aria-label="Olay akışı">
        <div className="platform-users-panel-head">
          <h3>Olay zaman çizelgesi</h3>
          <span className="platform-muted">{timeline.length} kayıt</span>
        </div>
        <ul className="platform-audit-timeline">
          {timeline.map((event, idx) => (
            <li
              key={`${event.kind}-${event.createdAt}-${idx}`}
              className={`platform-audit-event platform-audit-event--${event.kind} ${event.success === false ? 'is-fail' : ''}`}
            >
              <span className="platform-audit-event-kind">
                {event.kind === 'login' ? 'Giriş' : 'Aktivite'}
              </span>
              <div className="platform-audit-event-main">
                <strong>{event.title}</strong>
                <span>{event.detail}</span>
                <span className="platform-audit-event-meta">
                  <span className="platform-comms-tenant-pill">{event.tenantId}</span>
                  {event.displayName || event.username}
                  {event.clientIp ? ` · ${event.clientIp}` : ''}
                  {' · '}
                  {formatDateTime(event.createdAt)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {data.activity.byTenant.some((t) => t.securityEvents30d > 0) && (
        <section className="platform-users-panel" aria-label="Kiracı aktivite">
          <div className="platform-users-panel-head">
            <h3>Kiracı bazlı güvenlik aktivitesi</h3>
          </div>
          <div className="platform-users-table-scroll">
            <table className="platform-table platform-table--premium">
              <thead>
                <tr>
                  <th>Mağaza</th>
                  <th>Güvenlik işlemi</th>
                  <th>Toplam aktivite</th>
                </tr>
              </thead>
              <tbody>
                {data.activity.byTenant
                  .filter((t) => t.securityEvents30d > 0)
                  .map((t) => (
                    <tr key={t.tenantId}>
                      <td><strong>{t.businessName}</strong></td>
                      <td>{t.securityEvents30d}</td>
                      <td className="platform-muted">{t.events30d}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
