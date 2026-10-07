import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchEmailHealth,
  fetchRecentOutbox,
  fetchEkolojikIsolationReport,
  fetchRetentionPolicy,
  runDataRetention,
  processEmailOutbox,
  sendEmailTest,
} from '../../services/emailOutboxService';
import {
  fetchPostaMailSettings,
  savePostaMailSettings,
  downloadPostaOutboxCsv,
  downloadPostaContactCsv,
  downloadMessagingExportZip,
  fetchPostaOutboxAnalytics,
  fetchPostaRules,
  savePostaInboxRules,
  type PostaInboxRule,
  type PostaMailSettings,
  type PostaOutboxAnalytics,
} from '../../services/postaSettingsService';

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
  const [isolation, setIsolation] = useState<Awaited<ReturnType<typeof fetchEkolojikIsolationReport>> | null>(null);
  const [retention, setRetention] = useState<Awaited<ReturnType<typeof fetchRetentionPolicy>>['policy'] | null>(null);
  const [testTo, setTestTo] = useState('');
  const [flash, setFlash] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [postaSettings, setPostaSettings] = useState<PostaMailSettings | null>(null);
  const [exportFrom, setExportFrom] = useState('');
  const [exportTo, setExportTo] = useState('');
  const [outboxAnalytics, setOutboxAnalytics] = useState<PostaOutboxAnalytics | null>(null);
  const [postaRules, setPostaRules] = useState<PostaInboxRule[]>([]);

  const refresh = useCallback(async () => {
    const [h, recent, iso, ret, posta, analytics, rules] = await Promise.all([
      fetchEmailHealth(),
      fetchRecentOutbox(50),
      fetchEkolojikIsolationReport(),
      fetchRetentionPolicy(),
      fetchPostaMailSettings(),
      fetchPostaOutboxAnalytics(14),
      fetchPostaRules(),
    ]);
    setHealth(h);
    setIsolation(iso);
    if (ret.ok && ret.policy) setRetention(ret.policy);
    if (posta.ok && posta.settings) setPostaSettings(posta.settings);
    if (analytics.ok) setOutboxAnalytics(analytics);
    if (rules.ok && rules.rules) setPostaRules(rules.rules);
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
          <strong>{health?.fromName ?? health?.from ?? '—'}</strong>
          {health?.replyTo && health.replyTo !== health.from && (
            <span className="settings-hint">Yanıt: {health.replyTo}</span>
          )}
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

      <div className="settings-panel-head" style={{ marginTop: '1.25rem' }}>
        <div>
          <h3>Posta Faz 11 — gönderen & bildirimler</h3>
          <p>Panel ayarları `.env` üzerine yazar; boş alanlar env değerini kullanır</p>
        </div>
        <button
          type="button"
          className="btn btn-sm btn-primary"
          disabled={loading || !postaSettings}
          onClick={async () => {
            if (!postaSettings) return;
            setLoading(true);
            setFlash(null);
            try {
              const result = await savePostaMailSettings({
                fromName: postaSettings.fromName,
                replyTo: postaSettings.replyTo,
                opsEmail: postaSettings.opsEmail,
                signatureHtml: postaSettings.signatureHtml,
                notifications: postaSettings.notifications,
              });
              if (result.ok) {
                setPostaSettings(result.settings ?? postaSettings);
                setFlash('Posta ayarları kaydedildi');
                await refresh();
              } else {
                setFlash(result.error ?? 'Kayıt başarısız');
              }
            } finally {
              setLoading(false);
            }
          }}
        >
          Posta ayarlarını kaydet
        </button>
      </div>

      {postaSettings && (
        <div className="settings-form-grid">
          <label className="settings-field">
            <span>Gönderen adı (From)</span>
            <input
              type="text"
              value={postaSettings.fromName ?? ''}
              onChange={(e) =>
                setPostaSettings({ ...postaSettings, fromName: e.target.value || null })
              }
              placeholder="Boş = EKOLOJIK_MAIL_FROM_NAME"
            />
          </label>
          <label className="settings-field">
            <span>Yanıt adresi (Reply-To)</span>
            <input
              type="email"
              value={postaSettings.replyTo ?? ''}
              onChange={(e) =>
                setPostaSettings({ ...postaSettings, replyTo: e.target.value || null })
              }
              placeholder="info@…"
            />
          </label>
          <label className="settings-field">
            <span>Operasyon e-postası</span>
            <input
              type="email"
              value={postaSettings.opsEmail ?? ''}
              onChange={(e) =>
                setPostaSettings({ ...postaSettings, opsEmail: e.target.value || null })
              }
              placeholder="EKOLOJIK_OPS_EMAIL"
            />
          </label>
          <label className="settings-field settings-field--full">
            <span>İmza (HTML)</span>
            <textarea
              rows={4}
              value={postaSettings.signatureHtml}
              onChange={(e) =>
                setPostaSettings({ ...postaSettings, signatureHtml: e.target.value })
              }
              placeholder="<p>Ekolojik Market</p>"
            />
          </label>
          <fieldset className="settings-field settings-field--full">
            <legend>Ops e-posta bildirimleri</legend>
            <label>
              <input
                type="checkbox"
                checked={postaSettings.notifications.contactOpsEmail !== false}
                onChange={(e) =>
                  setPostaSettings({
                    ...postaSettings,
                    notifications: {
                      ...postaSettings.notifications,
                      contactOpsEmail: e.target.checked,
                    },
                  })
                }
              />{' '}
              İletişim formu
            </label>
            <label style={{ marginLeft: '1rem' }}>
              <input
                type="checkbox"
                checked={postaSettings.notifications.messagingOpsEmail !== false}
                onChange={(e) =>
                  setPostaSettings({
                    ...postaSettings,
                    notifications: {
                      ...postaSettings.notifications,
                      messagingOpsEmail: e.target.checked,
                    },
                  })
                }
              />{' '}
              Müşteri mesajları
            </label>
            <label style={{ marginLeft: '1rem' }}>
              <input
                type="checkbox"
                checked={postaSettings.notifications.billEmailOpsEmail !== false}
                onChange={(e) =>
                  setPostaSettings({
                    ...postaSettings,
                    notifications: {
                      ...postaSettings.notifications,
                      billEmailOpsEmail: e.target.checked,
                    },
                  })
                }
              />{' '}
              Fatura e-postası (ileride)
            </label>
          </fieldset>
        </div>
      )}

      <div className="settings-panel-head" style={{ marginTop: '1.25rem' }}>
        <div>
          <h3>Rapor indir (CSV / ZIP)</h3>
          <p>Tarih aralığı opsiyonel — boş bırakırsanız son kayıtlar</p>
        </div>
      </div>
      <div className="settings-form-grid">
        <label className="settings-field">
          <span>Başlangıç (YYYY-MM-DD)</span>
          <input type="date" value={exportFrom} onChange={(e) => setExportFrom(e.target.value)} />
        </label>
        <label className="settings-field">
          <span>Bitiş</span>
          <input type="date" value={exportTo} onChange={(e) => setExportTo(e.target.value)} />
        </label>
      </div>
      <div className="settings-panel-actions">
        <button
          type="button"
          className="btn btn-outline"
          disabled={loading}
          onClick={async () => {
            setLoading(true);
            setFlash(null);
            try {
              await downloadPostaOutboxCsv(exportFrom, exportTo);
              setFlash('Outbox CSV indirildi');
            } catch (e) {
              setFlash(e instanceof Error ? e.message : 'Export hatası');
            } finally {
              setLoading(false);
            }
          }}
        >
          Outbox CSV
        </button>
        <button
          type="button"
          className="btn btn-outline"
          disabled={loading}
          onClick={async () => {
            setLoading(true);
            setFlash(null);
            try {
              await downloadPostaContactCsv(exportFrom, exportTo);
              setFlash('İletişim CSV indirildi');
            } catch (e) {
              setFlash(e instanceof Error ? e.message : 'Export hatası');
            } finally {
              setLoading(false);
            }
          }}
        >
          İletişim CSV
        </button>
        <button
          type="button"
          className="btn btn-outline"
          disabled={loading}
          onClick={async () => {
            setLoading(true);
            setFlash(null);
            try {
              await downloadMessagingExportZip();
              setFlash('Mesajlaşma arşivi indirildi');
            } catch (e) {
              setFlash(e instanceof Error ? e.message : 'Export hatası');
            } finally {
              setLoading(false);
            }
          }}
        >
          Mesaj ZIP (KVKK)
        </button>
      </div>

      {isolation?.checks && isolation.checks.length > 0 && (
        <>
          <div className="settings-panel-head" style={{ marginTop: '1.25rem' }}>
            <div>
              <h3>Faz 5 — ayrım kontrolü</h3>
              <p>Ekolojik VPS / NB karışmıyor mu?</p>
            </div>
          </div>
          <ul className="settings-hint" style={{ listStyle: 'none', padding: 0 }}>
            {isolation.checks.map((c) => (
              <li key={c.id} style={{ marginBottom: 6 }}>
                {c.ok ? '✓' : '○'} {c.label} — <span>{c.detail}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      {retention && (
        <div className="settings-panel-head" style={{ marginTop: '1rem' }}>
          <div>
            <h3>KVKK / saklama (Faz 5)</h3>
            <p>
              Outbox gönderilen: {retention.outboxDays} gün · Mesaj ekleri: {retention.messagingDays} gün · İletişim
              formu: {retention.contactDays} gün
            </p>
          </div>
          <button
            type="button"
            className="btn btn-sm btn-outline"
            disabled={loading}
            onClick={async () => {
              setLoading(true);
              try {
                const r = await runDataRetention();
                setFlash(r.ok ? `Temizlik: ${JSON.stringify(r.removed ?? {})}` : 'Temizlik başarısız');
              } finally {
                setLoading(false);
              }
            }}
          >
            Saklama temizliği çalıştır
          </button>
        </div>
      )}

      <div className="settings-panel-head" style={{ marginTop: '1.25rem' }}>
        <div>
          <h3>Posta Faz 20 — outbox analitik</h3>
          <p>Son {outboxAnalytics?.windowDays ?? 14} gün gönderim / hata oranı</p>
        </div>
      </div>
      {outboxAnalytics?.ok && (
        <div className="settings-stat-grid">
          <article className="settings-stat-card">
            <span className="settings-stat-label">Dönem gönderilen</span>
            <strong>{outboxAnalytics.window?.sent ?? 0}</strong>
          </article>
          <article className="settings-stat-card">
            <span className="settings-stat-label">Dönem hatalı</span>
            <strong className={(outboxAnalytics.window?.failed ?? 0) > 0 ? 'is-warn' : ''}>
              {outboxAnalytics.window?.failed ?? 0}
            </strong>
          </article>
          <article className="settings-stat-card">
            <span className="settings-stat-label">Başarı oranı</span>
            <strong>
              {outboxAnalytics.window?.successRatePercent != null
                ? `${outboxAnalytics.window.successRatePercent}%`
                : '—'}
            </strong>
          </article>
          <article className="settings-stat-card">
            <span className="settings-stat-label">Açılma pikseli</span>
            <strong>{outboxAnalytics.mailTrackEnabled ? 'Açık' : 'Kapalı'}</strong>
          </article>
        </div>
      )}
      <p className="settings-hint">
        İsteğe bağlı: <code>EKOLOJIK_MAIL_TRACK=1</code> (giden HTML), <code>EKOLOJIK_POSTA_AI=1</code> (compose
        öneri)
      </p>

      <div className="settings-panel-head" style={{ marginTop: '1rem' }}>
        <div>
          <h3>Posta kuralları (Fatura yönlendirme)</h3>
          <p>Konu/from eşleşmesi → Fatura klasörü; IMAP sync sonrası uygulanır</p>
        </div>
        <button
          type="button"
          className="btn btn-sm btn-primary"
          disabled={loading || !postaRules.length}
          onClick={async () => {
            setLoading(true);
            try {
              const result = await savePostaInboxRules(postaRules);
              if (result.ok) {
                setPostaRules(result.rules ?? postaRules);
                setFlash('Posta kuralları kaydedildi');
              } else {
                setFlash(result.error ?? 'Kural kaydı başarısız');
              }
            } finally {
              setLoading(false);
            }
          }}
        >
          Kuralları kaydet
        </button>
      </div>
      {postaRules.length > 0 && (
        <ul className="settings-hint" style={{ listStyle: 'none', padding: 0 }}>
          {postaRules.map((rule) => (
            <li key={rule.id} style={{ marginBottom: 12, borderBottom: '1px solid var(--border-subtle)', paddingBottom: 8 }}>
              <label>
                <input
                  type="checkbox"
                  checked={rule.enabled}
                  onChange={(e) =>
                    setPostaRules((prev) =>
                      prev.map((r) => (r.id === rule.id ? { ...r, enabled: e.target.checked } : r)),
                    )
                  }
                />{' '}
                <strong>{rule.name}</strong>
              </label>
              <div className="settings-form-grid" style={{ marginTop: 6 }}>
                <label className="settings-field settings-field--full">
                  <span>Konu içerir (| ile ayır)</span>
                  <input
                    value={rule.subjectContains}
                    onChange={(e) =>
                      setPostaRules((prev) =>
                        prev.map((r) => (r.id === rule.id ? { ...r, subjectContains: e.target.value } : r)),
                      )
                    }
                  />
                </label>
                <label className="settings-field settings-field--full">
                  <span>Gönderen içerir</span>
                  <input
                    value={rule.fromContains}
                    onChange={(e) =>
                      setPostaRules((prev) =>
                        prev.map((r) => (r.id === rule.id ? { ...r, fromContains: e.target.value } : r)),
                      )
                    }
                  />
                </label>
              </div>
              <p className="settings-hint">
                Fatura klasörü: {rule.routeToFatura ? 'evet' : 'hayır'}
                {rule.label ? ` · etiket: ${rule.label}` : ''}
              </p>
            </li>
          ))}
        </ul>
      )}

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
