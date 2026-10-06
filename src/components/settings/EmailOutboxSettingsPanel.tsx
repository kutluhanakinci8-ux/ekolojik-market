import { useCallback, useEffect, useState } from 'react';
import {
  fetchEmailHealth,
  processEmailOutbox,
  sendEmailTest,
} from '../../services/emailOutboxService';

export function EmailOutboxSettingsPanel() {
  const [health, setHealth] = useState<Awaited<ReturnType<typeof fetchEmailHealth>> | null>(null);
  const [testTo, setTestTo] = useState('');
  const [flash, setFlash] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    const h = await fetchEmailHealth();
    setHealth(h);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

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
          <h2>E-posta (Faz 1)</h2>
          <p>Ekolojik bağımsız outbox + SMTP — Nakliye Borsası ile paylaşılmaz</p>
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
          <span className="settings-stat-label">Kuyruk</span>
          <strong>{health?.counts?.pending ?? 0}</strong>
        </article>
        <article className="settings-stat-card">
          <span className="settings-stat-label">Gönderilen</span>
          <strong>{health?.counts?.sent ?? 0}</strong>
        </article>
      </div>

      {health?.smtpError && (
        <p className="settings-flash settings-flash--pending">{health.smtpError}</p>
      )}

      <p className="settings-hint">
        VPS `.env`: <code>EKOLOJIK_SMTP_HOST</code>, <code>EKOLOJIK_SMTP_PORT</code>,{' '}
        <code>EKOLOJIK_MAIL_FROM</code>, isteğe bağlı <code>EKOLOJIK_SMTP_USER</code> /{' '}
        <code>EKOLOJIK_SMTP_PASS</code>
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
    </section>
  );
}
