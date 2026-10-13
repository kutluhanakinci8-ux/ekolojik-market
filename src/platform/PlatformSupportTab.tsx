import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  downloadPlatformSupportCsv,
  fetchPlatformSupportInbox,
  fetchPlatformSupportOverview,
  replyPlatformSupportInbox,
  savePlatformSupportSlaPolicy,
  syncPlatformSupportInbox,
  type PlatformSupportInboxMessage,
  type PlatformSupportPayload,
  type PlatformSupportSlaPolicy,
} from '../services/platformApi';
import { KpiIcon, PlatformFilterSelect, RingProgress } from './platformUserUi';

const KIND_LABELS: Record<string, string> = {
  first_response: 'İlk yanıt bekliyor',
  stale_waiting: 'Beklemede (eski)',
};

const SEV_LABELS: Record<string, string> = {
  critical: 'Kritik',
  warning: 'Uyarı',
  info: 'Normal',
};

function formatDurationMs(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms)) return '—';
  if (ms < 60_000) return `${Math.round(ms / 1000)} sn`;
  if (ms < 3600_000) return `${Math.round(ms / 60_000)} dk`;
  return `${(ms / 3600_000).toFixed(1)} sa`;
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

function SupportSkeleton() {
  return (
    <div className="platform-support platform-support--loading" aria-busy="true">
      <div className="platform-users-skeleton-hero" />
      <div className="platform-users-skeleton-kpis" />
      <div className="platform-users-skeleton-block" />
    </div>
  );
}

export function PlatformSupportTab() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PlatformSupportPayload | null>(null);
  const [windowDays, setWindowDays] = useState(14);
  const [exporting, setExporting] = useState(false);
  const [policyDraft, setPolicyDraft] = useState<PlatformSupportSlaPolicy | null>(null);
  const [policyMsg, setPolicyMsg] = useState<string | null>(null);
  const [queueFilter, setQueueFilter] = useState<'all' | 'first_response' | 'stale_waiting'>('all');
  const [section, setSection] = useState<'inbox' | 'queue'>('inbox');
  const [inboxMessages, setInboxMessages] = useState<PlatformSupportInboxMessage[]>([]);
  const [inboxUnread, setInboxUnread] = useState(0);
  const [mailboxConfigured, setMailboxConfigured] = useState(false);
  const [mailboxAddress, setMailboxAddress] = useState<string | null>(null);
  const [selectedMailId, setSelectedMailId] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState('');
  const [inboxSyncing, setInboxSyncing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await fetchPlatformSupportOverview(windowDays);
    if (!result.ok || !result.data) {
      setError(result.error ?? 'Veri yüklenemedi');
      setLoading(false);
      return;
    }
    setData(result.data);
    setInboxUnread(result.data.inbox?.unread ?? 0);
    setMailboxConfigured(result.data.capabilities.supportMailboxConfigured === true);
    setMailboxAddress(result.data.capabilities.supportMailboxAddress ?? null);
    const inboxRes = await fetchPlatformSupportInbox();
    if (inboxRes.ok && inboxRes.data) {
      setInboxMessages(inboxRes.data.messages);
      setInboxUnread(inboxRes.data.unread);
      setMailboxConfigured(inboxRes.data.mailbox.configured);
      setMailboxAddress(inboxRes.data.mailbox.address);
    }
    setPolicyDraft({
      firstResponseTargetMinutes: result.data.policy.firstResponseTargetMinutes,
      staleWaitingHours: result.data.policy.staleWaitingHours,
    });
    setLoading(false);
  }, [windowDays]);

  useEffect(() => {
    void load();
  }, [load]);

  const compliancePct = data?.totals.compliancePercent ?? 0;
  const complianceVariant = compliancePct >= 85 ? 'brand' : compliancePct >= 60 ? 'warn' : 'muted';

  const filteredQueue = useMemo(() => {
    if (!data) return [];
    if (queueFilter === 'all') return data.queue;
    return data.queue.filter((q) => q.kind === queueFilter);
  }, [data, queueFilter]);

  const savePolicy = async () => {
    if (!policyDraft) return;
    setPolicyMsg(null);
    const result = await savePlatformSupportSlaPolicy(policyDraft);
    if (!result.ok) {
      setPolicyMsg(result.error ?? 'Kaydedilemedi');
      return;
    }
    setPolicyMsg('SLA eşikleri kaydedildi');
    void load();
  };

  const selectedMail = inboxMessages.find((m) => m.id === selectedMailId) ?? null;

  const onInboxSync = async () => {
    setInboxSyncing(true);
    setPolicyMsg(null);
    const result = await syncPlatformSupportInbox();
    setInboxSyncing(false);
    if (!result.ok) {
      setPolicyMsg(result.error ?? 'Senkron başarısız');
      return;
    }
    setPolicyMsg(result.message ?? 'Gelen kutusu güncellendi');
    void load();
  };

  const onReply = async () => {
    if (!selectedMailId || !replyDraft.trim()) return;
    const result = await replyPlatformSupportInbox(selectedMailId, replyDraft.trim());
    if (!result.ok) {
      setPolicyMsg(result.error ?? 'Yanıt gönderilemedi');
      return;
    }
    setReplyDraft('');
    setPolicyMsg('Yanıt destek@ üzerinden gönderildi');
    void load();
  };

  const onExport = async () => {
    setExporting(true);
    const result = await downloadPlatformSupportCsv(windowDays);
    setExporting(false);
    if (!result.ok) setPolicyMsg(result.error ?? 'CSV indirilemedi');
  };

  if (loading && !data) return <SupportSkeleton />;
  if (error && !data) {
    return (
      <div className="platform-support platform-panel">
        <p className="platform-error">{error}</p>
        <button type="button" className="btn btn-primary" onClick={() => void load()}>
          Yeniden dene
        </button>
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="platform-support">
      <section className="platform-users-hero platform-support-hero">
        <div>
          <h2>Destek komuta merkezi</h2>
          <p>
            <strong>{mailboxAddress ?? 'destek@ekolojikmarket.com.tr'}</strong> gelen kutusu, otomatik “talebiniz alındı” (destek@) ve üretim mesaj kuyruğu. QA/smoke kayıtları gizlenir.
          </p>
          {!data.capabilities.messagingPublicConfigured ? (
            <p className="platform-support-hint">Genel mesajlaşma API yapılandırması eksik olabilir; kuyruk yine kiracı verisinden okunur.</p>
          ) : null}
        </div>
        <div className="platform-support-hero-actions">
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
          <button type="button" className="btn btn-text" onClick={() => void load()} disabled={loading}>
            Yenile
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => void onExport()} disabled={exporting}>
            {exporting ? 'İndiriliyor…' : 'CSV'}
          </button>
        </div>
      </section>

      <nav className="platform-support-subnav" aria-label="Destek görünümü">
        <button
          type="button"
          className={`platform-support-subnav-btn ${section === 'inbox' ? 'platform-support-subnav-btn--active' : ''}`}
          onClick={() => setSection('inbox')}
        >
          Gelen kutusu {inboxUnread > 0 ? `(${inboxUnread})` : ''}
        </button>
        <button
          type="button"
          className={`platform-support-subnav-btn ${section === 'queue' ? 'platform-support-subnav-btn--active' : ''}`}
          onClick={() => setSection('queue')}
        >
          Mesaj kuyruğu & SLA
        </button>
      </nav>

      {section === 'inbox' ? (
        <div className="platform-support-inbox-layout">
          <section className="platform-panel platform-support-inbox-list">
            <div className="platform-panel-head">
              <h3>destek@ gelen</h3>
              <button type="button" className="btn btn-secondary" onClick={() => void onInboxSync()} disabled={inboxSyncing}>
                {inboxSyncing ? 'Senkron…' : 'IMAP senkron'}
              </button>
            </div>
            {!mailboxConfigured ? (
              <p className="platform-support-hint">
                Ayrı posta kutusu için VPS’te <code>destek@</code> ve <code>EKOLOJIK_SUPPORT_IMAP_*</code> env tanımlayın. Kurulum:{' '}
                <code>scripts/sunucu-ekolojik-destek-mailbox.sh</code>
              </p>
            ) : null}
            <ul className="platform-support-inbox-items">
              {inboxMessages.length === 0 ? (
                <li className="platform-support-inbox-empty">Henüz kayıt yok — senkron deneyin.</li>
              ) : (
                inboxMessages.map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      className={`platform-support-inbox-item ${selectedMailId === m.id ? 'is-selected' : ''} ${!m.readAt ? 'is-unread' : ''}`}
                      onClick={() => setSelectedMailId(m.id)}
                    >
                      <span className="platform-support-inbox-item-subject">{m.subject || '(konu yok)'}</span>
                      <span className="platform-support-inbox-item-from">{m.from}</span>
                      <span className="platform-support-inbox-item-date">{formatDateTime(m.receivedAt)}</span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </section>
          <section className="platform-panel platform-support-inbox-detail">
            {selectedMail ? (
              <>
                <h3>{selectedMail.subject}</h3>
                <p className="platform-table-muted">{selectedMail.from}</p>
                {selectedMail.autoreplySentAt ? (
                  <p className="platform-inline-msg">Otomatik alındı maili gönderildi ({formatDateTime(selectedMail.autoreplySentAt)})</p>
                ) : null}
                <div className="platform-support-inbox-body">{selectedMail.bodyText || selectedMail.snippet}</div>
                <label className="platform-support-reply-label">
                  Yanıt (destek@)
                  <textarea rows={5} value={replyDraft} onChange={(e) => setReplyDraft(e.target.value)} />
                </label>
                <button type="button" className="btn btn-primary" onClick={() => void onReply()} disabled={!replyDraft.trim()}>
                  Gönder
                </button>
              </>
            ) : (
              <p className="platform-support-hint">Listeden bir mail seçin.</p>
            )}
          </section>
        </div>
      ) : null}

      {section === 'queue' ? (
        <>
      <div className="platform-users-kpi-grid">
        <article className="platform-users-kpi platform-users-kpi--accent">
          <KpiIcon name="users" />
          <span className="platform-users-kpi-label">Kuyruk</span>
          <strong className="platform-users-kpi-value">{data.totals.queueSize}</strong>
          <span className="platform-users-kpi-sub">{data.totals.pendingFirstResponse} ilk yanıt bekliyor</span>
        </article>
        <article className="platform-users-kpi">
          <KpiIcon name="active" />
          <span className="platform-users-kpi-label">Açık / beklemede</span>
          <strong className="platform-users-kpi-value">
            {data.totals.openThreads} / {data.totals.waitingThreads}
          </strong>
        </article>
        <article className="platform-users-kpi">
          <KpiIcon name="login" />
          <span className="platform-users-kpi-label">İlk yanıt (ort.)</span>
          <strong className="platform-users-kpi-value">{formatDurationMs(data.totals.firstResponse.avgMs)}</strong>
          <span className="platform-users-kpi-sub">
            Medyan {formatDurationMs(data.totals.firstResponse.medianMs)} · p90{' '}
            {formatDurationMs(data.totals.firstResponse.p90Ms)}
          </span>
        </article>
        <article className="platform-users-kpi platform-support-kpi-ring">
          <RingProgress pct={compliancePct} label="SLA uyumu" variant={complianceVariant} />
          <span className="platform-users-kpi-sub platform-support-kpi-ring-caption">
            Hedef: {data.policy.firstResponseTargetMinutes} dk
          </span>
        </article>
        <article className="platform-users-kpi">
          <KpiIcon name="churn" />
          <span className="platform-users-kpi-label">SLA ihlali (pencere)</span>
          <strong className="platform-users-kpi-value">{data.totals.slaBreaches}</strong>
          <span className="platform-users-kpi-sub">{data.totals.slaMet} süre içinde yanıt</span>
        </article>
      </div>

      <div className="platform-support-columns">
        <section className="platform-panel platform-support-policy">
          <h3>SLA eşikleri</h3>
          {policyDraft ? (
            <div className="platform-support-policy-form">
              <label>
                İlk yanıt hedefi (dakika)
                <input
                  type="number"
                  min={15}
                  max={10080}
                  value={policyDraft.firstResponseTargetMinutes}
                  onChange={(e) =>
                    setPolicyDraft({
                      ...policyDraft,
                      firstResponseTargetMinutes: Number(e.target.value) || 240,
                    })
                  }
                />
              </label>
              <label>
                Beklemede eskime (saat)
                <input
                  type="number"
                  min={1}
                  max={720}
                  value={policyDraft.staleWaitingHours}
                  onChange={(e) =>
                    setPolicyDraft({
                      ...policyDraft,
                      staleWaitingHours: Number(e.target.value) || 24,
                    })
                  }
                />
              </label>
              <button type="button" className="btn btn-primary" onClick={() => void savePolicy()}>
                Kaydet
              </button>
            </div>
          ) : null}
          {policyMsg ? <p className="platform-inline-msg">{policyMsg}</p> : null}
        </section>

        <section className="platform-panel">
          <div className="platform-panel-head">
            <h3>Öncelikli kuyruk</h3>
            <PlatformFilterSelect
              label="Tür"
              icon="role"
              value={queueFilter}
              onChange={(v) => setQueueFilter(v as typeof queueFilter)}
            >
              <option value="all">Tümü</option>
              <option value="first_response">İlk yanıt</option>
              <option value="stale_waiting">Eski bekleme</option>
            </PlatformFilterSelect>
          </div>
          <table className="platform-table platform-table--scroll">
            <thead>
              <tr>
                <th>Önem</th>
                <th>Kiracı</th>
                <th>Müşteri / konu</th>
                <th>Bekleme</th>
                <th>Güncelleme</th>
              </tr>
            </thead>
            <tbody>
              {filteredQueue.length === 0 ? (
                <tr>
                  <td colSpan={5}>Kuyruk boş</td>
                </tr>
              ) : (
                filteredQueue.map((q) => (
                  <tr key={q.id} className={`platform-support-row platform-support-row--${q.severity}`}>
                    <td>
                      <span className={`platform-support-badge platform-support-badge--${q.severity}`}>
                        {SEV_LABELS[q.severity] ?? q.severity}
                      </span>
                      <span className="platform-table-muted">{KIND_LABELS[q.kind] ?? q.kind}</span>
                    </td>
                    <td>
                      <span className="platform-table-primary">{q.businessName}</span>
                      <span className="platform-table-muted">{q.tenantId}</span>
                    </td>
                    <td>
                      {q.customerName}
                      <span className="platform-table-muted">{q.subject}</span>
                    </td>
                    <td>{formatDurationMs(q.waitMs)}</td>
                    <td>{formatDateTime(q.updatedAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
      </div>

      <section className="platform-panel">
        <h3>Kiracı SLA özeti</h3>
        <table className="platform-table platform-table--scroll">
          <thead>
            <tr>
              <th>Mağaza</th>
              <th>Açık</th>
              <th>Beklemede</th>
              <th>İlk yanıt bekliyor</th>
              <th>Medyan yanıt</th>
              <th>Kuyruk</th>
              <th>İhlal</th>
              <th>Onboarding</th>
            </tr>
          </thead>
          <tbody>
            {data.tenants.map((t) => (
              <tr key={t.tenantId}>
                <td>
                  <span className="platform-table-primary">{t.businessName}</span>
                  <span className="platform-table-muted">{t.tenantId}</span>
                </td>
                <td>{t.messaging.open}</td>
                <td>{t.messaging.waiting}</td>
                <td>{t.messaging.pendingFirstResponse}</td>
                <td>{formatDurationMs(t.firstResponse.medianMs)}</td>
                <td>{t.queueItems}</td>
                <td>{t.slaBreaches}</td>
                <td>
                  {t.postaOnboardingComplete ? 'Tamam' : t.messagingEmbedReady ? 'Embed OK' : t.onboardingStatus}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
        </>
      ) : null}
    </div>
  );
}
