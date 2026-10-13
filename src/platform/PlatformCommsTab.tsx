import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  downloadPlatformCommsCsv,
  fetchPlatformCommsOverview,
  platformCommsProcessOutbox,
  platformCommsRequeueFailed,
  type PlatformCommsPayload,
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

function formatDayLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  if (!y || !m || !d) return dateKey;
  return new Date(y, m - 1, d).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
}

function formatDurationMs(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms)) return '—';
  if (ms < 60_000) return `${Math.round(ms / 1000)} sn`;
  if (ms < 3600_000) return `${Math.round(ms / 60_000)} dk`;
  return `${(ms / 3600_000).toFixed(1)} sa`;
}

const FOLDER_LABELS: Record<string, string> = {
  pending: 'Bekleyen',
  sent: 'Gönderildi',
  failed: 'Başarısız',
};

function CommsSkeleton() {
  return (
    <div className="platform-comms platform-comms--loading" aria-busy="true">
      <div className="platform-users-skeleton-hero" />
      <div className="platform-users-skeleton-kpis" />
      <div className="platform-users-skeleton-block" />
    </div>
  );
}

export function PlatformCommsTab() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PlatformCommsPayload | null>(null);
  const [windowDays, setWindowDays] = useState(14);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [exportingCsv, setExportingCsv] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await fetchPlatformCommsOverview(windowDays);
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

  const trendMax = useMemo(() => {
    if (!data?.outboxByDay.length) return 1;
    return Math.max(1, ...data.outboxByDay.map((d) => d.sent + d.failed));
  }, [data]);

  const runProcess = async () => {
    setBusy('process');
    setActionMsg(null);
    const result = await platformCommsProcessOutbox(30);
    setBusy(null);
    if (!result.ok) {
      setActionMsg(result.error ?? 'İşlem başarısız');
      return;
    }
    const p = result.processed;
    setActionMsg(
      p
        ? `Outbox: ${p.processed} işlendi · ${p.sent} gönderildi · ${p.failed} başarısız · ${p.deferred} ertelendi`
        : 'Tamamlandı',
    );
    void load();
  };

  const runRequeue = async () => {
    if (!window.confirm('Tüm başarısız outbox kayıtları yeniden kuyruğa alınsın mı?')) return;
    setBusy('requeue');
    setActionMsg(null);
    const result = await platformCommsRequeueFailed({ all: true });
    setBusy(null);
    if (!result.ok) {
      setActionMsg(result.error ?? 'Yeniden kuyruk başarısız');
      return;
    }
    setActionMsg(`${result.requeued ?? 0} kayıt yeniden kuyruğa alındı.`);
    void load();
  };

  const onExportCsv = async () => {
    setExportingCsv(true);
    const result = await downloadPlatformCommsCsv(windowDays);
    setExportingCsv(false);
    if (!result.ok) setActionMsg(result.error ?? 'CSV indirilemedi');
  };

  if (loading) return <CommsSkeleton />;
  if (error) {
    return (
      <div className="platform-users-error">
        <p className="landing-flash landing-flash--error" role="alert">{error}</p>
        <button type="button" className="btn btn-primary" onClick={() => void load()}>Tekrar dene</button>
      </div>
    );
  }
  if (!data) return null;

  const successRate = data.outboxWindow.successRatePercent;
  const deliveryPct =
    successRate != null
      ? Math.round(successRate)
      : data.outboxWindow.attempted > 0
        ? Math.round((data.outboxWindow.sent / data.outboxWindow.attempted) * 100)
        : 100;
  const deliveryVariant = deliveryPct >= 95 ? 'brand' : deliveryPct >= 80 ? 'warn' : 'warn';

  return (
    <div className="platform-comms platform-comms--premium platform-users--premium">
      <header className="platform-users-hero platform-users-hero--premium platform-comms-hero">
        <div className="platform-users-hero-copy">
          <span className="platform-users-hero-badge">Communications Hub</span>
          <h2>Posta & mesaj</h2>
          <p>
            E-posta outbox, müşteri mesajlaşma SLA ve kampanya etkileşimi — tüm kiracılar için tek operasyon merkezi.
          </p>
          <time className="platform-users-hero-time" dateTime={data.generatedAt}>
            Son güncelleme: {formatDateTime(data.generatedAt)}
          </time>
        </div>
        <div className="platform-users-hero-actions">
          <div className="platform-comms-hero-metrics">
            <RingProgress
              pct={deliveryPct}
              size={72}
              label="Teslimat"
              variant={deliveryVariant}
            />
            <span className="platform-users-hero-stat-label">
              Gönderim başarısı · {data.windowDays} gün
            </span>
          </div>
          <ul className="platform-comms-capability-chips" aria-label="Altyapı durumu">
            <li className={data.capabilities.smtpConfigured ? 'is-ok' : 'is-warn'}>
              SMTP {data.capabilities.smtpConfigured ? 'hazır' : 'eksik'}
            </li>
            <li className={data.engagement.mailTrackEnabled ? 'is-ok' : 'is-muted'}>
              Açılma izleme {data.engagement.mailTrackEnabled ? 'açık' : 'kapalı'}
            </li>
            <li className={data.engagement.clickTrackEnabled ? 'is-ok' : 'is-muted'}>
              Tıklama {data.engagement.clickTrackEnabled ? 'açık' : 'kapalı'}
            </li>
          </ul>
          <div className="platform-comms-hero-btns">
            <button
              type="button"
              className="btn btn-text platform-security-export-btn"
              disabled={exportingCsv}
              onClick={() => void onExportCsv()}
            >
              {exportingCsv ? 'İndiriliyor…' : 'Kiracı raporu (CSV)'}
            </button>
            <button type="button" className="btn btn-primary platform-users-refresh" onClick={() => void load()}>
              Yenile
            </button>
          </div>
        </div>
      </header>

      <section className="platform-comms-toolbar" aria-label="Rapor penceresi">
        <div className="platform-users-filter-bar platform-comms-filter-bar">
          <div className="platform-users-select-grid platform-comms-select-grid">
            <PlatformFilterSelect
              label="Rapor penceresi"
              icon="status"
              value={String(windowDays)}
              onChange={(v) => setWindowDays(Number(v))}
            >
              <option value="7">Son 7 gün</option>
              <option value="14">Son 14 gün</option>
              <option value="30">Son 30 gün</option>
              <option value="90">Son 90 gün</option>
            </PlatformFilterSelect>
          </div>
          <p className="platform-comms-toolbar-hint">
            Trend, SLA ve etkileşim metrikleri seçilen pencereye göre hesaplanır.
          </p>
        </div>
        {actionMsg && (
          <p className="platform-comms-action-msg" role="status">{actionMsg}</p>
        )}
      </section>

      <div className="platform-users-kpi-grid platform-users-kpi-grid--premium" aria-label="Özet KPI">
        <article className="platform-users-kpi platform-users-kpi--primary">
          <KpiIcon name="login" />
          <div className="platform-users-kpi-body">
            <span className="platform-users-kpi-label">Bekleyen outbox</span>
            <strong className="platform-users-kpi-value">{data.outboxCounts.pending}</strong>
            <span className="platform-users-kpi-sub">{data.pendingSample}+ örnek listeleniyor</span>
          </div>
        </article>
        <article className="platform-users-kpi platform-users-kpi--ring">
          <RingProgress pct={deliveryPct} variant={deliveryVariant} />
          <div className="platform-users-kpi-body">
            <span className="platform-users-kpi-label">{data.windowDays}g gönderim</span>
            <strong className="platform-users-kpi-value">{data.outboxWindow.sent}</strong>
            <div className="platform-users-login-rate">
              <div className="platform-users-login-rate-bar">
                <span style={{ width: `${deliveryPct}%` }} />
              </div>
              <span className="platform-users-kpi-sub">
                {deliveryPct}% başarı · {data.outboxWindow.failed} başarısız
              </span>
            </div>
          </div>
        </article>
        <article className="platform-users-kpi platform-users-kpi--danger">
          <KpiIcon name="churn" />
          <div className="platform-users-kpi-body">
            <span className="platform-users-kpi-label">Toplam başarısız</span>
            <strong className="platform-users-kpi-value">{data.outboxCounts.failed}</strong>
            {data.outboxCounts.failed >= data.capabilities.failedAlertThreshold && (
              <span className="platform-users-kpi-sub">Eşik üstü ({data.capabilities.failedAlertThreshold})</span>
            )}
          </div>
        </article>
        <article className="platform-users-kpi platform-users-kpi--warn">
          <KpiIcon name="users" />
          <div className="platform-users-kpi-body">
            <span className="platform-users-kpi-label">Açık mesaj konuları</span>
            <strong className="platform-users-kpi-value">{data.messagingTotals.open}</strong>
            <span className="platform-users-kpi-sub platform-users-kpi-sub--warn">
              {data.messagingTotals.pendingFirstResponse} ilk yanıt bekliyor
            </span>
          </div>
        </article>
        {data.engagement.mailTrackEnabled && (
          <article className="platform-users-kpi">
            <KpiIcon name="roles" />
            <div className="platform-users-kpi-body">
              <span className="platform-users-kpi-label">E-posta etkileşim</span>
              <strong className="platform-users-kpi-value">{data.engagement.totals.uniqueOpens}</strong>
              <span className="platform-users-kpi-sub">
                Açılma · {data.engagement.totals.uniqueClicks} tıklama · {data.engagement.totals.bounces} bounce
              </span>
            </div>
          </article>
        )}
      </div>

      <section className="platform-users-panel platform-comms-ops" aria-label="Operasyonlar">
        <div className="platform-users-panel-head">
          <h3>Operasyonlar</h3>
          <span className="platform-muted">Platform düzeyinde outbox ve kuyruk yönetimi</span>
        </div>
        <div className="platform-comms-ops-grid">
          <article className="platform-comms-ops-card">
            <div className="platform-comms-ops-card-icon platform-comms-ops-card-icon--send" aria-hidden />
            <div className="platform-comms-ops-card-body">
              <h4>Bekleyen gönderim</h4>
              <p>
                Kuyruktaki en fazla 30 mesajı işler; kiracılar arasında adil sıra uygulanır.
              </p>
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy !== null || data.outboxCounts.pending === 0}
                onClick={() => void runProcess()}
              >
                {busy === 'process' ? 'İşleniyor…' : `Outbox işle (${data.outboxCounts.pending} bekliyor)`}
              </button>
            </div>
          </article>
          <article className="platform-comms-ops-card">
            <div className="platform-comms-ops-card-icon platform-comms-ops-card-icon--retry" aria-hidden />
            <div className="platform-comms-ops-card-body">
              <h4>Başarısız kayıtlar</h4>
              <p>
                Tüm kiracılardaki başarısız outbox öğelerini yeniden pending kuyruğuna alır.
              </p>
              <button
                type="button"
                className="btn btn-secondary platform-comms-ops-secondary"
                disabled={busy !== null || data.outboxCounts.failed === 0}
                onClick={() => void runRequeue()}
              >
                {busy === 'requeue' ? 'Kuyruğa alınıyor…' : `Yeniden kuyrukla (${data.outboxCounts.failed})`}
              </button>
            </div>
          </article>
        </div>
      </section>

      {data.outboxByDay.length > 0 && (
        <section className="platform-users-panel platform-comms-trend-panel" aria-label="Gönderim trendi">
          <div className="platform-users-panel-head">
            <h3>Outbox trendi ({data.windowDays} gün)</h3>
            <span className="platform-muted">Gönderildi vs başarısız</span>
          </div>
          <div className="platform-security-trend platform-comms-trend" role="img" aria-label="Outbox trendi">
            {data.outboxByDay.map((day) => {
              const total = day.sent + day.failed;
              const h = total ? Math.max(4, Math.round((total / trendMax) * 100)) : 2;
              const failH = total ? Math.round((day.failed / total) * h) : 0;
              const okH = h - failH;
              return (
                <div key={day.date} className="platform-security-trend-col" title={`${day.date}: ${day.sent} gönderildi, ${day.failed} başarısız`}>
                  <div className="platform-security-trend-bar" style={{ height: `${h}%` }}>
                    {okH > 0 && <span className="platform-security-trend-ok" style={{ flex: okH }} />}
                    {failH > 0 && <span className="platform-security-trend-fail" style={{ flex: failH }} />}
                  </div>
                  <span className="platform-security-trend-label">{formatDayLabel(day.date)}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {data.failureBreakdown.length > 0 && (
        <section className="platform-users-panel" aria-label="Hata sınıfları">
          <div className="platform-users-panel-head">
            <h3>Başarısız gönderim nedenleri</h3>
          </div>
          <ul className="platform-comms-failure-list">
            {data.failureBreakdown.map((row) => (
              <li key={row.id}>
                <span className="platform-comms-failure-label">{row.label}</span>
                <strong>{row.count}</strong>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="platform-users-panel" aria-label="Kiracı tablosu">
        <div className="platform-users-panel-head">
          <h3>Kiracı özeti</h3>
          <span className="platform-muted">{data.tenants.length} mağaza</span>
        </div>
        <div className="platform-users-table-scroll">
          <table className="platform-table platform-table--premium">
            <thead>
              <tr>
                <th>Mağaza</th>
                <th>Bekleyen</th>
                <th>Başarısız</th>
                <th>Mesaj (açık)</th>
                <th>İlk yanıt bekliyor</th>
                <th>Medyan yanıt</th>
                {data.engagement.mailTrackEnabled && <th>Etkileşim</th>}
              </tr>
            </thead>
            <tbody>
              {data.tenants.map((t) => (
                <tr key={t.tenantId}>
                  <td>
                    <strong>{t.businessName}</strong>
                    <div className="platform-muted">{t.tenantId}</div>
                  </td>
                  <td>
                    <span className={`platform-comms-num ${t.outbox.pending > 0 ? 'is-highlight' : ''}`}>
                      {t.outbox.pending}
                    </span>
                  </td>
                  <td>
                    <span className={`platform-comms-num ${t.outbox.failed > 0 ? 'is-danger' : ''}`}>
                      {t.outbox.failed}
                    </span>
                  </td>
                  <td>{t.messaging.open}</td>
                  <td>{t.messaging.pendingFirstResponse}</td>
                  <td>{formatDurationMs(t.firstResponse.medianMs)}</td>
                  {data.engagement.mailTrackEnabled && (
                    <td>
                      {t.engagement.opens} / {t.engagement.clicks}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="platform-comms-split">
        <section className="platform-users-panel" aria-label="Son outbox">
          <div className="platform-users-panel-head">
            <h3>Son outbox kayıtları</h3>
          </div>
          <ul className="platform-comms-feed">
            {data.recentOutbox.slice(0, 16).map((row) => (
              <li key={`${row.id}-${row.at}`} className="platform-comms-feed-item">
                <span className="platform-comms-feed-avatar" aria-hidden>
                  {(row.subject || row.to || '?').trim().charAt(0).toUpperCase()}
                </span>
                <div className="platform-comms-feed-main">
                  <div className="platform-comms-feed-top">
                    <strong>{row.subject || '(konu yok)'}</strong>
                    <span className={`platform-comms-folder platform-comms-folder--${row.folder}`}>
                      {FOLDER_LABELS[row.folder] ?? row.folder}
                    </span>
                  </div>
                  <span className="platform-comms-feed-to">{row.to}</span>
                  <span className="platform-comms-feed-meta">
                    <span className="platform-comms-tenant-pill">{row.tenantId}</span>
                    {formatDateTime(row.at)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {data.recentErrors.length > 0 && (
          <section className="platform-users-panel" aria-label="Son hatalar">
            <div className="platform-users-panel-head">
              <h3>Son gönderim hataları</h3>
            </div>
            <ul className="platform-comms-feed platform-comms-feed--errors">
              {data.recentErrors.map((row) => (
                <li key={row.id} className="platform-comms-feed-item platform-comms-feed-item--error">
                  <span className="platform-comms-feed-avatar platform-comms-feed-avatar--error" aria-hidden>!</span>
                  <div className="platform-comms-feed-main">
                    <strong>{row.subject || row.to}</strong>
                    <span className="platform-comms-error-text">{row.error}</span>
                    <span className="platform-comms-feed-meta">{formatDateTime(row.at)}</span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
