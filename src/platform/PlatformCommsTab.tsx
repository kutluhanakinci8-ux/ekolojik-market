import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  downloadPlatformCommsCsv,
  fetchPlatformCommsOverview,
  platformCommsProcessOutbox,
  platformCommsRequeueFailed,
  type PlatformCommsPayload,
} from '../services/platformApi';
import { KpiIcon, PlatformFilterSelect } from './platformUserUi';

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

  return (
    <div className="platform-comms platform-users--premium">
      <section className="platform-users-hero platform-users-hero--premium platform-comms-hero">
        <div className="platform-users-hero-copy">
          <span className="platform-users-hero-badge">Posta & mesaj</span>
          <h2>İletişim operasyonları</h2>
          <p>
            Tüm kiracılarda e-posta outbox, müşteri mesajlaşma SLA ve (varsa) açılma/tıklama istatistikleri.
            Son güncelleme: {formatDateTime(data.generatedAt)}
          </p>
          <div className="platform-users-hero-actions">
            <PlatformFilterSelect
              label="Pencere"
              icon="status"
              value={String(windowDays)}
              onChange={(v) => setWindowDays(Number(v))}
            >
              <option value="7">7 gün</option>
              <option value="14">14 gün</option>
              <option value="30">30 gün</option>
              <option value="90">90 gün</option>
            </PlatformFilterSelect>
            <button type="button" className="btn btn-text" onClick={() => void load()}>Yenile</button>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={exportingCsv}
              onClick={() => void onExportCsv()}
            >
              {exportingCsv ? 'İndiriliyor…' : 'Kiracı raporu (CSV)'}
            </button>
          </div>
          {actionMsg && <p className="platform-comms-action-msg" role="status">{actionMsg}</p>}
        </div>
        <div className="platform-users-hero-stat platform-comms-smtp-pill">
          <span className="platform-users-hero-stat-label">SMTP</span>
          <strong className={data.capabilities.smtpConfigured ? '' : 'platform-warn'}>
            {data.capabilities.smtpConfigured ? 'Yapılandırılmış' : 'Eksik'}
          </strong>
        </div>
      </section>

      <div className="platform-users-kpi-grid platform-users-kpi-grid--premium" aria-label="Özet KPI">
        <article className="platform-users-kpi">
          <KpiIcon name="login" />
          <div className="platform-users-kpi-body">
            <span className="platform-users-kpi-label">Bekleyen outbox</span>
            <strong className="platform-users-kpi-value">{data.outboxCounts.pending}</strong>
          </div>
        </article>
        <article className="platform-users-kpi">
          <KpiIcon name="active" />
          <div className="platform-users-kpi-body">
            <span className="platform-users-kpi-label">{data.windowDays}g gönderim</span>
            <strong className="platform-users-kpi-value">{data.outboxWindow.sent}</strong>
            <span className="platform-users-kpi-sub">
              Başarısız: {data.outboxWindow.failed}
              {successRate != null ? ` · ${successRate}% başarı` : ''}
            </span>
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
        <article className="platform-users-kpi">
          <KpiIcon name="users" />
          <div className="platform-users-kpi-body">
            <span className="platform-users-kpi-label">Açık mesaj konuları</span>
            <strong className="platform-users-kpi-value">{data.messagingTotals.open}</strong>
            <span className="platform-users-kpi-sub">
              İlk yanıt bekleyen: {data.messagingTotals.pendingFirstResponse}
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
          <span className="platform-muted">Outbox gönderimi ve başarısız kayıt yönetimi</span>
        </div>
        <div className="platform-comms-ops-actions">
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy !== null || data.outboxCounts.pending === 0}
            onClick={() => void runProcess()}
          >
            {busy === 'process' ? 'İşleniyor…' : 'Outbox işle (30)'}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={busy !== null || data.outboxCounts.failed === 0}
            onClick={() => void runRequeue()}
          >
            {busy === 'requeue' ? 'Kuyruğa alınıyor…' : 'Başarısızları yeniden kuyrukla'}
          </button>
        </div>
      </section>

      {data.outboxByDay.length > 0 && (
        <section className="platform-users-panel" aria-label="Gönderim trendi">
          <div className="platform-users-panel-head">
            <h3>Outbox trendi ({data.windowDays} gün)</h3>
            <span className="platform-muted">Gönderildi vs başarısız</span>
          </div>
          <div className="platform-security-trend" role="img" aria-label="Outbox trendi">
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
                  <td>{t.outbox.pending}</td>
                  <td className={t.outbox.failed > 0 ? 'platform-warn' : ''}>{t.outbox.failed}</td>
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
              <li key={`${row.id}-${row.at}`}>
                <span className={`platform-comms-folder platform-comms-folder--${row.folder}`}>
                  {FOLDER_LABELS[row.folder] ?? row.folder}
                </span>
                <div className="platform-comms-feed-main">
                  <strong>{row.subject || '(konu yok)'}</strong>
                  <span>{row.to}</span>
                  <span className="platform-muted">
                    {row.tenantId} · {formatDateTime(row.at)}
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
                <li key={row.id}>
                  <div className="platform-comms-feed-main">
                    <strong>{row.subject || row.to}</strong>
                    <span className="platform-warn">{row.error}</span>
                    <span className="platform-muted">{formatDateTime(row.at)}</span>
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
