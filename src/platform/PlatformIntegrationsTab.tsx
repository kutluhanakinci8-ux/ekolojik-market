import { useCallback, useEffect, useState } from 'react';
import {
  downloadPlatformIntegrationsCsv,
  fetchPlatformIntegrationsOverview,
  runPlatformIntegrationsProbe,
  type PlatformIntegrationsPayload,
} from '../services/platformApi';
import { KpiIcon, RingProgress } from './platformUserUi';

const STATUS_LABELS: Record<string, string> = {
  ok: 'Aktif',
  warn: 'Eksik',
  off: 'Kapalı',
};

function IntegrationsSkeleton() {
  return (
    <div className="platform-integrations platform-integrations--loading" aria-busy="true">
      <div className="platform-users-skeleton-hero" />
      <div className="platform-users-skeleton-kpis" />
      <div className="platform-users-skeleton-block" />
    </div>
  );
}

export function PlatformIntegrationsTab() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PlatformIntegrationsPayload | null>(null);
  const [probeMsg, setProbeMsg] = useState<string | null>(null);
  const [probing, setProbing] = useState(false);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await fetchPlatformIntegrationsOverview();
    if (!result.ok || !result.data) {
      setError(result.error ?? 'Veri yüklenemedi');
      setLoading(false);
      return;
    }
    setData(result.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const runProbe = async (kind: 'mail' | 'webhooks') => {
    setProbing(true);
    setProbeMsg(null);
    const body =
      kind === 'mail'
        ? { smtp: true, imap: true }
        : { engagementWebhook: true, securityWebhook: true };
    const result = await runPlatformIntegrationsProbe(body);
    setProbing(false);
    if (!result.ok) {
      setProbeMsg(result.error ?? 'Probe başarısız');
      return;
    }
    const parts: string[] = [];
    const p = result.probes ?? {};
    if (p.smtp) parts.push(`SMTP: ${p.smtp.ok ? 'OK' : p.smtp.error ?? 'hata'}`);
    if (p.imap) parts.push(`IMAP: ${p.imap.ok ? 'OK' : p.imap.error ?? 'hata'}`);
    if (p.engagementWebhook) {
      parts.push(
        `Engagement WH: ${p.engagementWebhook.skipped ? 'yapılandırılmadı' : p.engagementWebhook.ok ? 'OK' : p.engagementWebhook.error ?? 'hata'}`,
      );
    }
    if (p.securityWebhook) {
      parts.push(
        `Güvenlik WH: ${p.securityWebhook.skipped ? 'yapılandırılmadı' : p.securityWebhook.ok ? 'OK' : p.securityWebhook.error ?? 'hata'}`,
      );
    }
    setProbeMsg(parts.join(' · ') || 'Tamamlandı');
    void load();
  };

  const onExport = async () => {
    setExporting(true);
    const result = await downloadPlatformIntegrationsCsv();
    setExporting(false);
    if (!result.ok) setProbeMsg(result.error ?? 'CSV indirilemedi');
  };

  if (loading && !data) return <IntegrationsSkeleton />;
  if (error && !data) {
    return (
      <div className="platform-integrations platform-panel">
        <p className="platform-error">{error}</p>
        <button type="button" className="btn btn-primary" onClick={() => void load()}>
          Yeniden dene
        </button>
      </div>
    );
  }
  if (!data) return null;

  const scoreVariant = data.score >= 80 ? 'brand' : data.score >= 50 ? 'warn' : 'muted';

  return (
    <div className="platform-integrations">
      <section className="platform-users-hero platform-integrations-hero">
        <div className="platform-integrations-hero-main">
          <RingProgress pct={data.score} size={72} label="Entegrasyon skoru" variant={scoreVariant} />
          <div>
            <h2>Entegrasyonlar</h2>
            <p>Posta, mesajlaşma, webhook ve kiracı kanal hazırlığı — canlı testler operatör onayıyla çalışır.</p>
          </div>
        </div>
        <div className="platform-integrations-hero-actions">
          <button type="button" className="btn btn-text" onClick={() => void load()} disabled={loading}>
            Yenile
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => void runProbe('mail')} disabled={probing}>
            SMTP/IMAP test
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => void runProbe('webhooks')} disabled={probing}>
            Webhook test
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => void onExport()} disabled={exporting}>
            CSV
          </button>
        </div>
      </section>

      {probeMsg ? <p className="platform-inline-msg">{probeMsg}</p> : null}

      <div className="platform-users-kpi-grid">
        <article className="platform-users-kpi">
          <KpiIcon name="login" />
          <span className="platform-users-kpi-label">Outbox bekleyen</span>
          <strong className="platform-users-kpi-value">{data.outbox.pending}</strong>
          <span className="platform-users-kpi-sub">{data.outbox.failed} başarısız</span>
        </article>
        <article className="platform-users-kpi">
          <KpiIcon name="active" />
          <span className="platform-users-kpi-label">WS istemcileri</span>
          <strong className="platform-users-kpi-value">{data.realtime.connectedClients}</strong>
          <span className="platform-users-kpi-sub">{data.realtime.path}</span>
        </article>
        <article className="platform-users-kpi">
          <KpiIcon name="roles" />
          <span className="platform-users-kpi-label">Webhook</span>
          <strong className="platform-users-kpi-value">
            {data.webhooks.filter((w) => w.configured).length}/{data.webhooks.length}
          </strong>
        </article>
      </div>

      <section className="platform-panel">
        <h3>Bağlantılar</h3>
        <ul className="platform-integrations-connectors">
          {data.connectors.map((c) => (
            <li key={c.id} className={`platform-integrations-connector platform-integrations-connector--${c.status}`}>
              <span className="platform-integrations-connector-label">{c.label}</span>
              <span className="platform-integrations-connector-status">{STATUS_LABELS[c.status] ?? c.status}</span>
              <span className="platform-integrations-connector-detail">{c.detail}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="platform-panel">
        <h3>Webhook uçları</h3>
        <table className="platform-table platform-table--compact">
          <thead>
            <tr>
              <th>Ad</th>
              <th>Durum</th>
              <th>URL (maskeli)</th>
              <th>Kaynak</th>
            </tr>
          </thead>
          <tbody>
            {data.webhooks.map((w) => (
              <tr key={w.id}>
                <td>{w.label}</td>
                <td>{w.configured ? (w.enabled ? 'Hazır' : 'Kapalı') : 'Yok'}</td>
                <td>{w.urlMasked ?? '—'}</td>
                <td>{w.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="platform-panel">
        <h3>Kiracı kanal matrisi</h3>
        <table className="platform-table platform-table--scroll">
          <thead>
            <tr>
              <th>Mağaza</th>
              <th>Posta modu</th>
              <th>SMTP</th>
              <th>IMAP</th>
              <th>Mesaj anahtarı</th>
              <th>Mail sağlık</th>
              <th>Embed</th>
            </tr>
          </thead>
          <tbody>
            {data.tenants.map((t) => (
              <tr key={t.tenantId}>
                <td>
                  <span className="platform-table-primary">{t.businessName}</span>
                  <span className="platform-table-muted">{t.tenantId}</span>
                </td>
                <td>{t.mailMode === 'platform' ? 'Platform' : 'Özel'}</td>
                <td>{t.smtpConfigured ? '✓' : '—'}</td>
                <td>{t.imapConfigured ? '✓' : '—'}</td>
                <td>{t.messagingPublicKey || '—'}</td>
                <td>{t.mailHealthDone ? '✓' : '—'}</td>
                <td>{t.messagingEmbedDone ? '✓' : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
