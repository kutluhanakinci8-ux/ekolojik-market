import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchPlatformInfrastructureOverview,
  platformCommsProcessOutbox,
  runPlatformInfrastructureProbe,
  type PlatformInfrastructurePayload,
} from '../services/platformApi';
import { KpiIcon, RingProgress } from './platformUserUi';

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

function formatBytes(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

function formatUptime(sec: number): string {
  if (sec < 60) return `${sec} sn`;
  if (sec < 3600) return `${Math.floor(sec / 60)} dk`;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return m ? `${h} sa ${m} dk` : `${h} sa`;
}

function InfraSkeleton() {
  return (
    <div className="platform-infra platform-infra--loading" aria-busy="true">
      <div className="platform-users-skeleton-hero" />
      <div className="platform-users-skeleton-kpis" />
      <div className="platform-users-skeleton-block" />
    </div>
  );
}

export function PlatformInfrastructureTab() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PlatformInfrastructurePayload | null>(null);
  const [probeMsg, setProbeMsg] = useState<string | null>(null);
  const [probing, setProbing] = useState(false);
  const [outboxBusy, setOutboxBusy] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await fetchPlatformInfrastructureOverview();
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

  const failedChecks = useMemo(
    () => (data?.isolation.checks ?? []).filter((c) => !c.ok),
    [data],
  );

  const runProbe = async () => {
    setProbing(true);
    setProbeMsg(null);
    const result = await runPlatformInfrastructureProbe();
    setProbing(false);
    if (!result.ok) {
      setProbeMsg(result.error ?? 'Probe başarısız');
      return;
    }
    const smtp = result.probes?.smtp;
    const imap = result.probes?.imap;
    const parts = [];
    if (smtp) parts.push(`SMTP: ${smtp.ok ? 'OK' : smtp.error ?? 'hata'}`);
    if (imap) parts.push(`IMAP: ${imap.ok ? 'OK' : imap.error ?? imap.message ?? 'hata'}`);
    setProbeMsg(parts.join(' · ') || 'Tamamlandı');
  };

  const runOutbox = async () => {
    setOutboxBusy(true);
    setActionMsg(null);
    const result = await platformCommsProcessOutbox(30);
    setOutboxBusy(false);
    if (!result.ok) {
      setActionMsg(result.error ?? 'Outbox işlenemedi');
      return;
    }
    const p = result.processed;
    setActionMsg(
      p
        ? `Outbox: ${p.sent} gönderildi, ${p.failed} başarısız (${p.processed} işlendi)`
        : 'Tamamlandı',
    );
    void load();
  };

  if (loading && !data) return <InfraSkeleton />;
  if (error && !data) {
    return (
      <div className="platform-users-error">
        <p className="landing-flash landing-flash--error" role="alert">{error}</p>
        <button type="button" className="btn btn-primary" onClick={() => void load()}>Tekrar dene</button>
      </div>
    );
  }
  if (!data) return null;

  const scoreVariant = data.score >= 85 ? 'brand' : 'warn';
  const counts = data.outbox.counts;

  return (
    <div className="platform-infra platform-infra--premium platform-users--premium">
      <header className="platform-users-hero platform-users-hero--premium platform-infra-hero">
        <div className="platform-users-hero-copy">
          <span className="platform-users-hero-badge">Infrastructure</span>
          <h2>Altyapı & sağlık</h2>
          <p>
            Posta relay, IMAP, outbox kuyruğu, veri hacmi, yedekler ve Ekolojik izolasyon kontrolleri.
          </p>
          <time className="platform-users-hero-time" dateTime={data.generatedAt}>
            Son güncelleme: {formatDateTime(data.generatedAt)}
          </time>
        </div>
        <div className="platform-users-hero-actions">
          <div className="platform-infra-hero-metrics">
            <RingProgress pct={data.score} size={72} label="Skor" variant={scoreVariant} />
            <span className="platform-users-hero-stat-label">Altyapı sağlık skoru</span>
          </div>
          <ul className="platform-overview-hero-chips" aria-label="Runtime">
            <li className="is-muted">v{data.runtime.appVersion}</li>
            <li className={data.mail.smtpConfigured ? 'is-ok' : 'is-warn'}>SMTP</li>
            <li className={data.mail.imapConfigured ? 'is-ok' : 'is-muted'}>IMAP</li>
          </ul>
          <div className="platform-comms-hero-btns">
            <button
              type="button"
              className="btn btn-text platform-security-export-btn"
              disabled={probing}
              onClick={() => void runProbe()}
            >
              {probing ? 'Test ediliyor…' : 'SMTP/IMAP canlı test'}
            </button>
            <button type="button" className="btn btn-primary platform-users-refresh" onClick={() => void load()}>
              Yenile
            </button>
          </div>
        </div>
      </header>

      {probeMsg && <p className="platform-comms-action-msg platform-infra-flash" role="status">{probeMsg}</p>}
      {actionMsg && <p className="platform-comms-action-msg platform-infra-flash" role="status">{actionMsg}</p>}

      <div className="platform-users-kpi-grid platform-users-kpi-grid--premium" aria-label="Altyapı KPI">
        <article className="platform-users-kpi platform-users-kpi--primary">
          <KpiIcon name="login" />
          <div className="platform-users-kpi-body">
            <span className="platform-users-kpi-label">Bekleyen outbox</span>
            <strong className="platform-users-kpi-value">{counts.pending}</strong>
          </div>
        </article>
        <article className="platform-users-kpi platform-users-kpi--danger">
          <KpiIcon name="churn" />
          <div className="platform-users-kpi-body">
            <span className="platform-users-kpi-label">Başarısız outbox</span>
            <strong className="platform-users-kpi-value">{counts.failed}</strong>
            <span className="platform-users-kpi-sub">Eşik: {data.outbox.failedAlertThreshold}</span>
          </div>
        </article>
        <article className="platform-users-kpi">
          <KpiIcon name="active" />
          <div className="platform-users-kpi-body">
            <span className="platform-users-kpi-label">Gönderilmiş</span>
            <strong className="platform-users-kpi-value">{counts.sent}</strong>
          </div>
        </article>
        <article className="platform-users-kpi platform-users-kpi--warn">
          <KpiIcon name="sleep" />
          <div className="platform-users-kpi-body">
            <span className="platform-users-kpi-label">Uptime</span>
            <strong className="platform-users-kpi-value">{formatUptime(data.runtime.uptimeSec)}</strong>
            <span className="platform-users-kpi-sub">Node {data.runtime.nodeVersion}</span>
          </div>
        </article>
      </div>

      <section className="platform-users-panel" aria-label="İzolasyon kontrolleri">
        <div className="platform-users-panel-head">
          <h3>Ekolojik izolasyon</h3>
          <span className="platform-muted">{failedChecks.length} açık kontrol</span>
        </div>
        <ul className="platform-infra-check-list">
          {data.isolation.checks.map((check) => (
            <li key={check.id} className={`platform-infra-check ${check.ok ? 'is-ok' : 'is-fail'}`}>
              <span className="platform-infra-check-icon" aria-hidden>{check.ok ? '✓' : '!'}</span>
              <div className="platform-infra-check-body">
                <strong>{check.label}</strong>
                <span className="platform-muted">{check.detail}</span>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <div className="platform-comms-split">
        <section className="platform-users-panel" aria-label="Posta">
          <div className="platform-users-panel-head">
            <h3>Posta altyapısı</h3>
          </div>
          <dl className="platform-overview-stats platform-infra-dl">
            <div><dt>SMTP host</dt><dd>{data.mail.smtpHost ?? '—'}</dd></div>
            <div><dt>Gönderen</dt><dd>{data.mail.from ?? '—'}</dd></div>
            <div><dt>Ops e-posta</dt><dd>{data.mail.opsEmail ?? '—'}</dd></div>
            <div><dt>IMAP</dt><dd>{data.mail.imapHost ? `${data.mail.imapHost} (${data.mail.imapUser})` : '—'}</dd></div>
            <div><dt>Lerta köprü</dt><dd>{data.mail.lertaBridge ? 'Açık' : 'Kapalı'}</dd></div>
          </dl>
          {data.mail.smtpHostHint && (
            <p className="platform-infra-hint platform-warn">{data.mail.smtpHostHint}</p>
          )}
          <div className="platform-comms-ops-actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={outboxBusy || counts.pending === 0}
              onClick={() => void runOutbox()}
            >
              {outboxBusy ? 'İşleniyor…' : 'Outbox işle (30)'}
            </button>
          </div>
        </section>

        <section className="platform-users-panel" aria-label="Runtime">
          <div className="platform-users-panel-head">
            <h3>Çalışma ortamı</h3>
          </div>
          <dl className="platform-overview-stats platform-infra-dl">
            <div><dt>Ortam</dt><dd>{data.runtime.nodeEnv}</dd></div>
            <div><dt>Port</dt><dd>{data.runtime.port}</dd></div>
            <div><dt>Deploy</dt><dd>{data.runtime.deployRef ?? '—'}</dd></div>
            <div><dt>Platform oturum</dt><dd>epoch {data.runtime.platformSessionEpoch}</dd></div>
            <div><dt>Veri kökü</dt><dd className="platform-infra-mono">{data.runtime.dataDir}</dd></div>
          </dl>
          <p className="platform-muted platform-infra-hint">
            Saklama: outbox {data.retention.outboxDays}g · mesaj {data.retention.messagingDays}g · iletişim{' '}
            {data.retention.contactDays}g
          </p>
        </section>
      </div>

      <section className="platform-users-panel" aria-label="Depolama">
        <div className="platform-users-panel-head">
          <h3>Veri hacmi</h3>
        </div>
        <div className="platform-users-table-scroll">
          <table className="platform-table platform-table--premium">
            <thead>
              <tr>
                <th>Yol</th>
                <th>Tahmini boyut</th>
              </tr>
            </thead>
            <tbody>
              {data.storage.map((row) => (
                <tr key={row.name}>
                  <td><code className="platform-infra-mono">{row.path}</code></td>
                  <td>{formatBytes(row.sizeBytes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="platform-comms-split">
        <section className="platform-users-panel" aria-label="Yedek">
          <div className="platform-users-panel-head">
            <h3>Yedekler</h3>
            <span className="platform-muted">{data.backup.backupRoot}</span>
          </div>
          {data.backup.latest ? (
            <dl className="platform-overview-stats platform-infra-dl">
              <div><dt>Son arşiv</dt><dd>{data.backup.latest.name}</dd></div>
              <div><dt>Tarih</dt><dd>{formatDateTime(data.backup.latest.at)}</dd></div>
              <div><dt>Boyut</dt><dd>{formatBytes(data.backup.latest.sizeBytes)}</dd></div>
              <div><dt>Toplam dosya</dt><dd>{data.backup.count}</dd></div>
            </dl>
          ) : (
            <p className="platform-muted platform-overview-empty">
              {data.backup.unreadable
                ? 'Yedek dizinine erişilemedi (VPS yolu farklı olabilir).'
                : 'Henüz arşiv bulunamadı — cron: sunucu-ekolojik-data-yedek.sh'}
            </p>
          )}
        </section>

        <section className="platform-users-panel" aria-label="Cron">
          <div className="platform-users-panel-head">
            <h3>Zamanlanmış işler</h3>
          </div>
          <ul className="platform-infra-cron-list">
            {data.cronJobs.map((job) => (
              <li key={job.id} className={job.installed ? 'is-ok' : 'is-missing'}>
                <strong>{job.id}</strong>
                <span>{job.installed ? 'Kurulu' : 'Bulunamadı'}</span>
                {job.sample && <span className="platform-muted platform-infra-mono">{job.sample}</span>}
              </li>
            ))}
          </ul>
        </section>
      </div>

      {data.outbox.byTenant.length > 0 && (
        <section className="platform-users-panel" aria-label="Outbox kiracı">
          <div className="platform-users-panel-head">
            <h3>Outbox (kiracı)</h3>
          </div>
          <div className="platform-users-table-scroll">
            <table className="platform-table platform-table--premium">
              <thead>
                <tr>
                  <th>Kiracı</th>
                  <th>Bekleyen</th>
                  <th>Gönderildi</th>
                  <th>Başarısız</th>
                </tr>
              </thead>
              <tbody>
                {data.outbox.byTenant.map((row) => (
                  <tr key={row.tenantId}>
                    <td><code>{row.tenantId}</code></td>
                    <td>{row.pending}</td>
                    <td>{row.sent}</td>
                    <td className={row.failed > 0 ? 'platform-warn' : ''}>{row.failed}</td>
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
