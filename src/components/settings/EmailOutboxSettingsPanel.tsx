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
  fetchPostaDeliverability,
  fetchPostaNotificationsMatrix,
  fetchPostaEngagementSummary,
  fetchPostaLiveMetrics,
  fetchPostaOutboxAnalytics,
  downloadPostaEngagementCsv,
  fetchPostaRules,
  savePostaInboxRules,
  type PostaDeliverabilityHub,
  type PostaInboxRule,
  type PostaMailSettings,
  type PostaNotificationMatrix,
  type PostaNotificationMatrixHub,
  type PostaEngagementSummary,
  type PostaLiveMetrics,
  type PostaOutboxAnalytics,
} from '../../services/postaSettingsService';
import {
  fetchPostaOnboardingHub,
  reopenPostaOnboarding,
  seedPostaOnboardingAliasRules,
} from '../../services/postaOnboardingService';
import { signalPostaOnboardingOpen } from '../../storage/postaOnboardingSession';
import {
  fetchTenantMailConfig,
  saveTenantMailConfig,
  type TenantMailConfigHub,
} from '../../services/postaTenantMailService';
import {
  archiveFailedOutbox,
  fetchFailedOutboxList,
  requeueFailedOutbox,
  type FailedOutboxRow,
} from '../../services/postaOutboxOpsService';

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
  const [engagementSummary, setEngagementSummary] = useState<PostaEngagementSummary | null>(null);
  const [postaRules, setPostaRules] = useState<PostaInboxRule[]>([]);
  const [deliverability, setDeliverability] = useState<PostaDeliverabilityHub | null>(null);
  const [notifyMatrixHub, setNotifyMatrixHub] = useState<PostaNotificationMatrixHub | null>(null);
  const [liveMetrics, setLiveMetrics] = useState<PostaLiveMetrics | null>(null);
  const [onboardingStatus, setOnboardingStatus] = useState<string | null>(null);
  const [tenantMail, setTenantMail] = useState<TenantMailConfigHub | null>(null);
  const [tenantImapHost, setTenantImapHost] = useState('');
  const [tenantImapUser, setTenantImapUser] = useState('');
  const [tenantImapPass, setTenantImapPass] = useState('');
  const [tenantSmtpHost, setTenantSmtpHost] = useState('');
  const [tenantSmtpUser, setTenantSmtpUser] = useState('');
  const [tenantSmtpPass, setTenantSmtpPass] = useState('');
  const [tenantSmtpFrom, setTenantSmtpFrom] = useState('');
  const [tenantUsePlatformEnv, setTenantUsePlatformEnv] = useState(true);
  const [failedRows, setFailedRows] = useState<FailedOutboxRow[]>([]);
  const [selectedFailedIds, setSelectedFailedIds] = useState<Set<string>>(() => new Set());

  const refresh = useCallback(async () => {
    const [h, recent, iso, ret, posta, analytics, engagement, live, rules, deliv, notifyHub, onboardingHub, tenantMailHub, failedHub] =
      await Promise.all([
      fetchEmailHealth(),
      fetchRecentOutbox(50),
      fetchEkolojikIsolationReport(),
      fetchRetentionPolicy(),
      fetchPostaMailSettings(),
      fetchPostaOutboxAnalytics(14),
      fetchPostaEngagementSummary(14),
      fetchPostaLiveMetrics(7),
      fetchPostaRules(),
      fetchPostaDeliverability(),
      fetchPostaNotificationsMatrix(),
      fetchPostaOnboardingHub(),
      fetchTenantMailConfig(),
      fetchFailedOutboxList(120),
    ]);
    setHealth(h);
    setIsolation(iso);
    if (ret.ok && ret.policy) setRetention(ret.policy);
    if (posta.ok && posta.settings) {
      setPostaSettings({
        ...posta.settings,
        notificationMatrix:
          posta.settings.notificationMatrix ?? (notifyHub.ok ? notifyHub.matrix : undefined),
      });
    }
    if (analytics.ok) setOutboxAnalytics(analytics);
    if (engagement.ok) setEngagementSummary(engagement);
    if (live.ok) setLiveMetrics(live);
    if (rules.ok && rules.rules) setPostaRules(rules.rules);
    if (deliv.ok) setDeliverability(deliv);
    setOnboardingStatus(onboardingHub?.onboarding?.status ?? null);
    if (tenantMailHub?.ok) {
      setTenantMail(tenantMailHub);
      setTenantUsePlatformEnv(tenantMailHub.usePlatformEnv);
      setTenantImapHost(tenantMailHub.imap.host ?? '');
      setTenantImapUser(tenantMailHub.imap.user ?? '');
      setTenantImapPass('');
      setTenantSmtpHost(tenantMailHub.smtp.host ?? '');
      setTenantSmtpUser(tenantMailHub.smtp.user ?? '');
      setTenantSmtpPass('');
      setTenantSmtpFrom(tenantMailHub.smtp.from ?? '');
    }
    if (notifyHub.ok) setNotifyMatrixHub(notifyHub);
    if (recent.ok && Array.isArray(recent.items)) {
      setOutboxRows(recent.items as OutboxRow[]);
    }
    if (failedHub.ok && Array.isArray(failedHub.items)) {
      setFailedRows(failedHub.items);
      setSelectedFailedIds(new Set());
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

  const toggleFailedSelect = (id: string) => {
    setSelectedFailedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const runFailedRequeue = async (all = false) => {
    setLoading(true);
    setFlash(null);
    try {
      const ids = all ? undefined : [...selectedFailedIds];
      const result = await requeueFailedOutbox({ ids, all });
      if (result.ok) {
        setFlash(`Yeniden kuyruk: ${result.requeued ?? 0} kayıt${result.errors?.length ? ` (${result.errors.length} hata)` : ''}`);
      } else {
        setFlash(result.error ?? 'Requeue başarısız');
      }
      await refresh();
    } finally {
      setLoading(false);
    }
  };

  const runFailedArchive = async () => {
    if (!selectedFailedIds.size) {
      setFlash('Arşiv için satır seçin');
      return;
    }
    setLoading(true);
    try {
      const result = await archiveFailedOutbox({ ids: [...selectedFailedIds] });
      setFlash(result.ok ? `${result.archived ?? 0} kayıt arşivlendi` : result.error ?? 'Arşiv başarısız');
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

      <article className="settings-subpanel" style={{ marginBottom: 16 }}>
        <h3>Mağaza posta kutusu (Faz 6)</h3>
        <p className="settings-hint">
          Varsayılan: sunucu <code>.env</code> (EKOLOJIK_SMTP_* / EKOLOJIK_IMAP_*). İşaret kaldırılırsa mağaza özel SMTP+IMAP kullanılır.
        </p>
        <label className="settings-hint" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={tenantUsePlatformEnv}
            onChange={(e) => setTenantUsePlatformEnv(e.target.checked)}
          />
          Platform .env kullan (paylaşımlı işletme kutusu)
        </label>
        {!tenantUsePlatformEnv && (
          <div style={{ display: 'grid', gap: 8, marginTop: 8, maxWidth: 480 }}>
            <input placeholder="IMAP host" value={tenantImapHost} onChange={(e) => setTenantImapHost(e.target.value)} />
            <input placeholder="IMAP kullanıcı" value={tenantImapUser} onChange={(e) => setTenantImapUser(e.target.value)} />
            <input
              type="password"
              placeholder="IMAP şifre (boş = değişmez)"
              value={tenantImapPass}
              onChange={(e) => setTenantImapPass(e.target.value)}
            />
            <strong style={{ fontSize: '0.85rem' }}>Giden (SMTP)</strong>
            <input placeholder="SMTP host" value={tenantSmtpHost} onChange={(e) => setTenantSmtpHost(e.target.value)} />
            <input placeholder="SMTP kullanıcı" value={tenantSmtpUser} onChange={(e) => setTenantSmtpUser(e.target.value)} />
            <input
              type="password"
              placeholder="SMTP şifre (boş = değişmez)"
              value={tenantSmtpPass}
              onChange={(e) => setTenantSmtpPass(e.target.value)}
            />
            <input placeholder="Gönderen From (e-posta)" value={tenantSmtpFrom} onChange={(e) => setTenantSmtpFrom(e.target.value)} />
          </div>
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={loading}
            onClick={async () => {
              setLoading(true);
              const saved = await saveTenantMailConfig({
                usePlatformEnv: tenantUsePlatformEnv,
                imap: {
                  host: tenantImapHost.trim(),
                  user: tenantImapUser.trim(),
                  pass: tenantImapPass.trim() || undefined,
                },
                smtp: {
                  host: tenantSmtpHost.trim(),
                  user: tenantSmtpUser.trim(),
                  pass: tenantSmtpPass.trim() || undefined,
                  from: tenantSmtpFrom.trim(),
                },
              });
              setLoading(false);
              if (!saved) {
                setFlash('Mağaza posta ayarı kaydedilemedi.');
                return;
              }
              setTenantMail(saved);
              setFlash('Mağaza SMTP/IMAP ayarı kaydedildi.');
              await refresh();
            }}
          >
            Mağaza posta kaydet
          </button>
        </div>
        {tenantMail?.effective && (
          <p className="settings-hint">
            Etkin SMTP: {tenantMail.effective.smtpConfigured ? tenantMail.effective.smtpFrom || '—' : 'yok'} · IMAP:{' '}
            {tenantMail.effective.imapConfigured ? tenantMail.effective.imapUser || '—' : 'yok'}
          </p>
        )}
      </article>

      <article className="settings-subpanel" style={{ marginBottom: 16 }}>
        <h3>Posta kurulum sihirbazı</h3>
        <p className="settings-hint">
          Kayıt sonrası 3 adım (e-posta testi, mesajlaşma anahtarı, Posta sekmesi). Durum:{' '}
          <strong>{onboardingStatus ?? '—'}</strong>
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={loading}
            onClick={async () => {
              setLoading(true);
              const result = await reopenPostaOnboarding();
              setLoading(false);
              if (!result.ok) {
                setFlash('Kurulum yeniden açılamadı.');
                return;
              }
              signalPostaOnboardingOpen();
              setOnboardingStatus(result.onboarding?.status ?? 'in_progress');
              setFlash('Kurulum sihirbazı açıldı.');
            }}
          >
            Kurulumu yeniden aç
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={loading}
            onClick={async () => {
              setLoading(true);
              const result = await seedPostaOnboardingAliasRules();
              setLoading(false);
              setFlash(
                result.ok
                  ? result.added?.length
                    ? `${result.added.length} alias kuralı eklendi.`
                    : 'Alias kuralları zaten tanımlı.'
                  : 'Kurallar eklenemedi.',
              );
              await refresh();
            }}
          >
            siparis@ / fatura@ kuralları
          </button>
        </div>
        <p className="settings-hint">
          Rehber: <code>docs/EKOLOJIK-POSTA-ONBOARDING-OPERATOR.md</code> (VPS env:{' '}
          <code>EKOLOJIK_MAIL_ALIASES</code>, <code>EKOLOJIK_MESSAGING_PUBLIC_KEY</code>)
        </p>
      </article>

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

      {deliverability?.ok && (
        <>
          <div className="settings-panel-head" style={{ marginTop: '1rem' }}>
            <div>
              <h3>NB PM-3 — Gönderen & DNS (deliverability)</h3>
              <p>
                Alan: <strong>{deliverability.domain}</strong> · Gönderen: {deliverability.primaryFrom}
                {deliverability.aliases?.length ? ` · +${deliverability.aliases.length} alias` : ''}
              </p>
            </div>
          </div>
          <div className="settings-stat-grid">
            <article className="settings-stat-card">
              <span className="settings-stat-label">SPF</span>
              <strong className={deliverability.dns?.spf.status === 'ok' ? 'is-ok' : ''}>
                {deliverability.dns?.spf.status ?? '—'}
              </strong>
            </article>
            <article className="settings-stat-card">
              <span className="settings-stat-label">DMARC</span>
              <strong className={deliverability.dns?.dmarc.status === 'ok' ? 'is-ok' : ''}>
                {deliverability.dns?.dmarc.status ?? '—'}
              </strong>
            </article>
            <article className="settings-stat-card">
              <span className="settings-stat-label">DKIM</span>
              <strong className={deliverability.dns?.dkim.status === 'ok' ? 'is-ok' : ''}>
                {deliverability.dns?.dkim.status ?? '—'}
              </strong>
            </article>
            <article className="settings-stat-card">
              <span className="settings-stat-label">SMTP doğrulama</span>
              <strong className={deliverability.smtp?.verified ? 'is-ok' : ''}>
                {deliverability.smtp?.verified ? 'Hazır' : 'Eksik'}
              </strong>
            </article>
          </div>
          {deliverability.suggestedRecords && (
            <ul className="settings-hint" style={{ listStyle: 'none', padding: 0 }}>
              <li>
                <code>SPF</code> {deliverability.suggestedRecords.spf}
              </li>
              <li>
                <code>DMARC</code> {deliverability.suggestedRecords.dmarc}
              </li>
              <li>{deliverability.suggestedRecords.dkimHint}</li>
            </ul>
          )}
          <p className="settings-hint">
            İsteğe bağlı alias: <code>EKOLOJIK_MAIL_ALIASES</code> (virgülle ayrılmış e-postalar)
          </p>
        </>
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
                notificationMatrix: postaSettings.notificationMatrix,
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
          <div className="settings-field settings-field--full">
            <h4 style={{ margin: '0 0 0.5rem' }}>NB PM-8 — bildirim matrisi (olay × kanal)</h4>
            <p className="settings-hint">
              Operasyon e-posta, hub uyarı günlüğü ve iletişim otomatik yanıtı buradan yönetilir.{' '}
              <code>EKOLOJIK_CONTACT_AUTOREPLY=1</code> env ile birlikte çalışır.
            </p>
            {notifyMatrixHub?.catalog && postaSettings.notificationMatrix && (
              <table className="settings-table" style={{ width: '100%', marginTop: '0.5rem' }}>
                <thead>
                  <tr>
                    <th>Olay</th>
                    {notifyMatrixHub.catalog.channels.map((ch) => (
                      <th key={ch.id}>{ch.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {notifyMatrixHub.catalog.events.map((ev) => (
                    <tr key={ev.id}>
                      <td>{ev.label}</td>
                      {notifyMatrixHub.catalog!.channels.map((ch) => {
                        const allowed = !ch.eventIds || ch.eventIds.includes(ev.id);
                        const checked =
                          postaSettings.notificationMatrix?.[ev.id]?.[ch.id] !== false && allowed;
                        return (
                          <td key={ch.id}>
                            {allowed ? (
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  const matrix: PostaNotificationMatrix = {
                                    ...(postaSettings.notificationMatrix ?? notifyMatrixHub.matrix ?? {}),
                                  } as PostaNotificationMatrix;
                                  const row = { ...(matrix[ev.id] ?? {}) };
                                  row[ch.id] = e.target.checked;
                                  matrix[ev.id] = row;
                                  setPostaSettings({
                                    ...postaSettings,
                                    notificationMatrix: matrix,
                                    notifications: {
                                      ...postaSettings.notifications,
                                      ...(ev.id === 'contact'
                                        ? { contactOpsEmail: row.opsEmail !== false }
                                        : {}),
                                      ...(ev.id === 'messaging'
                                        ? { messagingOpsEmail: row.opsEmail !== false }
                                        : {}),
                                      ...(ev.id === 'bill'
                                        ? { billEmailOpsEmail: row.opsEmail !== false }
                                        : {}),
                                    },
                                  });
                                }}
                              />
                            ) : (
                              <span className="settings-hint">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
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
          <article className="settings-stat-card">
            <span className="settings-stat-label">Failed uyarı eşiği</span>
            <strong>{outboxAnalytics.failedAlertThreshold ?? 50}</strong>
          </article>
        </div>
      )}
      {outboxAnalytics?.failureBreakdown?.length ? (
        <ul className="settings-hint" style={{ marginTop: '0.5rem' }}>
          {outboxAnalytics.failureBreakdown.map((row) => (
            <li key={row.id}>
              {row.label}: <strong>{row.count}</strong>
              {row.sample ? ` — ${row.sample.slice(0, 80)}` : ''}
            </li>
          ))}
        </ul>
      ) : null}
      <p className="settings-hint">
        İsteğe bağlı: <code>EKOLOJIK_MAIL_TRACK=1</code> (açılma + tıklama),{' '}
        <code>EKOLOJIK_MAIL_CLICK_TRACK=1</code> (yalnızca tıklama),{' '}
        <code>EKOLOJIK_POSTA_ENGAGEMENT_WEBHOOK</code> (JSON webhook), <code>EKOLOJIK_PUSH_VAPID_*</code> (PWA
        push), <code>EKOLOJIK_POSTA_AI=1</code>
      </p>

      <div className="settings-panel-head" style={{ marginTop: '1rem' }}>
        <div>
          <h3>NB PM-6 — canlılık (SSE + gecikme metrik)</h3>
          <p>
            Heartbeat {liveMetrics?.sse?.heartbeatMs ? liveMetrics.sse.heartbeatMs / 1000 : 25}s · SSE istemci{' '}
            {liveMetrics?.sse?.connectedClients ?? 0}
          </p>
        </div>
      </div>
      {liveMetrics?.ok && (
        <div className="settings-stat-grid">
          <article className="settings-stat-card">
            <span className="settings-stat-label">Ortalama gecikme</span>
            <strong>
              {liveMetrics.deliveryLatency?.avgMs != null ? `${liveMetrics.deliveryLatency.avgMs} ms` : '—'}
            </strong>
            <span className="settings-hint">mesaj zamanı → sunucu bildirimi</span>
          </article>
          <article className="settings-stat-card">
            <span className="settings-stat-label">p50 / p95</span>
            <strong>
              {liveMetrics.deliveryLatency?.p50Ms != null ? liveMetrics.deliveryLatency.p50Ms : '—'} /{' '}
              {liveMetrics.deliveryLatency?.p95Ms != null ? liveMetrics.deliveryLatency.p95Ms : '—'} ms
            </strong>
          </article>
          <article className="settings-stat-card">
            <span className="settings-stat-label">Örnek sayısı</span>
            <strong>{liveMetrics.deliveryLatency?.sampleCount ?? 0}</strong>
            <span className="settings-hint">son {liveMetrics.windowDays ?? 7} gün</span>
          </article>
          <article className="settings-stat-card">
            <span className="settings-stat-label">SSE revizyon</span>
            <strong>{liveMetrics.sse?.revision ?? 0}</strong>
          </article>
        </div>
      )}

      <div className="settings-panel-head" style={{ marginTop: '1rem' }}>
        <div>
          <h3>NB PM-10 — engagement (açılma / tıklama / bounce)</h3>
          <p>Son {engagementSummary?.windowDays ?? 14} gün</p>
        </div>
      </div>
      {engagementSummary?.ok && (
        <div className="settings-stat-grid">
          <article className="settings-stat-card">
            <span className="settings-stat-label">Açılma</span>
            <strong>{engagementSummary.counts?.opens ?? 0}</strong>
            <span className="settings-hint">benzersiz {engagementSummary.counts?.uniqueOpens ?? 0}</span>
          </article>
          <article className="settings-stat-card">
            <span className="settings-stat-label">Tıklama</span>
            <strong>{engagementSummary.counts?.clicks ?? 0}</strong>
            <span className="settings-hint">benzersiz {engagementSummary.counts?.uniqueClicks ?? 0}</span>
          </article>
          <article className="settings-stat-card">
            <span className="settings-stat-label">Bounce / kalıcı hata</span>
            <strong className={(engagementSummary.counts?.bounces ?? 0) > 0 ? 'is-warn' : ''}>
              {engagementSummary.counts?.bounces ?? 0}
            </strong>
          </article>
          <article className="settings-stat-card">
            <span className="settings-stat-label">Webhook</span>
            <strong>{engagementSummary.webhookConfigured ? 'Tanımlı' : 'Kapalı'}</strong>
          </article>
        </div>
      )}
      <div className="settings-panel-actions">
        <button
          type="button"
          className="btn btn-outline btn-sm"
          disabled={loading}
          onClick={() => downloadPostaEngagementCsv('combined', 90)}
        >
          Engagement CSV (hepsi)
        </button>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          disabled={loading}
          onClick={() => downloadPostaEngagementCsv('bounces', 90)}
        >
          Bounce CSV
        </button>
      </div>

      <div className="settings-panel-head" style={{ marginTop: '1rem' }}>
        <div>
          <h3>NB PM-9 — posta kuralları (OR grupları + ek boyutu)</h3>
          <p>matchGroups: gruplar arası OR, grup içi konu+gönderen AND; IMAP sync sonrası uygulanır</p>
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
              {(rule.matchGroups?.length
                ? rule.matchGroups
                : [{ subjectContains: rule.subjectContains, fromContains: rule.fromContains }]
              ).map((group, groupIndex) => (
                <div key={`${rule.id}-g-${groupIndex}`} className="settings-form-grid" style={{ marginTop: 6 }}>
                  <p className="settings-hint settings-field--full">
                    OR grubu {groupIndex + 1}
                    {(rule.matchGroups?.length ?? 1) > 1 && (
                      <button
                        type="button"
                        className="btn btn-sm btn-outline"
                        style={{ marginLeft: 8 }}
                        onClick={() =>
                          setPostaRules((prev) =>
                            prev.map((r) => {
                              if (r.id !== rule.id) return r;
                              const groups = [...(r.matchGroups ?? [{ subjectContains: r.subjectContains, fromContains: r.fromContains }])];
                              groups.splice(groupIndex, 1);
                              const first = groups[0] ?? { subjectContains: '', fromContains: '' };
                              return {
                                ...r,
                                matchGroups: groups,
                                subjectContains: first.subjectContains,
                                fromContains: first.fromContains,
                              };
                            }),
                          )
                        }
                      >
                        Grubu sil
                      </button>
                    )}
                  </p>
                  <label className="settings-field settings-field--full">
                    <span>Konu içerir (| ile ayır)</span>
                    <input
                      value={group.subjectContains}
                      onChange={(e) =>
                        setPostaRules((prev) =>
                          prev.map((r) => {
                            if (r.id !== rule.id) return r;
                            const groups = [...(r.matchGroups ?? [{ subjectContains: r.subjectContains, fromContains: r.fromContains }])];
                            groups[groupIndex] = { ...groups[groupIndex], subjectContains: e.target.value };
                            const first = groups[0] ?? { subjectContains: '', fromContains: '' };
                            return {
                              ...r,
                              matchGroups: groups,
                              subjectContains: first.subjectContains,
                              fromContains: first.fromContains,
                            };
                          }),
                        )
                      }
                    />
                  </label>
                  <label className="settings-field settings-field--full">
                    <span>Gönderen içerir (| ile ayır)</span>
                    <input
                      value={group.fromContains}
                      onChange={(e) =>
                        setPostaRules((prev) =>
                          prev.map((r) => {
                            if (r.id !== rule.id) return r;
                            const groups = [...(r.matchGroups ?? [{ subjectContains: r.subjectContains, fromContains: r.fromContains }])];
                            groups[groupIndex] = { ...groups[groupIndex], fromContains: e.target.value };
                            const first = groups[0] ?? { subjectContains: '', fromContains: '' };
                            return {
                              ...r,
                              matchGroups: groups,
                              subjectContains: first.subjectContains,
                              fromContains: first.fromContains,
                            };
                          }),
                        )
                      }
                    />
                  </label>
                </div>
              ))}
              <button
                type="button"
                className="btn btn-sm btn-outline"
                onClick={() =>
                  setPostaRules((prev) =>
                    prev.map((r) =>
                      r.id === rule.id
                        ? {
                            ...r,
                            matchGroups: [
                              ...(r.matchGroups ?? [{ subjectContains: r.subjectContains, fromContains: r.fromContains }]),
                              { subjectContains: '', fromContains: '' },
                            ],
                          }
                        : r,
                    ),
                  )
                }
              >
                OR koşulu ekle
              </button>
              <div className="settings-form-grid" style={{ marginTop: 8 }}>
                <label className="settings-field">
                  <span>Min ek boyutu (bayt, 0=kapalı)</span>
                  <input
                    type="number"
                    min={0}
                    value={rule.minAttachmentBytes ?? 0}
                    onChange={(e) =>
                      setPostaRules((prev) =>
                        prev.map((r) =>
                          r.id === rule.id ? { ...r, minAttachmentBytes: Number(e.target.value) || 0 } : r,
                        ),
                      )
                    }
                  />
                </label>
                <label className="settings-field">
                  <span>Max ek boyutu (boş=sınırsız)</span>
                  <input
                    type="number"
                    min={0}
                    value={rule.maxAttachmentBytes ?? ''}
                    onChange={(e) =>
                      setPostaRules((prev) =>
                        prev.map((r) =>
                          r.id === rule.id
                            ? {
                                ...r,
                                maxAttachmentBytes: e.target.value === '' ? null : Number(e.target.value) || 0,
                              }
                            : r,
                        ),
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
          <h3>Başarısız gönderimler (Faz 39)</h3>
          <p>
            Toplam failed (sunucu): <strong className={(health?.counts?.failed ?? 0) > 0 ? 'is-warn' : ''}>
              {health?.counts?.failed ?? 0}
            </strong>
            · listede {failedRows.length}
          </p>
        </div>
        <div className="settings-panel-actions">
          <button type="button" className="btn btn-sm btn-outline" disabled={loading || !selectedFailedIds.size} onClick={() => void runFailedRequeue(false)}>
            Seçilenleri yeniden dene
          </button>
          <button type="button" className="btn btn-sm btn-outline" disabled={loading || !failedRows.length} onClick={() => void runFailedRequeue(true)}>
            Tümünü yeniden dene
          </button>
          <button type="button" className="btn btn-sm btn-outline" disabled={loading || !selectedFailedIds.size} onClick={() => void runFailedArchive()}>
            Seçilenleri arşivle
          </button>
        </div>
      </div>
      <div className="module-table-wrap" style={{ overflowX: 'auto', marginBottom: '1.25rem' }}>
        <table className="module-table module-table--wide">
          <thead>
            <tr>
              <th />
              <th>Tarih</th>
              <th>Alıcı</th>
              <th>Konu</th>
              <th>Sınıf</th>
              <th>Hata</th>
            </tr>
          </thead>
          <tbody>
            {failedRows.length === 0 ? (
              <tr>
                <td colSpan={6}>Başarısız kayıt yok</td>
              </tr>
            ) : (
              failedRows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedFailedIds.has(row.id)}
                      onChange={() => toggleFailedSelect(row.id)}
                      aria-label={`Seç ${row.id}`}
                    />
                  </td>
                  <td>{formatWhen(row)}</td>
                  <td>{row.to}</td>
                  <td>{row.subject}</td>
                  <td>{row.errorClass ?? '—'}</td>
                  <td title={row.lastError ?? undefined}>{(row.lastError ?? '—').slice(0, 72)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
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
