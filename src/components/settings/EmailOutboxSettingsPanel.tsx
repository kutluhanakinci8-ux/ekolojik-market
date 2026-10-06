import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchEmailHealth,
  fetchRecentOutbox,
  processEmailOutbox,
  sendEmailTest,
} from '../../services/emailOutboxService';

type OutboxRow = {
  id: string;
  to: string;
  subject: string;
  source?: string;
  status?: string;
  folder?: string;
  createdAt?: string;
  sentAt?: string | null;
  lastError?: string | null;
};

function formatWhen(row: OutboxRow) {
  const raw = row.sentAt || row.createdAt;
  if (!raw) return '—';
  try {
    return new Date(raw).toLocaleString('tr-TR');
  } catch {
    return raw;
  }
}

function statusLabel(row: OutboxRow) {
  if (row.folder === 'sent' || row.status === 'sent') return 'Gönderildi';
  if (row.folder === 'failed' || row.status === 'failed') return 'Hata';
  return 'Kuyruk';
}

export function EmailOutboxSettingsPanel() {
  const [health, setHealth] = useState<Awaited<ReturnType<typeof fetchEmailHealth>> | null>(null);
  const [outboxRows, setOutboxRows] = useState<OutboxRow[]>([]);
  const [testTo, setTestTo] = useState('');
  const [flash, setFlash] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    const [h, recent] = await Promise.all([fetchEmailHealth(), fetchRecentOutbox(50)]);
    setHealth(h);
    if (recent.ok && Array.isArray(recent.items)) {
      setOutboxRows(recent.items as OutboxRow[]);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const failedCount = useMemo(
    () => outboxRows.filter((r) => r.folder === 'failed' || r.status === 'failed').length,
    [outboxRows],
  );

  const runTest = async () => {
    setLoading(true);
    setFlash(null);
    try {
      const result = await sendEmailTest({ to: testTo.trim() });
      if (result.ok) {
        setFlash(`Test kuyruğa alındı/gönderildi (${result.provider ?? 'outbox'})`);
      } else {
        setFlash(result.error ?? 'Test başarısız');
      }
      await refresh();
    } finally {
      setLoading(false);
    }
  };

  const drain = async () => {
    setLoading(true);
    try {
      const result = await processEmailOutbox();
      setFlash(
        result.ok
          ? `Kuyruk: ${result.sent ?? 0} gönderildi, ${result.failed ?? 0} hata`
          : 'Kuyruk işlenemedi',
      );
      await refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="settings-panel">
      <div className="settings-panel-head">
        <div>
          <h2>E-posta (Faz 1–2)</h2>
          <p>Ekolojik bağımsız outbox + SMTP — iletişim formu bildirimleri dahil</p>
        </div>
      </div>

      {flash && <p className="settings-flash">{flash}</p>}

      <div className="settings-stat-grid">
        <article className="settings-stat-card">
          <span className="settings-stat-label">SMTP</span>
          <strong className={health?.smtpVerified ? 'is-ok' : ''}>
            {health?.smtpConfigured ? (health.smtpVerified ? 'Hazır' : 'Hata') : 'Yapılandırılmadı'}
          </strong>
        </article>
        <article className="settings-stat-card">
          <span className="settings-stat-label">Gönderen</span>
          <strong>{health?.from ?? '—'}</strong>
        </article>
        <article className="settings-stat-card">
          <span className="settings-stat-label">Operasyon</span>
          <strong>{health?.opsEmail ?? '—'}</strong>
        </article>
        <article className="settings-stat-card">
          <span className="settings-stat-label">Kuyruk</span>
          <strong>{health?.counts?.pending ?? 0}</strong>
        </article>
        <article className="settings-stat-card">
          <span className="settings-stat-label">Gönderilen</span>
          <strong>{health?.counts?.sent ?? 0}</strong>
        </article>
        <article className="settings-stat-card">
          <span className="settings-stat-label">Hatalı</span>
          <strong className={failedCount > 0 ? 'is-warn' : ''}>
            {health?.counts?.failed ?? 0}
          </strong>
        </article>
      </div>

      {health?.smtpError && (
        <p className="settings-flash settings-flash--pending">{health.smtpError}</p>
      )}

      <p className="settings-hint">
        VPS `.env`: <code>EKOLOJIK_SMTP_HOST</code>, <code>EKOLOJIK_MAIL_FROM</code>,{' '}
        <code>EKOLOJIK_OPS_EMAIL</code>, isteğe bağlı <code>EKOLOJIK_CONTACT_AUTOREPLY=1</code>
      </p>

      <div className="settings-form-grid">
        <label className="settings-field settings-field--full">
          <span>Test alıcı e-posta</span>
          <input
            type="email"
            value={testTo}
            onChange={(e) => setTestTo(e.target.value)}
            placeholder="ornek@firma.com"
          />
        </label>
      </div>

      <div className="settings-panel-actions">
        <button type="button" className="btn btn-outline" disabled={loading} onClick={() => refresh()}>
          Yenile
        </button>
        <button type="button" className="btn btn-outline" disabled={loading} onClick={() => drain()}>
          Kuyruğu işle
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={loading || !testTo.includes('@')}
          onClick={() => runTest()}
        >
          Test maili gönder
        </button>
      </div>

      <div className="settings-panel-head" style={{ marginTop: '1.5rem' }}>
        <div>
          <h3>Gönderim günlüğü</h3>
          <p>Son {outboxRows.length} outbox kaydı (kuyruk, gönderilen, hatalı)</p>
        </div>
      </div>

      <div className="module-table-wrap" style={{ overflowX: 'auto' }}>
        <table className="module-table module-table--wide">
          <thead>
            <tr>
              <th>Tarih</th>
              <th>Alıcı</th>
              <th>Konu</th>
              <th>Kaynak</th>
              <th>Durum</th>
            </tr>
          </thead>
          <tbody>
            {outboxRows.length === 0 ? (
              <tr>
                <td colSpan={5}>Henüz kayıt yok</td>
              </tr>
            ) : (
              outboxRows.map((row) => (
                <tr key={row.id}>
                  <td>{formatWhen(row)}</td>
                  <td>{row.to}</td>
                  <td>{row.subject}</td>
                  <td>{row.source ?? '—'}</td>
                  <td title={row.lastError ?? undefined}>{statusLabel(row)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
